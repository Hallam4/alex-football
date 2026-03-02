"""FastAPI app for Alex Football."""

from contextlib import asynccontextmanager

from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.ext.asyncio import AsyncSession

from database import engine, get_db
from db_models import Base
from models import (
    LeagueResponse, LeagueRow, PlayerSummary, PlayerProfile, H2HRecord,
    GameLogResponse, GameRow, TeamPickerRequest, TeamPickerResult, TeamPickerPlayer,
    MomResponse, MomEntry, BlockSummary, GameEntryRequest,
)
from queries import (
    get_league_table, get_all_players, get_player_profile,
    get_games, get_mom_leaderboard, get_blocks, get_player_ratings, get_pair_synergy,
)
from team_picker import pick_teams


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield


app = FastAPI(title="Alex Football API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.get("/api/league", response_model=LeagueResponse)
async def league(db: AsyncSession = Depends(get_db)):
    data = await get_league_table(db)
    return LeagueResponse(
        block_name=data["block_name"],
        standings=[LeagueRow(**s) for s in data["standings"]],
    )


@app.get("/api/players", response_model=list[PlayerSummary])
async def players(db: AsyncSession = Depends(get_db)):
    data = await get_all_players(db)
    return [PlayerSummary(**p) for p in data]


@app.get("/api/players/{player_id}", response_model=PlayerProfile)
async def player_detail(player_id: int, db: AsyncSession = Depends(get_db)):
    data = await get_player_profile(db, player_id)
    if not data:
        raise HTTPException(status_code=404, detail="Player not found")
    return PlayerProfile(
        **{k: v for k, v in data.items() if k != "head_to_head"},
        head_to_head=[H2HRecord(**h) for h in data["head_to_head"]],
    )


@app.get("/api/games", response_model=GameLogResponse)
async def games(
    block_id: int | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
):
    data = await get_games(db, block_id=block_id, page=page, page_size=page_size)
    return GameLogResponse(
        games=[GameRow(**g) for g in data["games"]],
        total=data["total"],
        page=data["page"],
        page_size=data["page_size"],
    )


@app.post("/api/team-picker", response_model=TeamPickerResult)
async def team_picker(req: TeamPickerRequest, db: AsyncSession = Depends(get_db)):
    if len(req.available_player_ids) != 12:
        raise HTTPException(status_code=400, detail="Exactly 12 player IDs required")

    ratings = await get_player_ratings(db, req.available_player_ids)
    synergy = await get_pair_synergy(db, req.available_player_ids)
    result = pick_teams(req.available_player_ids, ratings, synergy)

    # Look up player names
    all_players = await get_all_players(db)
    name_map = {p["id"]: p["name"] for p in all_players}

    return TeamPickerResult(
        team_a=[
            TeamPickerPlayer(id=pid, name=name_map.get(pid, "Unknown"), rating=round(ratings.get(pid, 0.5), 4))
            for pid in result["team_a"]
        ],
        team_b=[
            TeamPickerPlayer(id=pid, name=name_map.get(pid, "Unknown"), rating=round(ratings.get(pid, 0.5), 4))
            for pid in result["team_b"]
        ],
        team_a_strength=result["team_a_strength"],
        team_b_strength=result["team_b_strength"],
        balance_score=result["balance_score"],
    )


@app.get("/api/mom", response_model=MomResponse)
async def mom(db: AsyncSession = Depends(get_db)):
    data = await get_mom_leaderboard(db)
    return MomResponse(leaderboard=[MomEntry(**m) for m in data])


@app.get("/api/blocks", response_model=list[BlockSummary])
async def blocks(db: AsyncSession = Depends(get_db)):
    data = await get_blocks(db)
    return [BlockSummary(**b) for b in data]


@app.post("/api/games/add")
async def add_game(req: GameEntryRequest, db: AsyncSession = Depends(get_db)):
    from db_models import GameResult
    for p in req.players:
        db.add(GameResult(
            block_id=req.block_id,
            week_number=req.week_number,
            game_date=req.game_date,
            player_id=p.player_id,
            result=p.result,
            is_sub=p.is_sub,
            replaced_player_id=p.replaced_player_id,
            goals_for=p.goals_for,
            goals_against=p.goals_against,
        ))
    await db.commit()
    return {"status": "ok", "players_added": len(req.players)}
