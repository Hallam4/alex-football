import { useQuery } from "@tanstack/react-query";
import { api } from "../api/football";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  PieChart, Pie, Cell,
  LineChart, Line,
  ResponsiveContainer,
} from "recharts";

const FORM_COLORS: Record<string, string> = {
  W: "bg-green-600",
  D: "bg-yellow-600",
  L: "bg-red-600",
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

  if (isLoading) return <p className="text-gray-400">Loading player...</p>;
  if (error) return <p className="text-red-400">Error: {(error as Error).message}</p>;
  if (!data) return null;

  // Compute rolling 6-game win rate from stats
  const rollingData = stats?.games
    ? stats.games.map((_, i, arr) => {
        const window = arr.slice(Math.max(0, i - 5), i + 1);
        const wins = window.filter((g) => g.result === "W").length;
        return { game: i + 1, winRate: Math.round((wins / window.length) * 100) };
      })
    : [];

  const pieData = data.total_games > 0
    ? [
        { name: "Wins", value: data.total_wins, color: "#22c55e" },
        { name: "Draws", value: data.total_draws, color: "#eab308" },
        { name: "Losses", value: data.total_losses, color: "#ef4444" },
      ]
    : [];

  return (
    <div>
      <button
        onClick={onBack}
        className="text-sm text-gray-400 hover:text-white mb-4 inline-block"
      >
        &larr; Back to players
      </button>

      <div className="bg-gray-800 rounded-xl p-5 mb-4">
        <div className="flex items-center gap-3 mb-4">
          <h2 className="text-2xl font-bold text-green-400">{data.name}</h2>
          {data.is_active && (
            <span className="text-xs bg-green-900 text-green-300 px-2 py-0.5 rounded-full">
              Active
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
          {[
            { label: "Games", value: data.total_games },
            { label: "Wins", value: data.total_wins },
            { label: "Win Rate", value: `${data.win_rate}%` },
            { label: "Blocks", value: data.blocks_played },
          ].map((s) => (
            <div key={s.label} className="bg-gray-700 rounded-lg p-3">
              <div className="text-2xl font-bold">{s.value}</div>
              <div className="text-xs text-gray-400">{s.label}</div>
            </div>
          ))}
        </div>

        {data.first_game_date && (
          <p className="text-sm text-gray-400 mt-3">
            Playing since {data.first_game_date}
          </p>
        )}
      </div>

      {data.recent_form.length > 0 && (
        <div className="bg-gray-800 rounded-xl p-5 mb-4">
          <h3 className="text-sm font-semibold text-gray-400 mb-2">
            Recent Form (last {data.recent_form.length})
          </h3>
          <div className="flex gap-2">
            {data.recent_form.map((r, i) => (
              <span
                key={i}
                className={`w-8 h-8 rounded flex items-center justify-center text-sm font-bold ${
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
        <div className="bg-gray-800 rounded-xl p-5 mb-4">
          <h3 className="text-sm font-semibold text-gray-400 mb-4">Performance Charts</h3>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {stats.blocks.length > 0 && (
              <div>
                <p className="text-xs text-gray-400 mb-2 text-center">Win Rate by Block</p>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={stats.blocks}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="block_name" tick={{ fill: "#9ca3af", fontSize: 11 }} />
                    <YAxis tick={{ fill: "#9ca3af", fontSize: 11 }} domain={[0, 100]} />
                    <Tooltip
                      contentStyle={{ backgroundColor: "#1f2937", border: "1px solid #374151" }}
                      labelStyle={{ color: "#9ca3af" }}
                    />
                    <Bar dataKey="win_rate" fill="#22c55e" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {pieData.length > 0 && (
              <div>
                <p className="text-xs text-gray-400 mb-2 text-center">W/D/L Distribution</p>
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
                    <Tooltip
                      contentStyle={{ backgroundColor: "#1f2937", border: "1px solid #374151" }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex justify-center gap-4 text-xs mt-1">
                  {pieData.map((d) => (
                    <span key={d.name} className="flex items-center gap-1">
                      <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: d.color }} />
                      {d.name} ({d.value})
                    </span>
                  ))}
                </div>
              </div>
            )}

            {rollingData.length > 1 && (
              <div>
                <p className="text-xs text-gray-400 mb-2 text-center">Rolling Form (6-game win %)</p>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={rollingData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="game" tick={{ fill: "#9ca3af", fontSize: 11 }} />
                    <YAxis tick={{ fill: "#9ca3af", fontSize: 11 }} domain={[0, 100]} />
                    <Tooltip
                      contentStyle={{ backgroundColor: "#1f2937", border: "1px solid #374151" }}
                      labelStyle={{ color: "#9ca3af" }}
                    />
                    <Line type="monotone" dataKey="winRate" stroke="#22c55e" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>
      )}

      {data.head_to_head.length > 0 && (
        <div className="bg-gray-800 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-gray-400 mb-3">
            Head-to-Head (same team synergy)
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-400 border-b border-gray-700">
                  <th className="px-2 py-2 text-left">Partner</th>
                  <th className="px-2 py-2 text-right">Played</th>
                  <th className="px-2 py-2 text-right">W</th>
                  <th className="px-2 py-2 text-right">D</th>
                  <th className="px-2 py-2 text-right">L</th>
                  <th className="px-2 py-2 text-right">Win%</th>
                </tr>
              </thead>
              <tbody>
                {data.head_to_head.map((h) => (
                  <tr
                    key={h.opponent_id}
                    className="border-b border-gray-700/50"
                  >
                    <td className="px-2 py-2">{h.opponent_name}</td>
                    <td className="px-2 py-2 text-right">{h.played}</td>
                    <td className="px-2 py-2 text-right text-green-400">
                      {h.wins}
                    </td>
                    <td className="px-2 py-2 text-right text-yellow-400">
                      {h.draws}
                    </td>
                    <td className="px-2 py-2 text-right text-red-400">
                      {h.losses}
                    </td>
                    <td className="px-2 py-2 text-right font-semibold">
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
