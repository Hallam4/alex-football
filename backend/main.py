"""FastAPI app for Alex Football."""

import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Depends, HTTPException, Query, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.websockets import WebSocketDisconnect

from database import engine, get_db
from sqlalchemy import select
from db_models import Base, Player
from models import (
    LeagueResponse, LeagueRow, PlayerSummary, PlayerProfile, H2HRecord,
    GameLogResponse, GameRow, TeamPickerRequest, TeamPickerResult, TeamPickerPlayer,
    MomResponse, MomEntry, BlockSummary, GameEntryRequest,
    BlockStats, GameResultEntry, PlayerStatsResponse,
    CreateDraftRequest, CreateDraftResponse,
    GameDeleteRequest, CreatePlayerRequest, CreateBlockRequest, AwardMomRequest,
)
from queries import (
    get_league_table, get_all_players, get_player_profile,
    get_games, get_mom_leaderboard, get_blocks, get_player_ratings, get_pair_synergy,
    recalculate_standings, get_player_stats,
    recalculate_h2h, delete_game, create_player, create_block, award_mom,
)
from team_picker import pick_teams
from draft import create_draft, get_draft


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


@app.patch("/api/players/{player_id}")
async def toggle_player_active(player_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Player).where(Player.id == player_id))
    player = result.scalar_one_or_none()
    if not player:
        raise HTTPException(status_code=404, detail="Player not found")
    player.is_active = not player.is_active
    await db.commit()
    return {"id": player.id, "is_active": player.is_active}


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
    from db_models import GameResult as GameResultModel
    for p in req.players:
        db.add(GameResultModel(
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
    await recalculate_standings(db, req.block_id)
    await recalculate_h2h(db)
    return {"status": "ok", "players_added": len(req.players)}


@app.post("/api/blocks/{block_id}/recalculate")
async def recalculate_block(block_id: int, db: AsyncSession = Depends(get_db)):
    block_name = await recalculate_standings(db, block_id)
    if block_name is None:
        raise HTTPException(status_code=404, detail="Block not found")
    return {"status": "ok", "block_name": block_name}


@app.post("/api/h2h/recalculate")
async def recalculate_h2h_endpoint(db: AsyncSession = Depends(get_db)):
    await recalculate_h2h(db)
    return {"status": "ok"}


@app.delete("/api/games")
async def delete_game_endpoint(req: GameDeleteRequest, db: AsyncSession = Depends(get_db)):
    count = await delete_game(db, req.block_id, req.week_number, req.game_date)
    if count == 0:
        raise HTTPException(status_code=404, detail="No matching games found")
    await recalculate_standings(db, req.block_id)
    await recalculate_h2h(db)
    return {"status": "ok", "rows_deleted": count}


@app.post("/api/players")
async def create_player_endpoint(req: CreatePlayerRequest, db: AsyncSession = Depends(get_db)):
    from sqlalchemy.exc import IntegrityError
    try:
        result = await create_player(db, req.name, req.is_active)
        return result
    except IntegrityError:
        raise HTTPException(status_code=400, detail=f"Player '{req.name}' already exists")


@app.post("/api/blocks")
async def create_block_endpoint(req: CreateBlockRequest, db: AsyncSession = Depends(get_db)):
    result = await create_block(db, req.name, req.start_date, req.quarter)
    return result


@app.post("/api/mom")
async def award_mom_endpoint(req: AwardMomRequest, db: AsyncSession = Depends(get_db)):
    result = await award_mom(db, req.block_id, req.week_number, req.game_date, req.player_id, req.votes)
    return result


@app.get("/api/players/{player_id}/stats", response_model=PlayerStatsResponse)
async def player_stats(player_id: int, db: AsyncSession = Depends(get_db)):
    data = await get_player_stats(db, player_id)
    if not data:
        raise HTTPException(status_code=404, detail="Player not found")
    return PlayerStatsResponse(
        blocks=[BlockStats(**b) for b in data["blocks"]],
        games=[GameResultEntry(**g) for g in data["games"]],
    )


# --- Snake Draft ---

@app.post("/api/draft", response_model=CreateDraftResponse)
async def create_draft_session(req: CreateDraftRequest, db: AsyncSession = Depends(get_db)):
    if len(req.player_ids) != 12:
        raise HTTPException(status_code=400, detail="Exactly 12 player IDs required")
    if req.captain_a_id not in req.player_ids:
        raise HTTPException(status_code=400, detail="Captain A must be one of the 12 selected players")
    if req.captain_b_id not in req.player_ids:
        raise HTTPException(status_code=400, detail="Captain B must be one of the 12 selected players")
    if req.captain_a_id == req.captain_b_id:
        raise HTTPException(status_code=400, detail="Captains must be different players")

    ratings = await get_player_ratings(db, req.player_ids)
    synergy_raw = await get_pair_synergy(db, req.player_ids)

    # Build pool with names
    all_players = await get_all_players(db)
    name_map = {p["id"]: p["name"] for p in all_players}
    pool = [
        {"id": pid, "name": name_map.get(pid, "Unknown"), "rating": round(ratings.get(pid, 0.5), 4)}
        for pid in req.player_ids
    ]

    # Resolve captain names from IDs
    captain_a_name = name_map.get(req.captain_a_id, "Unknown")
    captain_b_name = name_map.get(req.captain_b_id, "Unknown")

    # Convert synergy keys to strings for JSON-safe storage
    synergy = {f"{a},{b}": v for (a, b), v in synergy_raw.items()}

    session = create_draft(captain_a_name, captain_b_name, req.captain_a_id, req.captain_b_id, pool, synergy)
    return CreateDraftResponse(code=session.code, token_a=session.token_a, token_b=session.token_b)


@app.get("/api/draft/{code}")
async def get_draft_state(code: str, token: str = Query(...)):
    session = get_draft(code)
    if not session:
        raise HTTPException(status_code=404, detail="Draft not found")
    captain = session.captain_for_token(token)
    if captain is None:
        raise HTTPException(status_code=403, detail="Invalid token")
    return session.to_state_dict(my_captain=captain)


@app.websocket("/ws/draft/{code}")
async def draft_websocket(ws: WebSocket, code: str, token: str = Query(...)):
    session = get_draft(code)
    if not session:
        await ws.close(code=4004, reason="Draft not found")
        return
    captain = session.captain_for_token(token)
    if captain is None:
        await ws.close(code=4003, reason="Invalid token")
        return

    await ws.accept()
    session.connections[token] = ws

    # Send initial state
    try:
        await ws.send_json({"type": "state", "data": session.to_state_dict(my_captain=captain)})

        while True:
            msg = await ws.receive_json()
            if msg.get("type") == "ping":
                await ws.send_json({"type": "pong"})
                continue
            if msg.get("type") == "pick":
                player_id = msg.get("player_id")
                # Validate it's this captain's turn
                if session.whose_turn != captain:
                    await ws.send_json({"type": "error", "message": "Not your turn"})
                    continue
                # Validate player is available
                if player_id in session.picked_ids():
                    await ws.send_json({"type": "error", "message": "Player already picked"})
                    continue
                # Validate player is in pool and not a captain
                pool_ids = {p["id"] for p in session.pool}
                captain_ids = {session.captain_a_id, session.captain_b_id}
                if player_id not in pool_ids or player_id in captain_ids:
                    await ws.send_json({"type": "error", "message": "Invalid player"})
                    continue

                # Record the pick
                session.picks.append({"player_id": player_id, "captain": captain})

                # Broadcast updated state to all connected captains
                for t, conn in list(session.connections.items()):
                    receiver_captain = session.captain_for_token(t)
                    try:
                        await conn.send_json({
                            "type": "state",
                            "data": session.to_state_dict(my_captain=receiver_captain),
                        })
                    except Exception:
                        session.connections.pop(t, None)
    except WebSocketDisconnect:
        pass
    finally:
        session.connections.pop(token, None)


# Serve frontend static files in production
STATIC_DIR = Path(__file__).resolve().parent.parent / "frontend" / "dist"
if STATIC_DIR.is_dir():
    app.mount("/assets", StaticFiles(directory=STATIC_DIR / "assets"), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        """Serve the React SPA for any non-API route."""
        file_path = STATIC_DIR / full_path
        if file_path.is_file():
            return FileResponse(file_path)
        return FileResponse(STATIC_DIR / "index.html")
