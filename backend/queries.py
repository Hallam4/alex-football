"""Reusable DB queries for Alex Football API."""

from collections import defaultdict
from itertools import combinations

from sqlalchemy import func, case, desc, delete, and_, or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from db_models import Player, Block, GameResult, HeadToHead, MomAward, LeagueStanding, BlockRoster


async def get_league_table(db: AsyncSession):
    """Get current league standings ordered by PPG then points."""
    latest_block = (await db.execute(select(func.max(Block.id)))).scalar()
    block = (await db.execute(select(Block).where(Block.id == latest_block))).scalar_one_or_none()

    result = await db.execute(
        select(LeagueStanding, Player.name)
        .join(Player, LeagueStanding.player_id == Player.id)
        .where(LeagueStanding.block_id == latest_block)
        .order_by(desc(LeagueStanding.ppg), desc(LeagueStanding.points))
    )
    rows = result.all()

    standings = []
    for i, (ls, name) in enumerate(rows, 1):
        standings.append({
            "position": i,
            "player_id": ls.player_id,
            "player_name": name,
            "played": ls.played,
            "won": ls.won,
            "drawn": ls.drawn,
            "lost": ls.lost,
            "mom": ls.mom_bonus,
            "points": ls.points,
            "goal_difference": ls.goal_difference,
            "ppg": ls.ppg,
        })

    return {
        "block_name": block.name if block else "Unknown",
        "standings": standings,
    }


async def get_all_players(db: AsyncSession):
    """Get all players with career stats, active first."""
    result = await db.execute(
        select(
            Player.id,
            Player.name,
            Player.is_active,
            func.count(GameResult.id).label("total_games"),
            func.sum(case((GameResult.result == "W", 1), else_=0)).label("total_wins"),
        )
        .outerjoin(GameResult, GameResult.player_id == Player.id)
        .group_by(Player.id)
        .order_by(desc(Player.is_active), Player.name)
    )
    rows = result.all()
    return [
        {
            "id": r.id,
            "name": r.name,
            "is_active": r.is_active,
            "total_games": r.total_games,
            "total_wins": r.total_wins,
            "win_rate": round(r.total_wins / r.total_games * 100, 1) if r.total_games > 0 else 0,
        }
        for r in rows
    ]


async def get_player_profile(db: AsyncSession, player_id: int):
    """Get detailed player profile with career stats, form, and H2H."""
    player = (await db.execute(select(Player).where(Player.id == player_id))).scalar_one_or_none()
    if not player:
        return None

    # Career stats
    stats = (await db.execute(
        select(
            func.count(GameResult.id),
            func.sum(case((GameResult.result == "W", 1), else_=0)),
            func.sum(case((GameResult.result == "D", 1), else_=0)),
            func.sum(case((GameResult.result == "L", 1), else_=0)),
        ).where(GameResult.player_id == player_id)
    )).one()

    total, wins, draws, losses = stats
    wins = wins or 0
    draws = draws or 0
    losses = losses or 0

    # Recent form (last 6 games)
    recent = (await db.execute(
        select(GameResult.result)
        .where(GameResult.player_id == player_id)
        .order_by(desc(GameResult.game_date), desc(GameResult.id))
        .limit(6)
    )).scalars().all()

    # H2H records (where this player is player_a)
    h2h_a = (await db.execute(
        select(HeadToHead, Player.name)
        .join(Player, HeadToHead.player_b_id == Player.id)
        .where(HeadToHead.player_a_id == player_id)
        .order_by(desc(HeadToHead.played))
    )).all()

    # H2H records (where this player is player_b) — flip perspective
    h2h_b = (await db.execute(
        select(HeadToHead, Player.name)
        .join(Player, HeadToHead.player_a_id == Player.id)
        .where(HeadToHead.player_b_id == player_id)
        .order_by(desc(HeadToHead.played))
    )).all()

    h2h = []
    for rec, name in h2h_a:
        h2h.append({
            "opponent_id": rec.player_b_id,
            "opponent_name": name,
            "played": rec.played,
            "wins": rec.wins,
            "draws": rec.draws,
            "losses": rec.losses,
            "goals_scored": rec.goals_scored,
        })
    for rec, name in h2h_b:
        h2h.append({
            "opponent_id": rec.player_a_id,
            "opponent_name": name,
            "played": rec.played,
            "wins": rec.losses,  # flipped
            "draws": rec.draws,
            "losses": rec.wins,  # flipped
            "goals_scored": rec.goals_scored,
        })

    # Blocks played
    blocks_played = (await db.execute(
        select(func.count(func.distinct(GameResult.block_id)))
        .where(GameResult.player_id == player_id)
    )).scalar()

    return {
        "id": player.id,
        "name": player.name,
        "is_active": player.is_active,
        "first_game_date": player.first_game_date,
        "total_games": total,
        "total_wins": wins,
        "total_draws": draws,
        "total_losses": losses,
        "win_rate": round(wins / total * 100, 1) if total > 0 else 0,
        "recent_form": list(recent),
        "head_to_head": h2h,
        "blocks_played": blocks_played,
    }


