import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { api, TeamPickerResult } from "../api/football";

export default function TeamPicker() {
  const { data: players, isLoading } = useQuery({
    queryKey: ["players"],
    queryFn: api.getPlayers,
  });
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [result, setResult] = useState<TeamPickerResult | null>(null);

  const mutation = useMutation({
    mutationFn: (ids: number[]) => api.pickTeams(ids),
    onSuccess: setResult,
  });

  if (isLoading) return <p className="text-gray-400">Loading players...</p>;
  if (!players) return null;

  const activePlayers = players.filter((p) => p.is_active);

  const toggle = (id: number) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else if (next.size < 12) next.add(id);
    setSelected(next);
    setResult(null);
  };

  const handlePick = () => {
    if (selected.size === 12) {
      mutation.mutate(Array.from(selected));
    }
  };

  return (
    <div>
      <h2 className="text-lg font-bold text-green-400 mb-3">Pick Teams</h2>
      <p className="text-sm text-gray-400 mb-4">
        Select 12 available players, then generate balanced 6v6 teams.
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 mb-4">
        {activePlayers.map((p) => (
          <button
            key={p.id}
            onClick={() => toggle(p.id)}
            className={`rounded-lg p-3 text-left text-sm transition-colors ${
              selected.has(p.id)
                ? "bg-green-800 border border-green-500"
                : "bg-gray-800 border border-gray-700 hover:border-gray-500"
            }`}
          >
            <div className="font-medium">{p.name}</div>
            <div className="text-xs text-gray-400">
              {p.win_rate}% win rate
            </div>
          </button>
        ))}
      </div>

      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={handlePick}
          disabled={selected.size !== 12 || mutation.isPending}
          className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-bold py-2 px-6 rounded-lg transition-colors"
        >
          {mutation.isPending ? "Picking..." : `Pick Teams (${selected.size}/12)`}
        </button>
        {selected.size > 0 && (
          <button
            onClick={() => {
              setSelected(new Set());
              setResult(null);
            }}
            className="text-sm text-gray-400 hover:text-white"
          >
            Clear
          </button>
        )}
      </div>

      {mutation.error && (
        <p className="text-red-400 mb-4">
          Error: {(mutation.error as Error).message}
        </p>
      )}

      {result && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <TeamCard
            title="Team A"
            players={result.team_a}
            strength={result.team_a_strength}
            color="green"
          />
          <TeamCard
            title="Team B"
            players={result.team_b}
            strength={result.team_b_strength}
            color="blue"
          />
          <div className="md:col-span-2 text-center text-sm text-gray-400">
            Balance score: {result.balance_score.toFixed(4)} (lower = more
            balanced)
          </div>
        </div>
      )}
    </div>
  );
}

function TeamCard({
  title,
  players,
  strength,
  color,
}: {
  title: string;
  players: { id: number; name: string; rating: number }[];
  strength: number;
  color: "green" | "blue";
}) {
  const accent = color === "green" ? "text-green-400" : "text-blue-400";
  const bg = color === "green" ? "bg-green-900/30" : "bg-blue-900/30";

  return (
    <div className={`${bg} rounded-xl p-4`}>
      <h3 className={`font-bold ${accent} mb-3`}>
        {title}{" "}
        <span className="text-sm font-normal text-gray-400">
          (strength: {strength.toFixed(3)})
        </span>
      </h3>
      <div className="space-y-2">
        {players
          .sort((a, b) => b.rating - a.rating)
          .map((p) => (
            <div
              key={p.id}
              className="flex justify-between items-center bg-gray-800/50 rounded px-3 py-2"
            >
              <span className="font-medium">{p.name}</span>
              <span className="text-sm text-gray-400">
                {(p.rating * 100).toFixed(1)}
              </span>
            </div>
          ))}
      </div>
    </div>
  );
}
