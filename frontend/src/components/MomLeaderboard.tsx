import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Star, Award } from "lucide-react";
import { api } from "../api/football";

const MEDAL_STYLES: Record<number, { bg: string; ring: string; icon: string }> = {
  0: { bg: "from-yellow-500/[0.12] to-yellow-600/[0.04]", ring: "ring-2 ring-yellow-500/30 shadow-[0_0_20px_rgba(234,179,8,0.15)]", icon: "text-yellow-400" },
  1: { bg: "from-gray-300/[0.08] to-gray-400/[0.02]", ring: "", icon: "text-gray-400" },
  2: { bg: "from-amber-700/[0.10] to-amber-800/[0.03]", ring: "", icon: "text-amber-600" },
};

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

  if (isLoading) {
    return (
      <div className="animate-slide-up space-y-4">
        <div className="skeleton h-6 w-48" />
        <div className="grid grid-cols-3 gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="skeleton h-24" />
          ))}
        </div>
        <div className="skeleton h-40 w-full" />
      </div>
    );
  }
  if (error) return <p className="text-red-400">Error: {(error as Error).message}</p>;
  if (!data || data.leaderboard.length === 0)
    return (
      <div className="animate-slide-up">
        <div className="flex items-center gap-2 mb-4">
          <Star className="w-5 h-5 text-yellow-400" />
          <h2 className="text-lg font-bold text-yellow-400">Man of the Match</h2>
        </div>
        <p className="text-gray-500 mb-3">No MoM awards recorded yet.</p>
        <button
          onClick={() => setShowAwardForm(!showAwardForm)}
          className="flex items-center gap-1.5 text-xs bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 px-3 py-1.5 rounded-xl hover:bg-yellow-500/15 transition-all"
        >
          <Award className="w-3.5 h-3.5" />
          Award MoM
        </button>
        {showAwardForm && renderAwardForm()}
      </div>
    );

  const top3 = data.leaderboard.slice(0, 3);

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
          className="select-glass !focus:ring-yellow-500/40 !focus:border-yellow-500/40"
        >
          <option value="">Block</option>
          {blocks?.map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
        <select
          value={awardPlayerId}
          onChange={(e) => setAwardPlayerId(e.target.value)}
          className="select-glass !focus:ring-yellow-500/40 !focus:border-yellow-500/40"
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
          className="input-glass w-20"
        />
        <input
          type="date"
          value={awardDate}
          onChange={(e) => setAwardDate(e.target.value)}
          className="input-glass"
        />
        <input
          type="number"
          placeholder="Votes"
          value={awardVotes}
          onChange={(e) => setAwardVotes(e.target.value)}
          className="input-glass w-20"
        />
        <button
          type="submit"
          disabled={awardMutation.isPending || !awardBlockId || !awardPlayerId || !awardWeek || !awardDate}
          className="bg-gradient-to-r from-yellow-600 to-amber-600 text-white font-semibold px-5 py-2 rounded-xl hover:brightness-110 disabled:opacity-50 transition-all text-sm"
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
    <div className="animate-slide-up">
      <div className="flex items-center gap-2 mb-4">
        <Star className="w-5 h-5 text-yellow-400" />
        <h2 className="text-lg font-bold text-yellow-400">Man of the Match</h2>
      </div>

      {/* Top 3 Podium */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {top3.map((m, i) => {
          const style = MEDAL_STYLES[i] ?? {};
          return (
            <div
              key={m.player_id}
              className={`stat-card p-4 text-center bg-gradient-to-br ${style.bg} ${style.ring}`}
            >
              <Award className={`w-6 h-6 mx-auto mb-1 ${style.icon}`} />
              <div className="font-bold text-sm">{m.player_name}</div>
              <div className="text-2xl font-bold text-yellow-400 mt-1">{m.total_awards}</div>
              <div className="text-[11px] uppercase tracking-wider text-gray-500">awards</div>
            </div>
          );
        })}
      </div>

      {/* Full table */}
      <div className="glass-card p-5 mb-4">
        <div className="overflow-x-auto">
          <table className="w-full text-sm table-premium max-w-lg">
            <thead>
              <tr>
                <th className="px-2 py-2.5 text-left w-8">#</th>
                <th className="px-2 py-2.5 text-left">Player</th>
                <th className="px-2 py-2.5 text-right">Awards</th>
                <th className="px-2 py-2.5 text-right">Votes</th>
              </tr>
            </thead>
            <tbody>
              {data.leaderboard.map((m, i) => (
                <tr key={m.player_id}>
                  <td className="px-2 py-2.5 text-gray-500">{i + 1}</td>
                  <td className="px-2 py-2.5 font-medium">{m.player_name}</td>
                  <td className="px-2 py-2.5 text-right font-bold text-yellow-400">
                    {m.total_awards}
                  </td>
                  <td className="px-2 py-2.5 text-right text-gray-500">
                    {m.total_votes}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <button
        onClick={() => setShowAwardForm(!showAwardForm)}
        className="flex items-center gap-1.5 text-xs bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 px-3 py-1.5 rounded-xl hover:bg-yellow-500/15 transition-all"
      >
        <Award className="w-3.5 h-3.5" />
        Award MoM
      </button>
      {showAwardForm && renderAwardForm()}
    </div>
  );
}
