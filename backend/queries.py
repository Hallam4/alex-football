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


async def get_league_table_extended(db: AsyncSession):
    """Get league standings with form, streaks, and goal stats per player."""
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
        # Recent form (last 5 games in this block)
        recent = (await db.execute(
            select(GameResult.result)
            .where(GameResult.player_id == ls.player_id, GameResult.block_id == latest_block)
            .order_by(desc(GameResult.game_date), desc(GameResult.id))
            .limit(5)
        )).scalars().all()

        # Streak: count consecutive same results from most recent
        streak = ""
        if recent:
            streak_result = recent[0]
            streak_count = 0
            for r in recent:
                if r == streak_result:
                    streak_count += 1
                else:
                    break
            if streak_count >= 2:
                streak = f"{streak_result}{streak_count}"

        avg_gf = round(ls.goals_for / ls.played, 1) if ls.played > 0 else 0.0

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
            "recent_form": list(recent),
            "streak": streak,
            "goals_for_total": ls.goals_for,
            "goals_against_total": ls.goals_against,
            "avg_goals_for": avg_gf,
        })

    return {
        "block_name": block.name if block else "Unknown",
        "standings": standings,
    }


async def get_player_achievements(db: AsyncSession, player_id: int):
    """Compute achievements for a player based on their game history."""
    player = (await db.execute(select(Player).where(Player.id == player_id))).scalar_one_or_none()
    if not player:
        return None

    achievements = []

    # Career stats
    stats = (await db.execute(
        select(
            func.count(GameResult.id),
            func.sum(case((GameResult.result == "W", 1), else_=0)),
        ).where(GameResult.player_id == player_id)
    )).one()
    total, wins = stats
    wins = wins or 0

    # First game date
    first_date = (await db.execute(
        select(func.min(GameResult.game_date)).where(GameResult.player_id == player_id)
    )).scalar()

    # Century Club (100+ games)
    if total >= 100:
        achievements.append({
            "id": "century", "name": "Century Club",
            "description": f"Played {total} games",
            "unlocked_date": None,
        })

    # Half Century (50+ games)
    if total >= 50 and total < 100:
        achievements.append({
            "id": "half_century", "name": "Half Century",
            "description": f"Played {total} games",
            "unlocked_date": None,
        })

    # Win Machine (50+ wins)
    if wins >= 50:
        achievements.append({
            "id": "win_machine", "name": "Win Machine",
            "description": f"{wins} career wins",
            "unlocked_date": None,
        })

    # Sharp Shooter (60%+ win rate with 20+ games)
    if total >= 20 and wins / total >= 0.6:
        achievements.append({
            "id": "sharp_shooter", "name": "Sharp Shooter",
            "description": f"{round(wins/total*100,1)}% career win rate",
            "unlocked_date": None,
        })

    # Recent form - check for streaks in last 20 games
    recent = (await db.execute(
        select(GameResult.result)
        .where(GameResult.player_id == player_id)
        .order_by(desc(GameResult.game_date), desc(GameResult.id))
        .limit(20)
    )).scalars().all()

    # Hot Streak (5+ consecutive wins in recent history)
    max_win_streak = 0
    current_streak = 0
    for r in recent:
        if r == "W":
            current_streak += 1
            max_win_streak = max(max_win_streak, current_streak)
        else:
            current_streak = 0
    if max_win_streak >= 5:
        achievements.append({
            "id": "hot_streak", "name": "On Fire",
            "description": f"{max_win_streak}-game win streak",
            "unlocked_date": None,
        })

    # Comeback Kid: had 2+ losses then 3+ wins in recent history
    for i in range(len(recent) - 4):
        window = recent[i:i+5]
        if (window[0] == "W" and window[1] == "W" and window[2] == "W"
            and window[3] == "L" and window[4] == "L"):
            achievements.append({
                "id": "comeback_kid", "name": "Comeback Kid",
                "description": "Won 3+ after a losing streak",
                "unlocked_date": None,
            })
            break

    # Blocks played
    blocks_played = (await db.execute(
        select(func.count(func.distinct(GameResult.block_id)))
        .where(GameResult.player_id == player_id)
    )).scalar()
    if blocks_played >= 5:
        achievements.append({
            "id": "veteran", "name": "Veteran",
            "description": f"Played in {blocks_played} blocks",
            "unlocked_date": None,
        })

    # Perfect block: won every game in any block (min 3 games)
    block_records = (await db.execute(
        select(
            GameResult.block_id,
            func.count(GameResult.id).label("played"),
            func.sum(case((GameResult.result == "W", 1), else_=0)).label("won"),
        )
        .where(GameResult.player_id == player_id)
        .group_by(GameResult.block_id)
    )).all()
    for br in block_records:
        if br.played >= 3 and br.won == br.played:
            achievements.append({
                "id": "perfect_block", "name": "Perfect Block",
                "description": f"Won all {br.played} games in a block",
                "unlocked_date": None,
            })
            break

    # Synergy Master: 5+ wins with same partner
    h2h_a = (await db.execute(
        select(HeadToHead).where(HeadToHead.player_a_id == player_id, HeadToHead.wins >= 5)
    )).scalars().all()
    h2h_b = (await db.execute(
        select(HeadToHead).where(HeadToHead.player_b_id == player_id, HeadToHead.wins >= 5)
    )).scalars().all()
    if h2h_a or h2h_b:
        best_wins = max(
            [h.wins for h in h2h_a] + [h.wins for h in h2h_b],
            default=0,
        )
        achievements.append({
            "id": "synergy_master", "name": "Synergy Master",
            "description": f"{best_wins}+ wins with a partner",
            "unlocked_date": None,
        })

    # MoM Count
    mom_count = (await db.execute(
        select(func.count(MomAward.id)).where(MomAward.player_id == player_id)
    )).scalar()
    if mom_count >= 3:
        achievements.append({
            "id": "fan_favorite", "name": "Fan Favourite",
            "description": f"{mom_count} Man of the Match awards",
            "unlocked_date": None,
        })

    # OG (playing since early)
    if first_date and player.first_game_date:
        achievements.append({
            "id": "og", "name": "OG",
            "description": f"Playing since {player.first_game_date}",
            "unlocked_date": None,
        })

    return {"player_id": player_id, "achievements": achievements}


