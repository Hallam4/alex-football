// --- Types ---

export interface LeagueRow {
  position: number;
  player_id: number;
  player_name: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  mom: number;
  points: number;
  goal_difference: number;
  ppg: number;
}

export interface LeagueResponse {
  block_name: string;
  standings: LeagueRow[];
}

export interface PlayerSummary {
  id: number;
  name: string;
  is_active: boolean;
  total_games: number;
  total_wins: number;
  win_rate: number;
}

export interface H2HRecord {
  opponent_id: number;
  opponent_name: string;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goals_scored: number;
}

export interface PlayerProfile {
  id: number;
  name: string;
  is_active: boolean;
  first_game_date: string | null;
  total_games: number;
  total_wins: number;
  total_draws: number;
  total_losses: number;
  win_rate: number;
  recent_form: string[];
  head_to_head: H2HRecord[];
  blocks_played: number;
}

export interface GameRow {
  game_date: string | null;
  week_number: number;
  block_name: string;
  player_name: string;
  result: string;
  is_sub: boolean;
  goals_for: number | null;
  goals_against: number | null;
}

export interface GameLogResponse {
  games: GameRow[];
  total: number;
  page: number;
  page_size: number;
}

export interface TeamPickerPlayer {
  id: number;
  name: string;
  rating: number;
}

export interface TeamPickerResult {
  team_a: TeamPickerPlayer[];
  team_b: TeamPickerPlayer[];
  team_a_strength: number;
  team_b_strength: number;
  balance_score: number;
}

export interface MomEntry {
  player_id: number;
  player_name: string;
  total_awards: number;
  total_votes: number;
}

export interface MomResponse {
  leaderboard: MomEntry[];
}

export interface BlockSummary {
  id: number;
  name: string;
  start_date: string | null;
  quarter: number | null;
}

// --- Snake Draft ---
export interface CreateDraftRequest {
  captain_a_id: number;
  captain_b_id: number;
  player_ids: number[];
}

export interface CreateDraftResponse {
  code: string;
  token_a: string;
  token_b: string;
}

export interface DraftPlayer {
  id: number;
  name: string;
  rating: number;
  synergy: number | null;
}

export interface DraftPick {
  player_id: number;
  captain: string;
}

export interface DraftState {
  code: string;
  captain_a: string;
  captain_b: string;
  whose_turn: string | null;
  pick_number: number;
  is_complete: boolean;
  my_captain: string | null;
  available: DraftPlayer[];
  team_a: DraftPlayer[];
  team_b: DraftPlayer[];
  team_a_strength: number;
  team_b_strength: number;
  picks: DraftPick[];
}

// --- API Client ---

const BASE = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api`
  : "/api";

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || res.statusText);
  }
  return res.json();
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || res.statusText);
  }
  return res.json();
}

export const api = {
  getLeague: () => fetchJson<LeagueResponse>(`${BASE}/league`),
  getPlayers: () => fetchJson<PlayerSummary[]>(`${BASE}/players`),
  getPlayer: (id: number) => fetchJson<PlayerProfile>(`${BASE}/players/${id}`),
  getGames: (blockId?: number, page = 1) =>
    fetchJson<GameLogResponse>(
      `${BASE}/games?page=${page}${blockId ? `&block_id=${blockId}` : ""}`
    ),
  pickTeams: (ids: number[]) =>
    postJson<TeamPickerResult>(`${BASE}/team-picker`, {
      available_player_ids: ids,
    }),
  getMom: () => fetchJson<MomResponse>(`${BASE}/mom`),
  getBlocks: () => fetchJson<BlockSummary[]>(`${BASE}/blocks`),
  createDraft: (req: CreateDraftRequest) =>
    postJson<CreateDraftResponse>(`${BASE}/draft`, req),
  getDraftState: (code: string, token: string) =>
    fetchJson<DraftState>(`${BASE}/draft/${code}?token=${token}`),
};
