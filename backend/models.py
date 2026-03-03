from pydantic import BaseModel
from datetime import date
from typing import Optional


# --- League ---
class LeagueRow(BaseModel):
    position: int
    player_id: int
    player_name: str
    played: int
    won: int
    drawn: int
    lost: int
    mom: int
    points: float
    goal_difference: int
    ppg: float


class LeagueResponse(BaseModel):
    block_name: str
    standings: list[LeagueRow]


# --- Players ---
class PlayerSummary(BaseModel):
    id: int
    name: str
    is_active: bool
    total_games: int
    total_wins: int
    win_rate: float


class H2HRecord(BaseModel):
    opponent_id: int
    opponent_name: str
    played: int
    wins: int
    draws: int
    losses: int
    goals_scored: int


class PlayerProfile(BaseModel):
    id: int
    name: str
    is_active: bool
    first_game_date: Optional[date]
    total_games: int
    total_wins: int
    total_draws: int
    total_losses: int
    win_rate: float
    recent_form: list[str]  # Last 6 results
    head_to_head: list[H2HRecord]
    blocks_played: int


# --- Games ---
class GameRow(BaseModel):
    block_id: int
    player_id: int
    game_date: Optional[date]
    week_number: int
    block_name: str
    player_name: str
    result: str
    is_sub: bool
    goals_for: Optional[int]
    goals_against: Optional[int]


class GameLogResponse(BaseModel):
    games: list[GameRow]
    total: int
    page: int
    page_size: int


# --- Team Picker ---
class TeamPickerRequest(BaseModel):
    available_player_ids: list[int]


class TeamPickerPlayer(BaseModel):
    id: int
    name: str
    rating: float


class TeamPickerResult(BaseModel):
    team_a: list[TeamPickerPlayer]
    team_b: list[TeamPickerPlayer]
    team_a_strength: float
    team_b_strength: float
    balance_score: float


# --- MoM ---
class MomEntry(BaseModel):
    player_id: int
    player_name: str
    total_awards: int
    total_votes: int


class MomResponse(BaseModel):
    leaderboard: list[MomEntry]


# --- Blocks ---
class BlockSummary(BaseModel):
    id: int
    name: str
    start_date: Optional[date]
    quarter: Optional[int]


# --- Game Entry ---
class GameEntryPlayer(BaseModel):
    player_id: int
    result: str  # W, L, D
    is_sub: bool = False
    replaced_player_id: Optional[int] = None
    goals_for: Optional[int] = None
    goals_against: Optional[int] = None


class GameEntryRequest(BaseModel):
    block_id: int
    week_number: int
    game_date: date
    players: list[GameEntryPlayer]


# --- Player Stats (Charts) ---
class BlockStats(BaseModel):
    block_id: int
    block_name: str
    played: int
    won: int
    drawn: int
    lost: int
    win_rate: float


class GameResultEntry(BaseModel):
    result: str
    game_date: Optional[date]


class PlayerStatsResponse(BaseModel):
    blocks: list[BlockStats]
    games: list[GameResultEntry]


# --- Snake Draft ---
class CreateDraftRequest(BaseModel):
    captain_a_id: int
    captain_b_id: int
    player_ids: list[int]


class CreateDraftResponse(BaseModel):
    code: str
    token_a: str
    token_b: str


# --- Game Delete ---
class GameDeleteRequest(BaseModel):
    block_id: int
    week_number: int
    game_date: date


# --- Bulk Active ---
class SetActivePlayersRequest(BaseModel):
    player_ids: list[int]


# --- Admin ---
class CreatePlayerRequest(BaseModel):
    name: str
    is_active: bool = True


class CreateBlockRequest(BaseModel):
    name: str
    start_date: Optional[date] = None
    quarter: Optional[int] = None


class AwardMomRequest(BaseModel):
    block_id: int
    week_number: int
    game_date: date
    player_id: int
    votes: int = 0


# --- Extended League Row (with form + streaks + goals) ---
class LeagueRowExtended(LeagueRow):
    recent_form: list[str]  # Last 5 results
    streak: str  # e.g. "W3", "L2", "D1", ""
    goals_for_total: int
    goals_against_total: int
    avg_goals_for: float


# --- Achievements ---
class Achievement(BaseModel):
    id: str
    name: str
    description: str
    unlocked_date: Optional[date] = None


class PlayerAchievements(BaseModel):
    player_id: int
    achievements: list[Achievement]


# --- Matchup Prediction ---
class PredictionRequest(BaseModel):
    team_a_ids: list[int]
    team_b_ids: list[int]


class PredictionResult(BaseModel):
    team_a_win_pct: float
    team_b_win_pct: float
    draw_pct: float
    team_a_strength: float
    team_b_strength: float
    team_a_form: float
    team_b_form: float
    team_a_synergy: float
    team_b_synergy: float


# --- Game Edit ---
class GameEditRequest(BaseModel):
    block_id: int
    week_number: int
    game_date: date
    updates: list[GameEntryPlayer]  # replacement set of player results
