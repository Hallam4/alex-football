import { useQuery } from "@tanstack/react-query";
import { api } from "../api/football";

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

  if (isLoading) return <p className="text-gray-400">Loading player...</p>;
  if (error) return <p className="text-red-400">Error: {(error as Error).message}</p>;
  if (!data) return null;

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
