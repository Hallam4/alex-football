import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Award, Flame, Target, Shield, Users, Star, Crown, Zap, Trophy as TrophyIcon } from "lucide-react";
import { api, Achievement } from "../api/football";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  PieChart, Pie, Cell,
  LineChart, Line,
  ResponsiveContainer,
} from "recharts";

const FORM_COLORS: Record<string, string> = {
  W: "bg-gradient-to-br from-green-500 to-green-700",
  D: "bg-gradient-to-br from-yellow-500 to-yellow-700",
  L: "bg-gradient-to-br from-red-500 to-red-700",
};

const tooltipStyle = {
  backgroundColor: "rgba(0,0,0,0.7)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: "12px",
  backdropFilter: "blur(12px)",
};

export default function PlayerProfile({
  playerId,
  onBack,
}: {
  playerId: number;
  onBack: () => void;
}) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["player", playerId],
    queryFn: () => api.getPlayer(playerId),
  });

  const { data: stats } = useQuery({
    queryKey: ["playerStats", playerId],
    queryFn: () => api.getPlayerStats(playerId),
    enabled: !!data,
  });

  const { data: achievementsData } = useQuery({
    queryKey: ["achievements", playerId],
    queryFn: () => api.getAchievements(playerId),
    enabled: !!data,
  });

  if (isLoading) {
    return (
      <div className="animate-slide-up space-y-4">
        <div className="skeleton h-6 w-32" />
        <div className="skeleton h-40 w-full" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skeleton h-20" />
          ))}
        </div>
      </div>
    );
  }
  if (error) return <p className="text-red-400">Error: {(error as Error).message}</p>;
  if (!data) return null;

  // Compute rolling 6-game win rate from stats
  const rollingData = useMemo(() =>
    stats?.games
      ? stats.games.map((_, i, arr) => {
          const window = arr.slice(Math.max(0, i - 5), i + 1);
          const wins = window.filter((g) => g.result === "W").length;
          return { game: i + 1, winRate: Math.round((wins / window.length) * 100) };
        })
      : [],
    [stats]
  );

  const pieData = useMemo(() =>
    data.total_games > 0
      ? [
          { name: "Wins", value: data.total_wins, color: "#22c55e" },
          { name: "Draws", value: data.total_draws, color: "#eab308" },
          { name: "Losses", value: data.total_losses, color: "#ef4444" },
        ]
      : [],
    [data]
  );

  return (
    <div className="animate-slide-up">
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-white mb-4 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to players
      </button>

      {/* Hero Card */}
      <div className="glass-card overflow-hidden mb-4">
        <div className="h-1 bg-gradient-to-r from-green-500 to-emerald-400" />
        <div className="p-5">
          <div className="flex items-center gap-4 mb-5">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center text-xl font-bold text-white shadow-glow-sm">
              {data.name.charAt(0)}
            </div>
            <div>
              <h2 className="text-2xl font-bold bg-gradient-to-r from-green-400 to-emerald-300 bg-clip-text text-transparent">
                {data.name}
              </h2>
              <div className="flex items-center gap-2 mt-0.5">
                {data.is_active && <span className="badge-active">Active</span>}
                {data.first_game_date && (
                  <span className="text-xs text-gray-500">
                    Playing since {data.first_game_date}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Games", value: data.total_games },
              { label: "Wins", value: data.total_wins },
              { label: "Win Rate", value: `${data.win_rate}%` },
              { label: "Blocks", value: data.blocks_played },
            ].map((s) => (
              <div key={s.label} className="stat-card p-4 text-center">
                <div className="relative text-2xl font-bold bg-gradient-to-r from-green-400 to-emerald-300 bg-clip-text text-transparent">
                  {s.value}
                </div>
                <div className="relative text-[11px] uppercase tracking-wider text-gray-500 mt-1">
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {achievementsData && achievementsData.achievements.length > 0 && (
        <div className="glass-card p-5 mb-4">
          <h3 className="text-xs uppercase tracking-wider font-semibold text-gray-500 mb-3">
            Achievements
          </h3>
          <div className="flex flex-wrap gap-2">
            {achievementsData.achievements.map((a) => (
              <AchievementBadge key={a.id} achievement={a} />
            ))}
          </div>
        </div>
      )}

      {data.recent_form.length > 0 && (
        <div className="glass-card p-5 mb-4">
          <h3 className="text-xs uppercase tracking-wider font-semibold text-gray-500 mb-3">
            Recent Form (last {data.recent_form.length})
          </h3>
          <div className="flex gap-2">
            {data.recent_form.map((r, i) => (
              <span
                key={i}
                className={`w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold text-white hover:scale-110 transition-transform ${
                  FORM_COLORS[r] ?? "bg-gray-600"
                }`}
              >
                {r}
              </span>
            ))}
          </div>
        </div>
      )}

      {stats && (stats.blocks.length > 0 || data.total_games > 0) && (
        <div className="glass-card p-5 mb-4">
          <h3 className="text-xs uppercase tracking-wider font-semibold text-gray-500 mb-4">
            Performance Charts
          </h3>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {stats.blocks.length > 0 && (
              <div>
                <p className="text-xs text-gray-500 mb-2 text-center">Win Rate by Block</p>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={stats.blocks}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                    <XAxis dataKey="block_name" tick={{ fill: "#6b7280", fontSize: 11 }} />
                    <YAxis tick={{ fill: "#6b7280", fontSize: 11 }} domain={[0, 100]} />
                    <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: "#9ca3af" }} />
                    <Bar dataKey="win_rate" fill="#22c55e" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {pieData.length > 0 && (
              <div>
                <p className="text-xs text-gray-500 mb-2 text-center">W/D/L Distribution</p>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={80}
                      paddingAngle={2}
                    >
                      {pieData.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex justify-center gap-4 text-xs mt-1">
                  {pieData.map((d) => (
                    <span key={d.name} className="flex items-center gap-1 text-gray-400">
                      <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: d.color }} />
                      {d.name} ({d.value})
                    </span>
                  ))}
                </div>
              </div>
            )}

            {rollingData.length > 1 && (
              <div>
                <p className="text-xs text-gray-500 mb-2 text-center">Rolling Form (6-game win %)</p>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={rollingData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                    <XAxis dataKey="game" tick={{ fill: "#6b7280", fontSize: 11 }} />
                    <YAxis tick={{ fill: "#6b7280", fontSize: 11 }} domain={[0, 100]} />
                    <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: "#9ca3af" }} />
                    <Line type="monotone" dataKey="winRate" stroke="#22c55e" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>
      )}

      {data.head_to_head.length > 0 && (
        <div className="glass-card p-5">
          <h3 className="text-xs uppercase tracking-wider font-semibold text-gray-500 mb-3">
            Head-to-Head (same team synergy)
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm table-premium">
              <thead>
                <tr>
                  <th className="px-2 py-2.5 text-left">Partner</th>
                  <th className="px-2 py-2.5 text-right">Played</th>
                  <th className="px-2 py-2.5 text-right">W</th>
                  <th className="px-2 py-2.5 text-right">D</th>
                  <th className="px-2 py-2.5 text-right">L</th>
                  <th className="px-2 py-2.5 text-right">Win%</th>
                </tr>
              </thead>
              <tbody>
                {data.head_to_head.map((h) => (
                  <tr key={h.opponent_id}>
                    <td className="px-2 py-2.5">{h.opponent_name}</td>
                    <td className="px-2 py-2.5 text-right text-gray-400">{h.played}</td>
                    <td className="px-2 py-2.5 text-right text-green-400">
                      {h.wins}
                    </td>
                    <td className="px-2 py-2.5 text-right text-yellow-400">
                      {h.draws}
                    </td>
                    <td className="px-2 py-2.5 text-right text-red-400">
                      {h.losses}
                    </td>
                    <td className="px-2 py-2.5 text-right font-semibold">
                      {h.played > 0
                        ? ((h.wins / h.played) * 100).toFixed(0)
                        : 0}
                      %
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

const ACHIEVEMENT_ICONS: Record<string, typeof Award> = {
  century: TrophyIcon,
  half_century: TrophyIcon,
  win_machine: Target,
  sharp_shooter: Target,
  hot_streak: Flame,
  comeback_kid: Zap,
  veteran: Shield,
  perfect_block: Crown,
  synergy_master: Users,
  fan_favorite: Star,
  og: Award,
};

const ACHIEVEMENT_COLORS: Record<string, string> = {
  century: "from-yellow-500/20 to-yellow-600/5 border-yellow-500/20 text-yellow-400",
  half_century: "from-gray-400/15 to-gray-500/5 border-gray-400/20 text-gray-300",
  win_machine: "from-green-500/20 to-green-600/5 border-green-500/20 text-green-400",
  sharp_shooter: "from-green-500/20 to-green-600/5 border-green-500/20 text-green-400",
  hot_streak: "from-orange-500/20 to-orange-600/5 border-orange-500/20 text-orange-400",
  comeback_kid: "from-purple-500/20 to-purple-600/5 border-purple-500/20 text-purple-400",
  veteran: "from-blue-500/20 to-blue-600/5 border-blue-500/20 text-blue-400",
  perfect_block: "from-yellow-500/20 to-yellow-600/5 border-yellow-500/20 text-yellow-400",
  synergy_master: "from-cyan-500/20 to-cyan-600/5 border-cyan-500/20 text-cyan-400",
  fan_favorite: "from-yellow-500/20 to-yellow-600/5 border-yellow-500/20 text-yellow-400",
  og: "from-emerald-500/20 to-emerald-600/5 border-emerald-500/20 text-emerald-400",
};

function AchievementBadge({ achievement }: { achievement: Achievement }) {
  const Icon = ACHIEVEMENT_ICONS[achievement.id] ?? Award;
  const color = ACHIEVEMENT_COLORS[achievement.id] ?? "from-gray-500/20 to-gray-600/5 border-gray-500/20 text-gray-400";

  return (
    <div
      className={`flex items-center gap-2 px-3 py-2 rounded-xl bg-gradient-to-r border text-xs font-medium ${color}`}
      title={achievement.description}
    >
      <Icon className="w-3.5 h-3.5 flex-shrink-0" />
      <span>{achievement.name}</span>
    </div>
  );
}
