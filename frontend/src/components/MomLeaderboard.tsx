import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/football";

export default function MomLeaderboard() {
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ["mom"],
    queryFn: api.getMom,
  });
  const { data: blocks } = useQuery({
    queryKey: ["blocks"],
    queryFn: api.getBlocks,
  });
  const { data: players } = useQuery({
    queryKey: ["players"],
    queryFn: api.getPlayers,
  });

  const [showAwardForm, setShowAwardForm] = useState(false);
  const [awardBlockId, setAwardBlockId] = useState("");
  const [awardPlayerId, setAwardPlayerId] = useState("");
  const [awardWeek, setAwardWeek] = useState("");
  const [awardDate, setAwardDate] = useState("");
  const [awardVotes, setAwardVotes] = useState("");

  const awardMutation = useMutation({
    mutationFn: api.awardMom,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mom"] });
      queryClient.invalidateQueries({ queryKey: ["league"] });
      setAwardBlockId("");
      setAwardPlayerId("");
      setAwardWeek("");
      setAwardDate("");
      setAwardVotes("");
      setShowAwardForm(false);
    },
  });

  if (isLoading) return <p className="text-gray-400">Loading MoM data...</p>;
  if (error) return <p className="text-red-400">Error: {(error as Error).message}</p>;
  if (!data || data.leaderboard.length === 0)
    return (
      <div>
        <p className="text-gray-400 mb-3">No MoM awards recorded yet.</p>
        <button
          onClick={() => setShowAwardForm(!showAwardForm)}
          className="text-xs bg-yellow-900/50 hover:bg-yellow-800 text-yellow-300 px-2 py-1 rounded transition-colors"
        >
          Award MoM
        </button>
        {showAwardForm && renderAwardForm()}
      </div>
    );

  function renderAwardForm() {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (awardBlockId && awardPlayerId && awardWeek && awardDate) {
            awardMutation.mutate({
              block_id: Number(awardBlockId),
              player_id: Number(awardPlayerId),
              week_number: Number(awardWeek),
              game_date: awardDate,
              votes: awardVotes ? Number(awardVotes) : 0,
            });
          }
        }}
        className="flex gap-2 mt-3 flex-wrap"
      >
        <select
          value={awardBlockId}
          onChange={(e) => setAwardBlockId(e.target.value)}
          className="bg-gray-800 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-yellow-500"
        >
          <option value="">Block</option>
          {blocks?.map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
        <select
          value={awardPlayerId}
          onChange={(e) => setAwardPlayerId(e.target.value)}
          className="bg-gray-800 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-yellow-500"
        >
          <option value="">Player</option>
          {players?.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <input
          type="number"
          placeholder="Week"
          value={awardWeek}
          onChange={(e) => setAwardWeek(e.target.value)}
          className="bg-gray-800 text-white rounded-lg px-3 py-2 text-sm w-20 focus:outline-none focus:ring-1 focus:ring-yellow-500"
        />
        <input
          type="date"
          value={awardDate}
          onChange={(e) => setAwardDate(e.target.value)}
          className="bg-gray-800 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-yellow-500"
        />
        <input
          type="number"
          placeholder="Votes"
          value={awardVotes}
          onChange={(e) => setAwardVotes(e.target.value)}
          className="bg-gray-800 text-white rounded-lg px-3 py-2 text-sm w-20 focus:outline-none focus:ring-1 focus:ring-yellow-500"
        />
        <button
          type="submit"
          disabled={awardMutation.isPending || !awardBlockId || !awardPlayerId || !awardWeek || !awardDate}
          className="text-sm bg-yellow-700 hover:bg-yellow-600 disabled:opacity-50 text-white px-3 py-2 rounded transition-colors"
        >
          {awardMutation.isPending ? "Awarding..." : "Award"}
        </button>
        {awardMutation.isError && (
          <span className="text-red-400 text-sm self-center">
            {(awardMutation.error as Error).message}
          </span>
        )}
      </form>
    );
  }

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

      <button
        onClick={() => setShowAwardForm(!showAwardForm)}
        className="text-xs bg-yellow-900/50 hover:bg-yellow-800 text-yellow-300 px-2 py-1 rounded transition-colors mt-3"
      >
        Award MoM
      </button>
      {showAwardForm && renderAwardForm()}
    </div>
  );
}
