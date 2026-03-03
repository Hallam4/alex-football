import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, TeamPickerResult, GameEntryPlayer } from "../api/football";

export default function TeamPicker() {
  const queryClient = useQueryClient();
  const { data: players, isLoading } = useQuery({
    queryKey: ["players"],
    queryFn: api.getPlayers,
  });
  const { data: blocks } = useQuery({
    queryKey: ["blocks"],
    queryFn: api.getBlocks,
  });
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [result, setResult] = useState<TeamPickerResult | null>(null);

  // Log Game state
  const [showLogGame, setShowLogGame] = useState(false);
  const [blockId, setBlockId] = useState<number | "">("");
  const [weekNumber, setWeekNumber] = useState<number | "">("");
  const [gameDate, setGameDate] = useState("");
  const [scoreA, setScoreA] = useState<number | "">("");
  const [scoreB, setScoreB] = useState<number | "">("");

  const recalcMutation = useMutation({
    mutationFn: (bId: number) => api.recalculateStandings(bId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["league"] }),
  });

  const gameEntryMutation = useMutation({
    mutationFn: (req: { block_id: number; week_number: number; game_date: string; players: GameEntryPlayer[] }) =>
      api.addGame(req),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["games"] });
      queryClient.invalidateQueries({ queryKey: ["league"] });
      if (typeof blockId === "number") {
        recalcMutation.mutate(blockId);
      }
    },
  });

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

      {result && (
        <div className="mt-6">
          <button
            onClick={() => setShowLogGame(!showLogGame)}
            className="text-sm text-gray-400 hover:text-white flex items-center gap-1"
          >
            {showLogGame ? "\u25BC" : "\u25B6"} Log Game
          </button>

          {showLogGame && (
            <div className="bg-gray-800 rounded-xl p-5 mt-2">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Block</label>
                  <select
                    value={blockId}
                    onChange={(e) => setBlockId(e.target.value ? Number(e.target.value) : "")}
                    className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-sm"
                  >
                    <option value="">Select block</option>
                    {blocks?.map((b) => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Week</label>
                  <input
                    type="number"
                    min={1}
                    value={weekNumber}
                    onChange={(e) => setWeekNumber(e.target.value ? Number(e.target.value) : "")}
                    className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-sm"
                    placeholder="1"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Date</label>
                  <input
                    type="date"
                    value={gameDate}
                    onChange={(e) => setGameDate(e.target.value)}
                    className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-sm"
                  />
                </div>
                <div className="flex gap-2 items-end">
                  <div className="flex-1">
                    <label className="block text-xs text-gray-400 mb-1">A</label>
                    <input
                      type="number"
                      min={0}
                      value={scoreA}
                      onChange={(e) => setScoreA(e.target.value ? Number(e.target.value) : "")}
                      className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-sm"
                      placeholder="0"
                    />
                  </div>
                  <span className="text-gray-400 pb-1.5">-</span>
                  <div className="flex-1">
                    <label className="block text-xs text-gray-400 mb-1">B</label>
                    <input
                      type="number"
                      min={0}
                      value={scoreB}
                      onChange={(e) => setScoreB(e.target.value ? Number(e.target.value) : "")}
                      className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-sm"
                      placeholder="0"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  disabled={
                    blockId === "" ||
                    weekNumber === "" ||
                    !gameDate ||
                    scoreA === "" ||
                    scoreB === "" ||
                    gameEntryMutation.isPending
                  }
                  onClick={() => {
                    if (
                      typeof blockId !== "number" ||
                      typeof weekNumber !== "number" ||
                      typeof scoreA !== "number" ||
                      typeof scoreB !== "number"
                    )
                      return;

                    const resultA = scoreA > scoreB ? "W" : scoreA < scoreB ? "L" : "D";
                    const resultB = scoreB > scoreA ? "W" : scoreB < scoreA ? "L" : "D";

                    const entryPlayers: GameEntryPlayer[] = [
                      ...result.team_a.map((p) => ({
                        player_id: p.id,
                        result: resultA,
                        goals_for: scoreA,
                        goals_against: scoreB,
                      })),
                      ...result.team_b.map((p) => ({
                        player_id: p.id,
                        result: resultB,
                        goals_for: scoreB,
                        goals_against: scoreA,
                      })),
                    ];

                    gameEntryMutation.mutate({
                      block_id: blockId,
                      week_number: weekNumber,
                      game_date: gameDate,
                      players: entryPlayers,
                    });
                  }}
                  className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-bold py-2 px-6 rounded-lg transition-colors text-sm"
                >
                  {gameEntryMutation.isPending ? "Saving..." : "Save Game"}
                </button>
                {gameEntryMutation.isSuccess && (
                  <span className="text-green-400 text-sm">Game saved & standings recalculated</span>
                )}
                {gameEntryMutation.isError && (
                  <span className="text-red-400 text-sm">
                    Error: {(gameEntryMutation.error as Error).message}
                  </span>
                )}
              </div>
            </div>
          )}
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