async def predict_matchup(db: AsyncSession, team_a_ids: list[int], team_b_ids: list[int]):
    """Predict match outcome based on ratings, form, and synergy."""
    all_ids = team_a_ids + team_b_ids
    ratings = await get_player_ratings(db, all_ids)
    synergy_raw = await get_pair_synergy(db, all_ids)

    def team_strength(ids):
        return sum(ratings.get(pid, 0.5) for pid in ids)

    def team_synergy(ids):
        pairs = list(combinations(ids, 2))
        if not pairs:
            return 0.5
        total = 0.0
        for a, b in pairs:
            key = (min(a, b), max(a, b))
            total += synergy_raw.get(key, 0.5)
        return total / len(pairs)

    def team_form(ids):
        return sum(ratings.get(pid, 0.5) for pid in ids) / len(ids) if ids else 0.5

    str_a = team_strength(team_a_ids)
    str_b = team_strength(team_b_ids)
    syn_a = team_synergy(team_a_ids)
    syn_b = team_synergy(team_b_ids)

    # Combined score (strength + synergy bonus)
    score_a = str_a + syn_a * 0.5
    score_b = str_b + syn_b * 0.5

    total = score_a + score_b
    if total == 0:
        return {"team_a_win_pct": 33.3, "team_b_win_pct": 33.3, "draw_pct": 33.3,
                "team_a_strength": 0, "team_b_strength": 0,
                "team_a_form": 0.5, "team_b_form": 0.5,
                "team_a_synergy": 0.5, "team_b_synergy": 0.5}

    raw_a = score_a / total
    raw_b = score_b / total

    # Push towards 50/50 (dampen extreme predictions) and carve out draw %
    draw_base = 0.15  # base draw probability
    # Closer teams = higher draw chance
    closeness = 1.0 - abs(raw_a - raw_b)
    draw_pct = round((draw_base + closeness * 0.10) * 100, 1)

    remaining = 100.0 - draw_pct
    win_a = round(raw_a * remaining, 1)
    win_b = round(remaining - win_a, 1)

    return {
        "team_a_win_pct": win_a,
        "team_b_win_pct": win_b,
        "draw_pct": draw_pct,
        "team_a_strength": round(str_a, 3),
        "team_b_strength": round(str_b, 3),
        "team_a_form": round(str_a / len(team_a_ids), 3) if team_a_ids else 0.5,
        "team_b_form": round(str_b / len(team_b_ids), 3) if team_b_ids else 0.5,
        "team_a_synergy": round(syn_a, 3),
        "team_b_synergy": round(syn_b, 3),
    }


async def edit_game(db: AsyncSession, block_id: int, week_number: int, game_date, updates: list):
    """Replace all game results for a given game with new data."""
    # Delete existing
    count = await delete_game(db, block_id, week_number, game_date)

    # Insert new
    for p in updates:
        db.add(GameResult(
            block_id=block_id,
            week_number=week_number,
            game_date=game_date,
            player_id=p.player_id,
            result=p.result,
            is_sub=p.is_sub,
            replaced_player_id=p.replaced_player_id,
            goals_for=p.goals_for,
            goals_against=p.goals_against,
        ))
    await db.commit()

    await recalculate_standings(db, block_id)
    await recalculate_h2h(db)
    return {"status": "ok", "replaced": count, "new_count": len(updates)}


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
