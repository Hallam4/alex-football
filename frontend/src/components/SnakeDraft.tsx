import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { api, CreateDraftResponse, DraftPlayer } from "../api/football";
import { useDraftWebSocket } from "../hooks/useDraftWebSocket";

const SNAKE_ORDER = ["A", "B", "B", "A", "B", "A", "B", "A", "B", "A"];

interface Props {
  initialCode?: string | null;
  initialToken?: string | null;
}

export default function SnakeDraft({ initialCode, initialToken }: Props) {
  const [draftInfo, setDraftInfo] = useState<CreateDraftResponse | null>(null);
  const [liveCode, setLiveCode] = useState<string | null>(initialCode ?? null);
  const [liveToken, setLiveToken] = useState<string | null>(initialToken ?? null);

  // Phase 1: Setup created a draft → Phase 2: Show links
  // Phase 3: Captain opened a link (has code + token)

  if (liveCode && liveToken) {
    return <DraftBoard code={liveCode} token={liveToken} />;
  }

  if (draftInfo) {
    return <DraftShareLinks draft={draftInfo} onJoin={(code, token) => { setLiveCode(code); setLiveToken(token); }} />;
  }

  return <DraftSetup onCreated={setDraftInfo} />;
}

// --- Phase 1: Setup ---

function DraftSetup({ onCreated }: { onCreated: (d: CreateDraftResponse) => void }) {
  const { data: players, isLoading } = useQuery({
    queryKey: ["players"],
    queryFn: api.getPlayers,
  });
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [captainAId, setCaptainAId] = useState<number | null>(null);
  const [captainBId, setCaptainBId] = useState<number | null>(null);

  const mutation = useMutation({
    mutationFn: () =>
      api.createDraft({
        captain_a_id: captainAId!,
        captain_b_id: captainBId!,
        player_ids: Array.from(selected),
      }),
    onSuccess: onCreated,
  });

  if (isLoading) return <p className="text-gray-400">Loading players...</p>;
  if (!players) return null;

  const activePlayers = players.filter((p) => p.is_active);
  const selectedPlayers = players.filter((p) => selected.has(p.id));

  const toggle = (id: number) => {
    const next = new Set(selected);
    if (next.has(id)) {
      next.delete(id);
      // Clear captain selection if removed player was a captain
      if (captainAId === id) setCaptainAId(null);
      if (captainBId === id) setCaptainBId(null);
    } else if (next.size < 12) {
      next.add(id);
    }
    setSelected(next);
  };

  const canCreate = selected.size === 12 && captainAId !== null && captainBId !== null;

  return (
    <div>
      <h2 className="text-lg font-bold text-green-400 mb-1">Snake Draft</h2>
      <p className="text-sm text-gray-400 mb-4">
        Select 12 players, choose two captains, then share draft links.
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

      <p className="text-sm text-gray-400 mb-3">{selected.size}/12 players selected</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4 max-w-md">
        <div>
          <label className="text-xs text-gray-400 block mb-1">Captain A (picks first)</label>
          <select
            value={captainAId ?? ""}
            onChange={(e) => setCaptainAId(e.target.value ? Number(e.target.value) : null)}
            disabled={selected.size < 12}
            className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:border-green-500 focus:outline-none disabled:opacity-50"
          >
            <option value="">{selected.size < 12 ? "Select 12 players first" : "Choose captain..."}</option>
            {selectedPlayers
              .filter((p) => p.id !== captainBId)
              .map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-400 block mb-1">Captain B</label>
          <select
            value={captainBId ?? ""}
            onChange={(e) => setCaptainBId(e.target.value ? Number(e.target.value) : null)}
            disabled={selected.size < 12}
            className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:border-green-500 focus:outline-none disabled:opacity-50"
          >
            <option value="">{selected.size < 12 ? "Select 12 players first" : "Choose captain..."}</option>
            {selectedPlayers
              .filter((p) => p.id !== captainAId)
              .map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
          </select>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <button
          onClick={() => mutation.mutate()}
          disabled={!canCreate || mutation.isPending}
          className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-bold py-2 px-6 rounded-lg transition-colors"
        >
          {mutation.isPending ? "Creating..." : "Create Draft"}
        </button>
        {selected.size > 0 && (
          <button onClick={() => { setSelected(new Set()); setCaptainAId(null); setCaptainBId(null); }} className="text-sm text-gray-400 hover:text-white">
            Clear
          </button>
        )}
      </div>

      {mutation.error && (
        <p className="text-red-400 mt-3 text-sm">Error: {(mutation.error as Error).message}</p>
      )}
    </div>
  );
}

// --- Phase 2: Share Links ---

function DraftShareLinks({
  draft,
  onJoin,
}: {
  draft: CreateDraftResponse;
  onJoin: (code: string, token: string) => void;
}) {
  const [copiedA, setCopiedA] = useState(false);
  const [copiedB, setCopiedB] = useState(false);

  const baseUrl = window.location.origin + window.location.pathname;
  const linkA = `${baseUrl}?draft=${draft.code}&token=${draft.token_a}`;
  const linkB = `${baseUrl}?draft=${draft.code}&token=${draft.token_b}`;

  const copy = async (text: string, setCopied: (v: boolean) => void) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div>
      <h2 className="text-lg font-bold text-green-400 mb-1">Draft Created!</h2>
      <p className="text-sm text-gray-400 mb-6">
        Share these links with each captain. Each link is unique — don't mix them up.
      </p>

      <div className="space-y-4 max-w-lg">
        <LinkCard
          label="Captain A Link"
          url={linkA}
          copied={copiedA}
          onCopy={() => copy(linkA, setCopiedA)}
          color="green"
        />
        <LinkCard
          label="Captain B Link"
          url={linkB}
          copied={copiedB}
          onCopy={() => copy(linkB, setCopiedB)}
          color="blue"
        />
      </div>

      <div className="mt-6 flex gap-3">
        <button
          onClick={() => onJoin(draft.code, draft.token_a)}
          className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-5 rounded-lg text-sm transition-colors"
        >
          Join as Captain A
        </button>
        <button
          onClick={() => onJoin(draft.code, draft.token_b)}
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-5 rounded-lg text-sm transition-colors"
        >
          Join as Captain B
        </button>
      </div>
    </div>
  );
}

function LinkCard({
  label,
  url,
  copied,
  onCopy,
  color,
}: {
  label: string;
  url: string;
  copied: boolean;
  onCopy: () => void;
  color: "green" | "blue";
}) {
  const accent = color === "green" ? "text-green-400" : "text-blue-400";
  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <div className={`text-sm font-medium ${accent} mb-2`}>{label}</div>
      <div className="bg-gray-900 rounded px-3 py-2 text-xs text-gray-300 break-all mb-2 font-mono">
        {url}
      </div>
      <button
        onClick={onCopy}
        className="text-sm text-gray-400 hover:text-white transition-colors"
      >
        {copied ? "Copied!" : "Copy link"}
      </button>
    </div>
  );
}

