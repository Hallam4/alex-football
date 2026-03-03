import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Swords, Zap, Shuffle, Save, Pencil, X, Share2, Check } from "lucide-react";
import {
  api,
  TeamPickerResult,
  GameEntryPlayer,
  CreateDraftResponse,
} from "../api/football";
import { DraftShareLinks, DraftBoard, DraftTeams } from "./SnakeDraft";

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
  // Phase 2: saved pool (restored from localStorage)
  const [savedIds, setSavedIds] = useState<number[] | null>(() => {
    try {
      const stored = localStorage.getItem("pickTeams.savedIds");
      if (stored) {
        const ids = JSON.parse(stored) as number[];
        if (Array.isArray(ids) && ids.length > 0) return ids;
      }
    } catch { /* ignore */ }
    return null;
  });
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
  const [showLogGameDraft, setShowLogGameDraft] = useState(false);
  const [blockId, setBlockId] = useState<number | "">("");
  const [weekNumber, setWeekNumber] = useState<number | "">("");
  const [gameDate, setGameDate] = useState("");
  const [scoreA, setScoreA] = useState<number | "">("");
  const [scoreB, setScoreB] = useState<number | "">("");
  const [nextGameDate, setNextGameDate] = useState<string | null>(() => {
    try {
      return localStorage.getItem("pickTeams.nextGameDate");
    } catch { return null; }
  });
  const [draftTeams, setDraftTeams] = useState<DraftTeams | null>(() => {
    try {
      const stored = localStorage.getItem("pickTeams.draftTeams");
      return stored ? JSON.parse(stored) : null;
    } catch { return null; }
  });

  // Restore selected set from localStorage-loaded savedIds
  useEffect(() => {
    if (savedIds) setSelected(new Set(savedIds));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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

  // Auto-fill latest block and next Wednesday date
  useEffect(() => {
    if (blocks && blocks.length > 0 && blockId === "") {
      setBlockId(blocks[0].id);
    }
    if (!gameDate) {
      const now = new Date();
      const day = now.getDay();
      const daysUntilWed = (3 - day + 7) % 7 || 7;
      const nextWed = new Date(now);
      nextWed.setDate(now.getDate() + daysUntilWed);
      setGameDate(
        `${nextWed.getFullYear()}-${String(nextWed.getMonth() + 1).padStart(2, "0")}-${String(nextWed.getDate()).padStart(2, "0")}`
      );
    }
  }, [blocks]); // eslint-disable-line react-hooks/exhaustive-deps

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

  if (isLoading) return <p className="text-gray-500">Loading players...</p>;
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
      const ids = Array.from(selected);
      setSavedIds(ids);
      localStorage.setItem("pickTeams.savedIds", JSON.stringify(ids));
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
    setShowLogGameDraft(false);
    localStorage.removeItem("pickTeams.savedIds");
  };

  const handleClear = () => {
    setSavedIds(null);
    setSelected(new Set());
    setAutoPickResult(null);
    setCaptainAId(null);
    setCaptainBId(null);
    setDraftInfo(null);
    setShowLogGame(false);
    setShowLogGameDraft(false);
    setNextGameDate(null);
    setDraftTeams(null);
    localStorage.removeItem("pickTeams.savedIds");
    localStorage.removeItem("pickTeams.nextGameDate");
    localStorage.removeItem("pickTeams.draftTeams");
  };

  const handleClearDraft = () => {
    setNextGameDate(null);
    setDraftTeams(null);
    localStorage.removeItem("pickTeams.nextGameDate");
    localStorage.removeItem("pickTeams.draftTeams");
  };

  const handleDraftBack = () => {
    setLiveCode(null);
    setLiveToken(null);
    setDraftInfo(null);
  };

  const handleDraftDone = (teams: DraftTeams) => {
    // Compute next Wednesday
    const now = new Date();
    const day = now.getDay(); // 0=Sun, 3=Wed
    const daysUntilWed = (3 - day + 7) % 7 || 7;
    const nextWed = new Date(now);
    nextWed.setDate(now.getDate() + daysUntilWed);
    const yyyy = nextWed.getFullYear();
    const mm = String(nextWed.getMonth() + 1).padStart(2, "0");
    const dd = String(nextWed.getDate()).padStart(2, "0");
    const dateStr = `${yyyy}-${mm}-${dd}`;
    setNextGameDate(dateStr);
    setDraftTeams(teams);
    localStorage.setItem("pickTeams.nextGameDate", dateStr);
    localStorage.setItem("pickTeams.draftTeams", JSON.stringify(teams));
    // Return to saved phase
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
    return <DraftBoard code={liveCode!} token={liveToken!} onBack={handleDraftBack} onDone={handleDraftDone} />;
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
      <div className="animate-slide-up">
        <div className="flex items-center gap-2 mb-4">
          <Swords className="w-5 h-5 text-green-400" />
          <h2 className="text-lg font-bold bg-gradient-to-r from-green-400 to-emerald-300 bg-clip-text text-transparent">
            Pick Teams
          </h2>
        </div>

        {/* Saved players summary */}
        <div className="glass-card p-5 mb-4">
          <div className="flex items-center gap-3 mb-3">
            <h3 className="text-xs uppercase tracking-wider font-semibold text-gray-500">
              Players ({savedPlayers.length})
            </h3>
            <button
              onClick={handleEdit}
              className="flex items-center gap-1 text-xs text-gray-500 hover:text-white transition-colors"
            >
              <Pencil className="w-3 h-3" />
              Edit
            </button>
            <button
              onClick={handleClear}
              className="flex items-center gap-1 text-xs text-red-400/70 hover:text-red-400 transition-colors"
            >
              <X className="w-3 h-3" />
              Clear
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {savedPlayers.map((p) => (
              <span
                key={p.id}
                className="glass-card !rounded-full px-3 py-1 text-sm text-gray-300"
              >
                {p.name}
              </span>
            ))}
          </div>
        </div>

        {/* Auto Pick section */}
        <div className="glass-card p-5 mb-4">
          <div className="flex items-center gap-2 mb-2">
            <Zap className="w-4 h-4 text-green-400" />
            <h3 className="text-sm font-bold text-green-400">Auto Pick</h3>
          </div>
          <p className="text-xs text-gray-500 mb-3">
            Generate balanced 6v6 teams automatically.
          </p>
          <button
            onClick={() => pickMutation.mutate(savedIds!)}
            disabled={pickMutation.isPending}
            className="btn-primary"
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
              <div className="md:col-span-2 text-center text-sm text-gray-500">
                Balance score: {autoPickResult.balance_score.toFixed(4)} (lower =
                more balanced)
              </div>
            </div>

            <PredictionBar
              teamAIds={autoPickResult.team_a.map((p) => p.id)}
              teamBIds={autoPickResult.team_b.map((p) => p.id)}
            />

            <div className="flex justify-center mt-3">
              <ShareButton
                teamA={autoPickResult.team_a}
                teamB={autoPickResult.team_b}
                titleA="Team A"
                titleB="Team B"
                strengthA={autoPickResult.team_a_strength}
                strengthB={autoPickResult.team_b_strength}
              />
            </div>

            {/* Log Game */}
            <div className="mt-6">
              <button
                onClick={() => setShowLogGame(!showLogGame)}
                className="text-sm text-gray-500 hover:text-white flex items-center gap-1 transition-colors"
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
        <div className="glass-card p-5 mt-4">
          <div className="flex items-center gap-2 mb-2">
            <Shuffle className="w-4 h-4 text-green-400" />
            <h3 className="text-sm font-bold text-green-400">Snake Draft</h3>
          </div>
          <p className="text-xs text-gray-500 mb-3">
            Pick captains and draft players turn-by-turn.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4 max-w-md">
            <div>
              <label className="text-xs text-gray-500 block mb-1">
                Captain A (picks first)
              </label>
              <select
                value={captainAId ?? ""}
                onChange={(e) =>
                  setCaptainAId(e.target.value ? Number(e.target.value) : null)
                }
                className="select-glass w-full"
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
              <label className="text-xs text-gray-500 block mb-1">
                Captain B
              </label>
              <select
                value={captainBId ?? ""}
                onChange={(e) =>
                  setCaptainBId(e.target.value ? Number(e.target.value) : null)
                }
                className="select-glass w-full"
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
            className="btn-primary"
          >
            {draftMutation.isPending ? "Creating..." : "Create Draft"}
          </button>
          {draftMutation.error && (
            <p className="text-red-400 mt-2 text-sm">
              Error: {(draftMutation.error as Error).message}
            </p>
          )}

          {nextGameDate && (
            <div className="mt-4">
              <div className="text-center mb-4">
                <span className="text-sm text-gray-500">Next game: </span>
                <span className="text-sm font-bold text-green-400">
                  {new Date(nextGameDate + "T00:00:00").toLocaleDateString("en-GB", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </span>
                <button
                  onClick={handleClearDraft}
                  className="text-sm text-red-400/70 hover:text-red-400 transition-colors ml-3"
                >
                  Clear
                </button>
              </div>
              {draftTeams && (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <TeamCard
                      title={`${draftTeams.captain_a}'s Team`}
                      players={draftTeams.team_a}
                      color="green"
                    />
                    <TeamCard
                      title={`${draftTeams.captain_b}'s Team`}
                      players={draftTeams.team_b}
                      color="blue"
                    />
                  </div>

                  <PredictionBar
                    teamAIds={draftTeams.team_a.map((p: { id: number }) => p.id)}
                    teamBIds={draftTeams.team_b.map((p: { id: number }) => p.id)}
                    labelA={draftTeams.captain_a}
                    labelB={draftTeams.captain_b}
                  />

                  <div className="flex justify-center mt-3">
                    <ShareButton
                      teamA={draftTeams.team_a}
                      teamB={draftTeams.team_b}
                      titleA={`${draftTeams.captain_a}'s Team`}
                      titleB={`${draftTeams.captain_b}'s Team`}
                    />
                  </div>
                </>
              )}

              {draftTeams && (
                <div className="mt-4">
                  <button
                    onClick={() => setShowLogGameDraft(!showLogGameDraft)}
                    className="text-sm text-gray-500 hover:text-white flex items-center gap-1 transition-colors"
                  >
                    {showLogGameDraft ? "\u25BC" : "\u25B6"} Log Game
                  </button>
                  {showLogGameDraft && (
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
                      result={draftTeams}
                      mutation={gameEntryMutation}
                    />
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // --- Phase: Pick Players ---
  return (
    <div className="animate-slide-up">
      <div className="flex items-center gap-2 mb-4">
        <Swords className="w-5 h-5 text-green-400" />
        <h2 className="text-lg font-bold bg-gradient-to-r from-green-400 to-emerald-300 bg-clip-text text-transparent">
          Pick Teams
        </h2>
      </div>
      <p className="text-sm text-gray-500 mb-4">
        Select 12 available players, then save to auto-pick or start a snake draft.
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 mb-4">
        {activePlayers.map((p) => (
          <button
            key={p.id}
            onClick={() => toggle(p.id)}
            className={`rounded-2xl p-3 text-left text-sm transition-all ${
              selected.has(p.id)
                ? "bg-green-500/10 border border-green-500/30 shadow-glow-sm"
                : "glass-card hover:border-white/[0.12]"
            }`}
          >
            <div className="font-medium">{p.name}</div>
            <div className="text-xs text-gray-500">{p.win_rate}% win rate</div>
          </button>
        ))}
      </div>

      <div className="flex items-center gap-4">
        <button
          onClick={handleSave}
          disabled={selected.size !== 12}
          className="btn-primary flex items-center gap-2"
        >
          <Save className="w-4 h-4" />
          Save ({selected.size}/12)
        </button>
        {selected.size > 0 && (
          <button
            onClick={() => setSelected(new Set())}
            className="text-sm text-gray-500 hover:text-white transition-colors"
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
  strength?: number;
  color: "green" | "blue";
}) {
  const accent = color === "green" ? "text-green-400" : "text-blue-400";
  const gradient = color === "green"
    ? "from-green-500/[0.07] to-transparent"
    : "from-blue-500/[0.07] to-transparent";
  const borderColor = color === "green" ? "border-green-500/10" : "border-blue-500/10";

  return (
    <div className={`glass-card bg-gradient-to-br ${gradient} border ${borderColor} p-4`}>
      <h3 className={`font-bold ${accent} mb-3`}>
        {title}
        {strength != null && (
          <span className="text-sm font-normal text-gray-500">
            {" "}(strength: {strength.toFixed(3)})
          </span>
        )}
      </h3>
      <div className="space-y-2">
        {players
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((p) => (
            <div
              key={p.id}
              className="flex justify-between items-center bg-white/[0.03] rounded-xl px-3 py-2"
            >
              <span className="font-medium">{p.name}</span>
              <span className="text-sm text-gray-500">
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
  result: { team_a: { id: number }[]; team_b: { id: number }[] };
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
    <div className="glass-card p-5 mt-2">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Block</label>
          <select
            value={blockId}
            onChange={(e) =>
              setBlockId(e.target.value ? Number(e.target.value) : "")
            }
            className="select-glass w-full"
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
          <label className="block text-xs text-gray-500 mb-1">Week</label>
          <input
            type="number"
            min={1}
            value={weekNumber}
            onChange={(e) =>
              setWeekNumber(e.target.value ? Number(e.target.value) : "")
            }
            className="input-glass w-full"
            placeholder="1"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Date</label>
          <input
            type="date"
            value={gameDate}
            onChange={(e) => setGameDate(e.target.value)}
            className="input-glass w-full"
          />
        </div>
        <div className="flex gap-2 items-end">
          <div className="flex-1">
            <label className="block text-xs text-gray-500 mb-1">A</label>
            <input
              type="number"
              min={0}
              value={scoreA}
              onChange={(e) =>
                setScoreA(e.target.value ? Number(e.target.value) : "")
              }
              className="input-glass w-full"
              placeholder="0"
            />
          </div>
          <span className="text-gray-600 pb-2.5">-</span>
          <div className="flex-1">
            <label className="block text-xs text-gray-500 mb-1">B</label>
            <input
              type="number"
              min={0}
              value={scoreB}
              onChange={(e) =>
                setScoreB(e.target.value ? Number(e.target.value) : "")
              }
              className="input-glass w-full"
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
          className="btn-primary"
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

function PredictionBar({
  teamAIds,
  teamBIds,
  labelA = "Team A",
  labelB = "Team B",
}: {
  teamAIds: number[];
  teamBIds: number[];
  labelA?: string;
  labelB?: string;
}) {
  const { data } = useQuery({
    queryKey: ["predict", teamAIds.join(","), teamBIds.join(",")],
    queryFn: () => api.predict({ team_a_ids: teamAIds, team_b_ids: teamBIds }),
  });

  if (!data) return null;

  return (
    <div className="glass-card p-4 mt-4">
      <p className="text-xs text-gray-500 mb-2 text-center">Match Prediction</p>
      <div className="flex rounded-xl overflow-hidden h-8 text-xs font-bold">
        <div
          className="bg-green-500/30 flex items-center justify-center text-green-400 transition-all"
          style={{ width: `${data.team_a_win_pct}%` }}
        >
          {data.team_a_win_pct >= 15 && `${labelA} ${data.team_a_win_pct.toFixed(0)}%`}
        </div>
        <div
          className="bg-yellow-500/20 flex items-center justify-center text-yellow-400 transition-all"
          style={{ width: `${data.draw_pct}%` }}
        >
          {data.draw_pct >= 15 && `${data.draw_pct.toFixed(0)}%`}
        </div>
        <div
          className="bg-blue-500/30 flex items-center justify-center text-blue-400 transition-all"
          style={{ width: `${data.team_b_win_pct}%` }}
        >
          {data.team_b_win_pct >= 15 && `${labelB} ${data.team_b_win_pct.toFixed(0)}%`}
        </div>
      </div>
      <div className="flex justify-between text-[10px] text-gray-600 mt-1">
        <span>{labelA}</span>
        <span>Draw</span>
        <span>{labelB}</span>
      </div>
    </div>
  );
}

function ShareButton({
  teamA,
  teamB,
  titleA = "Team A",
  titleB = "Team B",
  strengthA,
  strengthB,
}: {
  teamA: { name: string }[];
  teamB: { name: string }[];
  titleA?: string;
  titleB?: string;
  strengthA?: number;
  strengthB?: number;
}) {
  const [copied, setCopied] = useState(false);

  const handleShare = () => {
    const lines = [
      `${titleA}${strengthA != null ? ` (${strengthA.toFixed(3)})` : ""}`,
      ...teamA.map((p) => p.name).sort(),
      "",
      `${titleB}${strengthB != null ? ` (${strengthB.toFixed(3)})` : ""}`,
      ...teamB.map((p) => p.name).sort(),
    ];
    navigator.clipboard.writeText(lines.join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleShare}
      className="btn-secondary flex items-center gap-1.5 !px-3 !py-1.5 !text-xs"
    >
      {copied ? <Check className="w-3.5 h-3.5" /> : <Share2 className="w-3.5 h-3.5" />}
      {copied ? "Copied!" : "Share Teams"}
    </button>
  );
}