async def get_games(db: AsyncSession, block_id: int | None = None, page: int = 1, page_size: int = 50):
    """Get game log, optionally filtered by block."""
    query = (
        select(
            GameResult.block_id,
            GameResult.player_id,
            GameResult.game_date,
            GameResult.week_number,
            Block.name.label("block_name"),
            Player.name.label("player_name"),
            GameResult.result,
            GameResult.is_sub,
            GameResult.goals_for,
            GameResult.goals_against,
        )
        .join(Block, GameResult.block_id == Block.id)
        .join(Player, GameResult.player_id == Player.id)
    )

    count_query = select(func.count(GameResult.id)).join(Block, GameResult.block_id == Block.id)

    if block_id:
        query = query.where(GameResult.block_id == block_id)
        count_query = count_query.where(GameResult.block_id == block_id)

    total = (await db.execute(count_query)).scalar()

    rows = (await db.execute(
        query.order_by(desc(GameResult.game_date), GameResult.week_number, Player.name)
        .offset((page - 1) * page_size)
        .limit(page_size)
    )).all()

    return {
        "games": [
            {
                "block_id": r.block_id,
                "player_id": r.player_id,
                "game_date": r.game_date,
                "week_number": r.week_number,
                "block_name": r.block_name,
                "player_name": r.player_name,
                "result": r.result,
                "is_sub": r.is_sub,
                "goals_for": r.goals_for,
                "goals_against": r.goals_against,
            }
            for r in rows
        ],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


async def get_mom_leaderboard(db: AsyncSession):
    """Get MoM leaderboard aggregated by player."""
    result = await db.execute(
        select(
            MomAward.player_id,
            Player.name,
            func.count(MomAward.id).label("total_awards"),
            func.sum(MomAward.votes).label("total_votes"),
        )
        .join(Player, MomAward.player_id == Player.id)
        .group_by(MomAward.player_id, Player.name)
        .order_by(desc("total_awards"), desc("total_votes"))
    )
    return [
        {
            "player_id": r.player_id,
            "player_name": r.name,
            "total_awards": r.total_awards,
            "total_votes": r.total_votes,
        }
        for r in result.all()
    ]


async def get_blocks(db: AsyncSession):
    """Get all block definitions."""
    result = await db.execute(select(Block).order_by(desc(Block.id)))
    return [
        {
            "id": b.id,
            "name": b.name,
            "start_date": b.start_date,
            "quarter": b.quarter,
        }
        for b in result.scalars().all()
    ]


async def get_player_ratings(db: AsyncSession, player_ids: list[int]):
    """Get player ratings for team picker."""
    ratings = {}

    for pid in player_ids:
        # Career win rate
        career = (await db.execute(
            select(
                func.count(GameResult.id),
                func.sum(case((GameResult.result == "W", 1), else_=0)),
            ).where(GameResult.player_id == pid)
        )).one()
        career_total, career_wins = career
        career_wins = career_wins or 0
        career_wr = career_wins / career_total if career_total > 0 else 0.5

        # Form: last 6 games
        recent = (await db.execute(
            select(GameResult.result)
            .where(GameResult.player_id == pid)
            .order_by(desc(GameResult.game_date), desc(GameResult.id))
            .limit(6)
        )).scalars().all()

        if recent:
            form_pts = sum(1.0 if r == "W" else 0.5 if r == "D" else 0.0 for r in recent)
            form_score = form_pts / len(recent)
        else:
            form_score = 0.5

        # Current block win rate
        latest_block = (await db.execute(select(func.max(Block.id)))).scalar()
        block_stats = (await db.execute(
            select(
                func.count(GameResult.id),
                func.sum(case((GameResult.result == "W", 1), else_=0)),
            ).where(GameResult.player_id == pid, GameResult.block_id == latest_block)
        )).one()
        block_total, block_wins = block_stats
        block_wins = block_wins or 0
        block_wr = block_wins / block_total if block_total > 0 else 0.5

        rating = 0.30 * career_wr + 0.40 * form_score + 0.30 * block_wr
        ratings[pid] = rating

    return ratings


async def get_pair_synergy(db: AsyncSession, player_ids: list[int]):
    """Get pairwise synergy scores from H2H data."""
    synergy: dict[tuple[int, int], float] = {}

    for i, pid_a in enumerate(player_ids):
        for pid_b in player_ids[i + 1:]:
            key = (min(pid_a, pid_b), max(pid_a, pid_b))

            # Check both directions
            rec = (await db.execute(
                select(HeadToHead).where(
                    or_(
                        and_(HeadToHead.player_a_id == pid_a, HeadToHead.player_b_id == pid_b),
                        and_(HeadToHead.player_a_id == pid_b, HeadToHead.player_b_id == pid_a),
                    )
                )
            )).scalar_one_or_none()

            if rec and rec.played >= 3:
                win_rate = rec.wins / rec.played
                synergy[key] = win_rate
            else:
                synergy[key] = 0.5  # neutral

    return synergy


async def recalculate_standings(db: AsyncSession, block_id: int):
    """Recalculate league standings for a block from game results + MoM awards."""
    block = (await db.execute(select(Block).where(Block.id == block_id))).scalar_one_or_none()
    if not block:
        return None

    # Aggregate game results per player for this block
    game_stats = (await db.execute(
        select(
            GameResult.player_id,
            func.count(GameResult.id).label("played"),
            func.sum(case((GameResult.result == "W", 1), else_=0)).label("won"),
            func.sum(case((GameResult.result == "D", 1), else_=0)).label("drawn"),
            func.sum(case((GameResult.result == "L", 1), else_=0)).label("lost"),
            func.coalesce(func.sum(GameResult.goals_for), 0).label("goals_for"),
            func.coalesce(func.sum(GameResult.goals_against), 0).label("goals_against"),
        )
        .where(GameResult.block_id == block_id)
        .group_by(GameResult.player_id)
    )).all()

    # Aggregate MoM awards per player for this block
    mom_stats = (await db.execute(
        select(
            MomAward.player_id,
            func.count(MomAward.id).label("award_count"),
        )
        .where(MomAward.block_id == block_id)
        .group_by(MomAward.player_id)
    )).all()
    mom_map = {r.player_id: r.award_count for r in mom_stats}

    # Delete existing standings for this block
    await db.execute(delete(LeagueStanding).where(LeagueStanding.block_id == block_id))

    # Insert new standings
    for r in game_stats:
        mom_count = mom_map.get(r.player_id, 0)
        points = 3 * r.won + 1 * r.drawn + mom_count
        ppg = round(points / r.played, 3) if r.played > 0 else 0.0
        gd = r.goals_for - r.goals_against

        db.add(LeagueStanding(
            block_id=block_id,
            player_id=r.player_id,
            played=r.played,
            won=r.won,
            drawn=r.drawn,
            lost=r.lost,
            points=points,
            goals_for=r.goals_for,
            goals_against=r.goals_against,
            goal_difference=gd,
            mom_bonus=mom_count,
            ppg=ppg,
        ))

    await db.commit()
    return block.name


async def get_player_stats(db: AsyncSession, player_id: int):
    """Get per-block stats and game-by-game results for charts."""
    player = (await db.execute(select(Player).where(Player.id == player_id))).scalar_one_or_none()
    if not player:
        return None

    # Per-block breakdown
    block_stats = (await db.execute(
        select(
            GameResult.block_id,
            Block.name.label("block_name"),
            func.count(GameResult.id).label("played"),
            func.sum(case((GameResult.result == "W", 1), else_=0)).label("won"),
            func.sum(case((GameResult.result == "D", 1), else_=0)).label("drawn"),
            func.sum(case((GameResult.result == "L", 1), else_=0)).label("lost"),
        )
        .join(Block, GameResult.block_id == Block.id)
        .where(GameResult.player_id == player_id)
        .group_by(GameResult.block_id, Block.name)
        .order_by(GameResult.block_id)
    )).all()

    blocks = []
    for r in block_stats:
        win_rate = round(r.won / r.played * 100, 1) if r.played > 0 else 0.0
        blocks.append({
            "block_id": r.block_id,
            "block_name": r.block_name,
            "played": r.played,
            "won": r.won,
            "drawn": r.drawn,
            "lost": r.lost,
            "win_rate": win_rate,
        })

    # Game-by-game results in chronological order
    games = (await db.execute(
        select(GameResult.result, GameResult.game_date)
        .where(GameResult.player_id == player_id)
        .order_by(GameResult.game_date, GameResult.id)
    )).all()

    game_list = [
        {"result": g.result, "game_date": g.game_date}
        for g in games
    ]

    return {"blocks": blocks, "games": game_list}


async def recalculate_h2h(db: AsyncSession):
    """Rebuild the entire HeadToHead table from GameResult data.

    Teammate detection: players sharing the same (block_id, week_number, game_date, result)
    were on the same team. Draws are skipped — both teams get result 'D' with identical goals,
    so team membership is ambiguous.
    """
    # Fetch all non-draw game results
    rows = (await db.execute(
        select(
            GameResult.block_id,
            GameResult.week_number,
            GameResult.game_date,
            GameResult.result,
            GameResult.player_id,
            GameResult.goals_for,
        )
        .where(GameResult.result != "D")
    )).all()

    # Group by (block_id, week_number, game_date, result) to identify teams
    teams: dict[tuple, list[tuple[int, int | None]]] = defaultdict(list)
    for r in rows:
        key = (r.block_id, r.week_number, r.game_date, r.result)
        teams[key].append((r.player_id, r.goals_for))

    # Aggregate per-pair stats
    pair_stats: dict[tuple[int, int], dict] = defaultdict(
        lambda: {"played": 0, "wins": 0, "losses": 0, "draws": 0, "goals_scored": 0}
    )

    for (block_id, week_number, game_date, result), members in teams.items():
        player_ids = [pid for pid, _ in members]
        goals = sum(g for _, g in members if g is not None)

        for a, b in combinations(player_ids, 2):
            key = (min(a, b), max(a, b))
            pair_stats[key]["played"] += 1
            if result == "W":
                pair_stats[key]["wins"] += 1
            elif result == "L":
                pair_stats[key]["losses"] += 1
            pair_stats[key]["goals_scored"] += goals

    # Delete all existing H2H rows, insert new ones
    await db.execute(delete(HeadToHead))
    for (a_id, b_id), stats in pair_stats.items():
        db.add(HeadToHead(
            player_a_id=a_id,
            player_b_id=b_id,
            played=stats["played"],
            wins=stats["wins"],
            draws=stats["draws"],
            losses=stats["losses"],
            goals_scored=stats["goals_scored"],
        ))

    await db.commit()


async def delete_game(db: AsyncSession, block_id: int, week_number: int, game_date):
    """Delete all GameResult rows matching the given game identifier. Returns row count."""
    result = await db.execute(
        delete(GameResult).where(
            GameResult.block_id == block_id,
            GameResult.week_number == week_number,
            GameResult.game_date == game_date,
        )
    )
    await db.commit()
    return result.rowcount


async def create_player(db: AsyncSession, name: str, is_active: bool = True):
    """Add a new player. Raises IntegrityError if name already exists."""
    player = Player(name=name, is_active=is_active)
    db.add(player)
    try:
        await db.commit()
        await db.refresh(player)
        return {"id": player.id, "name": player.name, "is_active": player.is_active}
    except IntegrityError:
        await db.rollback()
        raise


async def create_block(db: AsyncSession, name: str, start_date=None, quarter=None):
    """Add a new block/season."""
    block = Block(name=name, start_date=start_date, quarter=quarter)
    db.add(block)
    await db.commit()
    await db.refresh(block)
    return {"id": block.id, "name": block.name, "start_date": block.start_date, "quarter": block.quarter}


async def award_mom(db: AsyncSession, block_id: int, week_number: int, game_date, player_id: int, votes: int = 0):
    """Award MoM to a player and recalculate standings for the block."""
    award = MomAward(
        block_id=block_id,
        week_number=week_number,
        game_date=game_date,
        player_id=player_id,
        votes=votes,
        score=float(votes),
    )
    db.add(award)
    await db.commit()
    # MoM affects league points, so recalculate standings
    await recalculate_standings(db, block_id)
    return {"status": "ok"}
