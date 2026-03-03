import { useQuery } from "@tanstack/react-query";
import {
  Trophy,
  Users,
  Flame,
  Star,
  Swords,
  TrendingUp,
  ArrowRight,
} from "lucide-react";
import { api, LeagueRow } from "../api/football";

type Tab = "league" | "players" | "picker" | "history" | "mom";

const FORM_DOT: Record<string, string> = {
  W: "bg-green-500",
  D: "bg-yellow-500",
  L: "bg-red-500",
};

export default function Dashboard({
  onNavigate,
}: {
  onNavigate: (tab: Tab) => void;
}) {
  const { data: league, isLoading: leagueLoading } = useQuery({
    queryKey: ["league"],
    queryFn: api.getLeague,
  });
  const { data: gamesData, isLoading: gamesLoading } = useQuery({
    queryKey: ["games", undefined, 1],
    queryFn: () => api.getGames(undefined, 1),
  });
  const { data: players, isLoading: playersLoading } = useQuery({
    queryKey: ["players"],
    queryFn: api.getPlayers,
  });
  const { data: momData, isLoading: momLoading } = useQuery({
    queryKey: ["mom"],
    queryFn: api.getMom,
  });

  const isLoading = leagueLoading || gamesLoading || playersLoading || momLoading;

  if (isLoading) {
    return (
      <div className="animate-slide-up space-y-4">
        <div className="skeleton h-20 w-full" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skeleton h-20" />
          ))}
        </div>
        <div className="skeleton h-28 w-full" />
        <div className="skeleton h-28 w-full" />
      </div>
    );
  }

  // Derived data
  const standings = league?.standings ?? [];
  const leader = standings[0] ?? null;
  const blockName = league?.block_name ?? "Current Block";

  const activePlayers = players?.filter((p) => p.is_active) ?? [];
  const gamesThisBlock = standings.length > 0 ? Math.max(...standings.map((s) => s.played)) : 0;

  const topWinRate = standings.length > 0
    ? [...standings].filter((s) => s.played >= 3).sort((a, b) => (b.won / b.played) - (a.won / a.played))[0] ?? null
    : null;

  const topPPG = standings.length > 0
    ? [...standings].filter((s) => s.played >= 3).sort((a, b) => b.ppg - a.ppg)[0] ?? null
    : null;

  // Form leader: player with longest win streak or best recent form
  const formLeader = findFormLeader(standings);

  // Latest result: first game group from page 1
  const latestGames = gamesData?.games ?? [];
  const latestGroup = groupLatestGame(latestGames);

  // MoM leader
  const momLeader = momData?.leaderboard?.[0] ?? null;

  return (
    <div className="animate-slide-up space-y-4">
      {/* Block Banner */}
      <div className="glass-card p-5 bg-gradient-to-r from-green-500/[0.08] to-emerald-500/[0.04]">
        <div className="flex items-center gap-3">
          <Trophy className="w-6 h-6 text-green-400 shrink-0" />
          <div className="min-w-0">
            <h2 className="text-lg font-bold bg-gradient-to-r from-green-400 to-emerald-300 bg-clip-text text-transparent">
              {blockName}
            </h2>
            {leader && (
              <p className="text-sm text-gray-400">
                Leader:{" "}
                <span className="text-gray-200 font-semibold">{leader.player_name}</span>
                <span className="text-green-400 ml-1">({leader.points} pts)</span>
              </p>
            )}
          </div>
          <button
            onClick={() => onNavigate("league")}
            className="ml-auto text-xs text-gray-500 hover:text-green-400 transition-colors flex items-center gap-1 shrink-0"
          >
            Full table <ArrowRight className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard
          icon={<Users className="w-4 h-4 text-blue-400" />}
          label="Active Players"
          value={activePlayers.length}
        />
        <StatCard
          icon={<Swords className="w-4 h-4 text-purple-400" />}
          label="Games This Block"
          value={gamesThisBlock}
        />
        <StatCard
          icon={<TrendingUp className="w-4 h-4 text-green-400" />}
          label="Top Win Rate"
          value={topWinRate ? `${Math.round((topWinRate.won / topWinRate.played) * 100)}%` : "—"}
          sub={topWinRate?.player_name}
        />
        <StatCard
          icon={<Trophy className="w-4 h-4 text-yellow-400" />}
          label="Top PPG"
          value={topPPG ? topPPG.ppg.toFixed(2) : "—"}
          sub={topPPG?.player_name}
        />
      </div>

      {/* Form Leader */}
      {formLeader && (
        <div className="glass-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <Flame className="w-4 h-4 text-orange-400" />
            <h3 className="text-sm font-semibold text-gray-300">Form Leader</h3>
          </div>
          <div className="flex items-center gap-3">
            <span className="font-bold text-gray-100">{formLeader.player_name}</span>
            {formLeader.streak.startsWith("W") && (
              <span className="badge-active text-[11px] flex items-center gap-1 !bg-orange-500/10 !text-orange-400 !border-orange-500/20">
                <Flame className="w-3 h-3" />
                {formLeader.streak.slice(1)} win streak
              </span>
            )}
            <div className="flex gap-0.5 ml-auto">
              {formLeader.recent_form.map((r, i) => (
                <span
                  key={i}
                  className={`w-2.5 h-2.5 rounded-full ${FORM_DOT[r] ?? "bg-gray-600"}`}
                  title={r}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Latest Result */}
      {latestGroup && (
        <div className="glass-card p-4">
          <div className="flex items-center gap-2 mb-3">
            <Swords className="w-4 h-4 text-green-400" />
            <h3 className="text-sm font-semibold text-gray-300">Latest Result</h3>
            <span className="text-xs text-gray-600 ml-auto">{latestGroup.label}</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex-1 text-right space-y-0.5">
              {latestGroup.teamA.map((p) => (
                <div key={p.player_id} className="text-sm text-gray-300">{p.player_name}</div>
              ))}
            </div>
            <div className="text-center font-bold text-lg text-green-400 px-3 shrink-0">
              {latestGroup.scoreA} - {latestGroup.scoreB}
            </div>
            <div className="flex-1 space-y-0.5">
              {latestGroup.teamB.map((p) => (
                <div key={p.player_id} className="text-sm text-gray-300">{p.player_name}</div>
              ))}
            </div>
          </div>
          <button
            onClick={() => onNavigate("history")}
            className="mt-3 text-xs text-gray-500 hover:text-green-400 transition-colors flex items-center gap-1"
          >
            View all history <ArrowRight className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* MoM Leader */}
      {momLeader && (
        <div className="glass-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <Star className="w-4 h-4 text-yellow-400" />
            <h3 className="text-sm font-semibold text-gray-300">MoM Leader</h3>
          </div>
          <div className="flex items-center gap-3">
            <span className="font-bold text-gray-100">{momLeader.player_name}</span>
            <span className="text-yellow-400 font-bold text-lg">{momLeader.total_awards}</span>
            <span className="text-xs text-gray-500">awards</span>
            <button
              onClick={() => onNavigate("mom")}
              className="ml-auto text-xs text-gray-500 hover:text-yellow-400 transition-colors flex items-center gap-1"
            >
              Leaderboard <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <div className="stat-card p-3 text-center">
      <div className="flex justify-center mb-1">{icon}</div>
      <div className="text-lg font-bold text-gray-100">{value}</div>
      <div className="text-[11px] text-gray-500 uppercase tracking-wider">{label}</div>
      {sub && <div className="text-xs text-gray-400 mt-0.5 truncate">{sub}</div>}
    </div>
  );
}

function findFormLeader(standings: LeagueRow[]): LeagueRow | null {
  if (standings.length === 0) return null;

  // Prefer longest win streak
  let best: LeagueRow | null = null;
  let bestStreakLen = 0;

  for (const row of standings) {
    if (row.streak.startsWith("W")) {
      const len = Number(row.streak.slice(1)) || 0;
      if (len > bestStreakLen) {
        bestStreakLen = len;
        best = row;
      }
    }
  }

  if (best) return best;

  // Fallback: best recent form (count wins in recent_form)
  let bestWins = 0;
  for (const row of standings) {
    const wins = row.recent_form.filter((r) => r === "W").length;
    if (wins > bestWins) {
      bestWins = wins;
      best = row;
    }
  }

  return best;
}

interface LatestGameGroup {
  label: string;
  scoreA: number;
  scoreB: number;
  teamA: { player_id: number; player_name: string }[];
  teamB: { player_id: number; player_name: string }[];
}

function groupLatestGame(
  games: { block_name: string; week_number: number; game_date: string | null; player_id: number; player_name: string; result: string; goals_for: number | null; goals_against: number | null }[]
): LatestGameGroup | null {
  if (games.length === 0) return null;

  // Group by date+week — first group is the latest
  const first = games[0];
  const groupKey = `${first.block_name}-${first.week_number}-${first.game_date}`;
  const group = games.filter(
    (g) => `${g.block_name}-${g.week_number}-${g.game_date}` === groupKey
  );

  if (group.length === 0) return null;

  const gf = first.goals_for;
  const ga = first.goals_against;

  const teamA = group.filter((g) => g.goals_for === gf && g.goals_against === ga);
  const teamB = group.filter((g) => !(g.goals_for === gf && g.goals_against === ga));

  return {
    label: `${first.block_name} Wk ${first.week_number}${first.game_date ? ` — ${first.game_date}` : ""}`,
    scoreA: gf ?? 0,
    scoreB: ga ?? 0,
    teamA: teamA.map((g) => ({ player_id: g.player_id, player_name: g.player_name })),
    teamB: teamB.map((g) => ({ player_id: g.player_id, player_name: g.player_name })),
  };
}
