import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  api,
  TeamPickerResult,
  GameEntryPlayer,
  CreateDraftResponse,
} from "../api/football";
import { DraftShareLinks, DraftBoard } from "./SnakeDraft";

type Phase = "pick" | "saved" | "draftLinks" | "draftBoard";

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

  // Phase 1: player selection
  const [selected, setSelected] = useState<Set<number>>(new Set());
  // Phase 2: saved pool
  const [savedIds, setSavedIds] = useState<number[] | null>(null);
  // Auto Pick
  const [autoPickResult, setAutoPickResult] = useState<TeamPickerResult | null>(null);
  // Snake Draft
  const [captainAId, setCaptainAId] = useState<number | null>(null);
  const [captainBId, setCaptainBId] = useState<number | null>(null);
  const [draftInfo, setDraftInfo] = useState<CreateDraftResponse | null>(null);
  // Draft board (from URL params or from joining)
  const [liveCode, setLiveCode] = useState<string | null>(null);
  const [liveToken, setLiveToken] = useState<string | null>(null);

  // Log Game state
  const [showLogGame, setShowLogGame] = useState(false);
  const [blockId, setBlockId] = useState<number | "">("");
  const [weekNumber, setWeekNumber] = useState<number | "">("");
  const [gameDate, setGameDate] = useState("");
  const [scoreA, setScoreA] = useState<number | "">("");
  const [scoreB, setScoreB] = useState<number | "">("");

  // Detect ?draft=...&token=... URL params on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("draft");
    const token = params.get("token");
    if (code && token) {
      setLiveCode(code);
      setLiveToken(token);
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  const recalcMutation = useMutation({
    mutationFn: (bId: number) => api.recalculateStandings(bId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["league"] }),
  });

  const gameEntryMutation = useMutation({
    mutationFn: (req: {
      block_id: number;
      week_number: number;
      game_date: string;
      players: GameEntryPlayer[];
    }) => api.addGame(req),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["games"] });
      queryClient.invalidateQueries({ queryKey: ["league"] });
      if (typeof blockId === "number") {
        recalcMutation.mutate(blockId);
      }
    },
  });

  const pickMutation = useMutation({
    mutationFn: (ids: number[]) => api.pickTeams(ids),
    onSuccess: setAutoPickResult,
  });

  const draftMutation = useMutation({
    mutationFn: () =>
      api.createDraft({
        captain_a_id: captainAId!,
        captain_b_id: captainBId!,
        player_ids: savedIds!,
      }),
    onSuccess: (data) => {
      setDraftInfo(data);
    },
  });

  // Determine current phase
  let phase: Phase = "pick";
  if (liveCode && liveToken) {
    phase = "draftBoard";
  } else if (draftInfo) {
    phase = "draftLinks";
  } else if (savedIds) {
    phase = "saved";
  }

  if (isLoading) return <p className="text-gray-400">Loading players...</p>;
  if (!players) return null;

  const activePlayers = players.filter((p) => p.is_active);

  const toggle = (id: number) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else if (next.size < 12) next.add(id);
    setSelected(next);
  };

  const handleSave = () => {
    if (selected.size === 12) {
      setSavedIds(Array.from(selected));
      setAutoPickResult(null);
      setCaptainAId(null);
      setCaptainBId(null);
      setDraftInfo(null);
    }
  };

  const handleEdit = () => {
    setSavedIds(null);
    setAutoPickResult(null);
    setCaptainAId(null);
    setCaptainBId(null);
    setDraftInfo(null);
    setShowLogGame(false);
  };

  const handleDraftBack = () => {
    setLiveCode(null);
    setLiveToken(null);
    setDraftInfo(null);
  };

  const savedPlayers = savedIds
    ? players.filter((p) => savedIds.includes(p.id))
    : [];
  const canCreateDraft =
    savedIds && captainAId !== null && captainBId !== null;

  // --- Phase: Draft Board ---
  if (phase === "draftBoard") {
    return <DraftBoard code={liveCode!} token={liveToken!} onBack={handleDraftBack} />;
  }

  // --- Phase: Draft Share Links ---
  if (phase === "draftLinks") {
    return (
      <DraftShareLinks
        draft={draftInfo!}
        onJoin={(code, token) => {
          setLiveCode(code);
          setLiveToken(token);
        }}
        onBack={handleDraftBack}
      />
    );
  }

  // --- Phase: Saved Pool ---
  if (phase === "saved") {
    return (
      <div>
        <h2 className="text-lg font-bold text-green-400 mb-3">Pick Teams</h2>

        {/* Saved players summary */}
        <div className="mb-4">
          <div className="flex items-center gap-3 mb-2">
            <h3 className="text-sm font-medium text-gray-300">
              Players ({savedPlayers.length})
            </h3>
            <button
              onClick={handleEdit}
              className="text-sm text-gray-400 hover:text-white transition-colors"
            >
              Edit Players
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {savedPlayers.map((p) => (
              <span
                key={p.id}
                className="bg-gray-800 border border-gray-700 rounded-full px-3 py-1 text-sm text-gray-300"
              >
                {p.name}
              </span>
            ))}
          </div>
        </div>

        {/* Auto Pick section */}
        <div className="bg-gray-800/50 rounded-xl p-4 mb-4">
          <h3 className="text-sm font-bold text-green-400 mb-2">Auto Pick</h3>
          <p className="text-xs text-gray-400 mb-3">
            Generate balanced 6v6 teams automatically.
          </p>
          <button
            onClick={() => pickMutation.mutate(savedIds!)}
            disabled={pickMutation.isPending}
            className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-bold py-2 px-6 rounded-lg transition-colors text-sm"
          >
            {pickMutation.isPending ? "Picking..." : "Auto Pick"}
          </button>
          {pickMutation.error && (
            <p className="text-red-400 mt-2 text-sm">
              Error: {(pickMutation.error as Error).message}
            </p>
          )}
        </div>

        {autoPickResult && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <TeamCard
                title="Team A"
                players={autoPickResult.team_a}
                strength={autoPickResult.team_a_strength}
                color="green"
              />
              <TeamCard
                title="Team B"
                players={autoPickResult.team_b}
                strength={autoPickResult.team_b_strength}
                color="blue"
              />
              <div className="md:col-span-2 text-center text-sm text-gray-400">
                Balance score: {autoPickResult.balance_score.toFixed(4)} (lower =
                more balanced)
              </div>
            </div>

            {/* Log Game */}
            <div className="mt-6">
              <button
                onClick={() => setShowLogGame(!showLogGame)}
                className="text-sm text-gray-400 hover:text-white flex items-center gap-1"
              >
                {showLogGame ? "\u25BC" : "\u25B6"} Log Game
              </button>

              {showLogGame && (
                <LogGameForm
                  blocks={blocks ?? []}
                  blockId={blockId}
                  setBlockId={setBlockId}
                  weekNumber={weekNumber}
                  setWeekNumber={setWeekNumber}
                  gameDate={gameDate}
                  setGameDate={setGameDate}
                  scoreA={scoreA}
                  setScoreA={setScoreA}
                  scoreB={scoreB}
                  setScoreB={setScoreB}
                  result={autoPickResult}
                  mutation={gameEntryMutation}
                />
              )}
            </div>
          </>
        )}

        {/* Snake Draft section */}
        <div className="bg-gray-800/50 rounded-xl p-4 mt-4">
          <h3 className="text-sm font-bold text-green-400 mb-2">Snake Draft</h3>
          <p className="text-xs text-gray-400 mb-3">
            Pick captains and draft players turn-by-turn.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4 max-w-md">
            <div>
              <label className="text-xs text-gray-400 block mb-1">
                Captain A (picks first)
              </label>
              <select
                value={captainAId ?? ""}
                onChange={(e) =>
                  setCaptainAId(e.target.value ? Number(e.target.value) : null)
                }
                className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:border-green-500 focus:outline-none"
              >
                <option value="">Choose captain...</option>
                {savedPlayers
                  .filter((p) => p.id !== captainBId)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">
                Captain B
              </label>
              <select
                value={captainBId ?? ""}
                onChange={(e) =>
                  setCaptainBId(e.target.value ? Number(e.target.value) : null)
                }
                className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:border-green-500 focus:outline-none"
              >
                <option value="">Choose captain...</option>
                {savedPlayers
                  .filter((p) => p.id !== captainAId)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
              </select>
            </div>
          </div>
          <button
            onClick={() => draftMutation.mutate()}
            disabled={!canCreateDraft || draftMutation.isPending}
            className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-bold py-2 px-6 rounded-lg transition-colors text-sm"
          >
            {draftMutation.isPending ? "Creating..." : "Create Draft"}
          </button>
          {draftMutation.error && (
            <p className="text-red-400 mt-2 text-sm">
              Error: {(draftMutation.error as Error).message}
            </p>
          )}
        </div>
      </div>
    );
  }

  // --- Phase: Pick Players ---
  return (
    <div>
      <h2 className="text-lg font-bold text-green-400 mb-3">Pick Teams</h2>
      <p className="text-sm text-gray-400 mb-4">
        Select 12 available players, then save to auto-pick or start a snake draft.
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
            <div className="text-xs text-gray-400">{p.win_rate}% win rate</div>
          </button>
        ))}
      </div>

      <div className="flex items-center gap-4">
        <button
          onClick={handleSave}
          disabled={selected.size !== 12}
          className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-bold py-2 px-6 rounded-lg transition-colors"
        >
          Save ({selected.size}/12)
        </button>
        {selected.size > 0 && (
          <button
            onClick={() => setSelected(new Set())}
            className="text-sm text-gray-400 hover:text-white"
          >
            Clear
          </button>
        )}
      </div>
    </div>
  );
}

