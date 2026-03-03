import { useState } from "react";
import { DraftPlayer } from "../api/football";
import { useDraftWebSocket } from "../hooks/useDraftWebSocket";

export const SNAKE_ORDER = ["A", "B", "B", "A", "B", "A", "B", "A", "B", "A"];

// --- Share Links ---

export function DraftShareLinks({
  draft,
  onJoin,
  onBack,
}: {
  draft: { code: string; token_a: string; token_b: string };
  onJoin: (code: string, token: string) => void;
  onBack?: () => void;
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
        {onBack && (
          <button
            onClick={onBack}
            className="text-sm text-gray-400 hover:text-white transition-colors ml-auto"
          >
            Back
          </button>
        )}
      </div>
    </div>
  );
}

export function LinkCard({
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

// --- Draft Board ---

export function DraftBoard({
  code,
  token,
  onBack,
  onDone,
}: {
  code: string;
  token: string;
  onBack?: () => void;
  onDone?: () => void;
}) {
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
        <div className="flex items-center gap-3">
          <div className="text-xs text-gray-500">
            {status === "connected" ? "Live" : "Reconnecting..."}
          </div>
          {onBack && (
            <button
              onClick={onBack}
              className="text-sm text-gray-400 hover:text-white transition-colors"
            >
              Back
            </button>
          )}
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
        <div className="rounded-lg px-4 py-3 mb-4 flex items-center justify-between bg-green-900/50 border border-green-700">
          <span className="font-bold text-sm text-green-300">Draft complete!</span>
          {onDone && (
            <button
              onClick={onDone}
              className="bg-green-600 hover:bg-green-700 text-white font-bold py-1.5 px-5 rounded-lg text-sm transition-colors"
            >
              Done
            </button>
          )}
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

export function AvailablePlayerCard({
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

export function DraftTeamPanel({
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
