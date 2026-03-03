"""In-memory snake draft state management."""

import secrets
import time
from dataclasses import dataclass, field
from typing import Any

from fastapi import WebSocket

# Snake order: 10 picks (5 each). B gets consecutive picks 2-3 only.
SNAKE_ORDER = ("A", "B", "B", "A", "B", "A", "B", "A", "B", "A")

# All active sessions keyed by draft code
_sessions: dict[str, "DraftSession"] = {}

# Stale session TTL (1 hour)
_TTL_SECONDS = 3600


@dataclass
class DraftSession:
    code: str
    captain_a: str
    captain_b: str
    captain_a_id: int
    captain_b_id: int
    token_a: str
    token_b: str
    pool: list[dict]  # [{id, name, rating}, ...]
    synergy: dict[str, float]  # "minId,maxId" → score
    picks: list[dict] = field(default_factory=list)  # [{player_id, captain}]
    connections: dict[str, WebSocket] = field(default_factory=dict)  # token → ws
    created_at: float = field(default_factory=time.time)

    @property
    def whose_turn(self) -> str | None:
        """Return 'A' or 'B' for current turn, or None if draft complete."""
        if len(self.picks) >= 10:
            return None
        return SNAKE_ORDER[len(self.picks)]

    @property
    def is_complete(self) -> bool:
        return len(self.picks) >= 10

    def captain_for_token(self, token: str) -> str | None:
        if token == self.token_a:
            return "A"
        if token == self.token_b:
            return "B"
        return None

    def captain_name(self, captain: str) -> str:
        return self.captain_a if captain == "A" else self.captain_b

    def picked_ids(self) -> set[int]:
        return {p["player_id"] for p in self.picks}

    def team_ids(self, captain: str) -> list[int]:
        return [p["player_id"] for p in self.picks if p["captain"] == captain]

    def to_state_dict(self, my_captain: str | None = None) -> dict[str, Any]:
        """Full state snapshot for WS broadcast."""
        picked = self.picked_ids()
        captain_ids = {self.captain_a_id, self.captain_b_id}
        my_team_ids = set(self.team_ids(my_captain)) if my_captain else set()

        available = []
        for p in sorted(self.pool, key=lambda x: -x["rating"]):
            if p["id"] not in picked and p["id"] not in captain_ids:
                synergy_pct = None
                if my_captain and my_team_ids:
                    synergy_pct = self._avg_synergy(p["id"], my_team_ids)
                available.append({
                    **p,
                    "synergy": synergy_pct,
                })

        team_a = self._build_team("A")
        team_b = self._build_team("B")

        return {
            "code": self.code,
            "captain_a": self.captain_a,
            "captain_b": self.captain_b,
            "whose_turn": self.whose_turn,
            "pick_number": len(self.picks),
            "is_complete": self.is_complete,
            "my_captain": my_captain,
            "available": available,
            "team_a": team_a,
            "team_b": team_b,
            "team_a_strength": sum(p["rating"] for p in team_a),
            "team_b_strength": sum(p["rating"] for p in team_b),
            "picks": self.picks,
        }

    def _build_team(self, captain: str) -> list[dict]:
        pool_map = {p["id"]: p for p in self.pool}
        captain_id = self.captain_a_id if captain == "A" else self.captain_b_id
        team = []
        # Prepend the captain
        if captain_id in pool_map:
            team.append(pool_map[captain_id])
        # Then the drafted picks
        for p in self.picks:
            if p["captain"] == captain and p["player_id"] in pool_map:
                team.append(pool_map[p["player_id"]])
        return team

    def _avg_synergy(self, player_id: int, teammate_ids: set[int]) -> float:
        total = 0.0
        count = 0
        for tid in teammate_ids:
            key = f"{min(player_id, tid)},{max(player_id, tid)}"
            total += self.synergy.get(key, 0.5)
            count += 1
        return round(total / count * 100, 1) if count > 0 else 50.0


def create_draft(
    captain_a: str,
    captain_b: str,
    captain_a_id: int,
    captain_b_id: int,
    pool: list[dict],
    synergy: dict[str, float],
) -> DraftSession:
    """Create a new draft session and return it."""
    cleanup_stale()
    code = secrets.token_urlsafe(6)  # short URL-safe code
    token_a = secrets.token_urlsafe(16)
    token_b = secrets.token_urlsafe(16)
    session = DraftSession(
        code=code,
        captain_a=captain_a,
        captain_b=captain_b,
        captain_a_id=captain_a_id,
        captain_b_id=captain_b_id,
        token_a=token_a,
        token_b=token_b,
        pool=pool,
        synergy=synergy,
    )
    _sessions[code] = session
    return session


def get_draft(code: str) -> DraftSession | None:
    """Look up a draft session by code."""
    return _sessions.get(code)


def cleanup_stale() -> None:
    """Remove sessions older than TTL."""
    now = time.time()
    stale = [code for code, s in _sessions.items() if now - s.created_at > _TTL_SECONDS]
    for code in stale:
        del _sessions[code]