// --- Sub-components ---

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

function LogGameForm({
  blocks,
  blockId,
  setBlockId,
  weekNumber,
  setWeekNumber,
  gameDate,
  setGameDate,
  scoreA,
  setScoreA,
  scoreB,
  setScoreB,
  result,
  mutation,
}: {
  blocks: { id: number; name: string }[];
  blockId: number | "";
  setBlockId: (v: number | "") => void;
  weekNumber: number | "";
  setWeekNumber: (v: number | "") => void;
  gameDate: string;
  setGameDate: (v: string) => void;
  scoreA: number | "";
  setScoreA: (v: number | "") => void;
  scoreB: number | "";
  setScoreB: (v: number | "") => void;
  result: TeamPickerResult;
  mutation: ReturnType<typeof useMutation<{ status: string; players_added: number }, Error, { block_id: number; week_number: number; game_date: string; players: GameEntryPlayer[] }>>;
}) {
  const handleSaveGame = () => {
    if (
      typeof blockId !== "number" ||
      typeof weekNumber !== "number" ||
      typeof scoreA !== "number" ||
      typeof scoreB !== "number"
    )
      return;

    const resultA =
      scoreA > scoreB ? "W" : scoreA < scoreB ? "L" : "D";
    const resultB =
      scoreB > scoreA ? "W" : scoreB < scoreA ? "L" : "D";

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

    mutation.mutate({
      block_id: blockId,
      week_number: weekNumber,
      game_date: gameDate,
      players: entryPlayers,
    });
  };

  return (
    <div className="bg-gray-800 rounded-xl p-5 mt-2">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <div>
          <label className="block text-xs text-gray-400 mb-1">Block</label>
          <select
            value={blockId}
            onChange={(e) =>
              setBlockId(e.target.value ? Number(e.target.value) : "")
            }
            className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-sm"
          >
            <option value="">Select block</option>
            {blocks.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Week</label>
          <input
            type="number"
            min={1}
            value={weekNumber}
            onChange={(e) =>
              setWeekNumber(e.target.value ? Number(e.target.value) : "")
            }
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
              onChange={(e) =>
                setScoreA(e.target.value ? Number(e.target.value) : "")
              }
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
              onChange={(e) =>
                setScoreB(e.target.value ? Number(e.target.value) : "")
              }
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
            mutation.isPending
          }
          onClick={handleSaveGame}
          className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-bold py-2 px-6 rounded-lg transition-colors text-sm"
        >
          {mutation.isPending ? "Saving..." : "Save Game"}
        </button>
        {mutation.isSuccess && (
          <span className="text-green-400 text-sm">
            Game saved & standings recalculated
          </span>
        )}
        {mutation.isError && (
          <span className="text-red-400 text-sm">
            Error: {(mutation.error as Error).message}
          </span>
        )}
      </div>
    </div>
  );
}
