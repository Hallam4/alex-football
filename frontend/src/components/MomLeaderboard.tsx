import { useQuery } from "@tanstack/react-query";
import { api } from "../api/football";

export default function MomLeaderboard() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["mom"],
    queryFn: api.getMom,
  });

  if (isLoading) return <p className="text-gray-400">Loading MoM data...</p>;
  if (error) return <p className="text-red-400">Error: {(error as Error).message}</p>;
  if (!data || data.leaderboard.length === 0)
    return <p className="text-gray-400">No MoM awards recorded yet.</p>;

  return (
    <div>
      <h2 className="text-lg font-bold text-green-400 mb-3">
        Man of the Match
      </h2>

      <div className="overflow-x-auto">
        <table className="w-full text-sm max-w-lg">
          <thead>
            <tr className="text-gray-400 border-b border-gray-700">
              <th className="px-2 py-2 text-left w-8">#</th>
              <th className="px-2 py-2 text-left">Player</th>
              <th className="px-2 py-2 text-right">Awards</th>
              <th className="px-2 py-2 text-right">Votes</th>
            </tr>
          </thead>
          <tbody>
            {data.leaderboard.map((m, i) => (
              <tr key={m.player_id} className="border-b border-gray-800">
                <td className="px-2 py-2 text-gray-400">{i + 1}</td>
                <td className="px-2 py-2 font-medium">{m.player_name}</td>
                <td className="px-2 py-2 text-right font-semibold text-yellow-400">
                  {m.total_awards}
                </td>
                <td className="px-2 py-2 text-right text-gray-400">
                  {m.total_votes}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