// --- Phase 3: Draft Board ---

function DraftBoard({ code, token }: { code: string; token: string }) {
  const { state, status, error, pick } = useDraftWebSocket(code, token);

  if (status === "connecting" || (!state && status !== "error")) {
    return <p className="text-gray-400">Connecting to draft...</p>;
  }

  if (error && !state) {
    return <p className="text-red-400">Error: {error}</p>;
  }

  if (!state) return null;

  const isMyTurn = state.whose_turn === state.my_captain;
  const turnCaptainName =
    state.whose_turn === "A" ? state.captain_a : state.captain_b;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-green-400">Snake Draft</h2>
        <div className="text-xs text-gray-500">
          {status === "connected" ? "Live" : "Reconnecting..."}
        </div>
      </div>

      {/* Turn banner */}
      {!state.is_complete && (
        <div
          className={`rounded-lg px-4 py-3 mb-4 text-center font-bold text-sm ${
            isMyTurn
              ? "bg-green-900/50 text-green-300 border border-green-700"
              : "bg-gray-800 text-gray-400 border border-gray-700"
          }`}
        >
          {isMyTurn
            ? `Your pick! (Pick ${state.pick_number + 1} of 10)`
            : `Waiting for ${turnCaptainName}... (Pick ${state.pick_number + 1} of 10)`}
        </div>
      )}

      {state.is_complete && (
        <div className="rounded-lg px-4 py-3 mb-4 text-center font-bold text-sm bg-green-900/50 text-green-300 border border-green-700">
          Draft complete!
        </div>
      )}

      {error && <p className="text-red-400 text-sm mb-3">{error}</p>}

      {/* Snake order indicator */}
      <div className="flex gap-1 mb-4 overflow-x-auto">
        {SNAKE_ORDER.map((captain, i) => {
          const done = i < state.pick_number;
          const current = i === state.pick_number;
          const isA = captain === "A";
          return (
            <div
              key={i}
              className={`flex-shrink-0 w-8 h-8 rounded flex items-center justify-center text-xs font-bold ${
                current
                  ? isA
                    ? "bg-green-600 text-white ring-2 ring-green-400"
                    : "bg-blue-600 text-white ring-2 ring-blue-400"
                  : done
                  ? isA
                    ? "bg-green-900/50 text-green-500"
                    : "bg-blue-900/50 text-blue-500"
                  : "bg-gray-800 text-gray-600"
              }`}
            >
              {captain}
            </div>
          );
        })}
      </div>

      {/* Main layout: available players + teams */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Available players */}
        {!state.is_complete && (
          <div className="lg:col-span-1">
            <h3 className="text-sm font-bold text-gray-300 mb-2">
              Available ({state.available.length})
            </h3>
            <div className="space-y-1 max-h-[60vh] overflow-y-auto">
              {state.available.map((p) => (
                <AvailablePlayerCard
                  key={p.id}
                  player={p}
                  canPick={isMyTurn && !state.is_complete}
                  onPick={() => pick(p.id)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Team panels */}
        <div className={state.is_complete ? "lg:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-4" : "lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4"}>
          <DraftTeamPanel
            title={`${state.captain_a}'s Team`}
            players={state.team_a}
            strength={state.team_a_strength}
            color="green"
            isMine={state.my_captain === "A"}
          />
          <DraftTeamPanel
            title={`${state.captain_b}'s Team`}
            players={state.team_b}
            strength={state.team_b_strength}
            color="blue"
            isMine={state.my_captain === "B"}
          />
        </div>
      </div>
    </div>
  );
}

function AvailablePlayerCard({
  player,
  canPick,
  onPick,
}: {
  player: DraftPlayer;
  canPick: boolean;
  onPick: () => void;
}) {
  const synergyColor =
    player.synergy !== null
      ? player.synergy > 60
        ? "text-green-400"
        : player.synergy < 40
        ? "text-red-400"
        : "text-gray-400"
      : "text-gray-500";

  return (
    <button
      onClick={onPick}
      disabled={!canPick}
      className={`w-full rounded-lg p-3 text-left text-sm transition-colors flex items-center justify-between ${
        canPick
          ? "bg-gray-800 border border-gray-600 hover:border-green-500 hover:bg-gray-750 cursor-pointer"
          : "bg-gray-800/50 border border-gray-700/50 cursor-default opacity-70"
      }`}
    >
      <div>
        <div className="font-medium">{player.name}</div>
        <div className="text-xs text-gray-400">
          Rating: {(player.rating * 100).toFixed(1)}
        </div>
      </div>
      {player.synergy !== null && (
        <div className={`text-xs font-medium ${synergyColor}`}>
          {player.synergy.toFixed(0)}% syn
        </div>
      )}
    </button>
  );
}

function DraftTeamPanel({
  title,
  players,
  strength,
  color,
  isMine,
}: {
  title: string;
  players: DraftPlayer[];
  strength: number;
  color: "green" | "blue";
  isMine: boolean;
}) {
  const accent = color === "green" ? "text-green-400" : "text-blue-400";
  const bg = color === "green" ? "bg-green-900/30" : "bg-blue-900/30";
  const border = isMine
    ? color === "green"
      ? "border border-green-700"
      : "border border-blue-700"
    : "";

  return (
    <div className={`${bg} ${border} rounded-xl p-4`}>
      <h3 className={`font-bold ${accent} mb-3`}>
        {title}
        {isMine && <span className="text-xs text-gray-400 ml-2">(You)</span>}
        <span className="text-sm font-normal text-gray-400 ml-2">
          ({strength.toFixed(3)})
        </span>
      </h3>
      <div className="space-y-2">
        {players.length === 0 && (
          <p className="text-xs text-gray-600 italic">No picks yet</p>
        )}
        {players.map((p) => (
          <div
            key={p.id}
            className="flex justify-between items-center bg-gray-800/50 rounded px-3 py-2"
          >
            <span className="font-medium text-sm">{p.name}</span>
            <span className="text-xs text-gray-400">
              {(p.rating * 100).toFixed(1)}
            </span>
          </div>
        ))}
        {/* Empty slots */}
        {Array.from({ length: 6 - players.length }).map((_, i) => (
          <div
            key={`empty-${i}`}
            className="flex items-center bg-gray-800/20 rounded px-3 py-2 border border-dashed border-gray-700"
          >
            <span className="text-xs text-gray-600 italic">Pick {players.length + i + 1}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
