import { useState } from "react";
import { Copy, Check, ArrowLeft } from "lucide-react";
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
    <div className="animate-slide-up">
      <h2 className="text-lg font-bold bg-gradient-to-r from-green-400 to-emerald-300 bg-clip-text text-transparent mb-1">
        Draft Created!
      </h2>
      <p className="text-sm text-gray-500 mb-6">
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
          className="btn-primary"
        >
          Join as Captain A
        </button>
        <button
          onClick={() => onJoin(draft.code, draft.token_b)}
          className="bg-gradient-to-r from-blue-600 to-blue-500 text-white font-semibold px-5 py-2 rounded-xl hover:brightness-110 transition-all text-sm"
        >
          Join as Captain B
        </button>
        {onBack && (
          <button
            onClick={onBack}
            className="text-sm text-gray-500 hover:text-white transition-colors ml-auto"
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
    <div className="glass-card p-4">
      <div className={`text-sm font-medium ${accent} mb-2`}>{label}</div>
      <div className="bg-black/30 rounded-xl px-3 py-2 text-xs text-gray-400 break-all mb-3 font-mono">
        {url}
      </div>
      <button
        onClick={onCopy}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-white transition-colors"
      >
        {copied ? (
          <>
            <Check className="w-3.5 h-3.5 text-green-400" />
            <span className="text-green-400">Copied!</span>
          </>
        ) : (
          <>
            <Copy className="w-3.5 h-3.5" />
            Copy link
          </>
        )}
      </button>
    </div>
  );
}

// --- Draft Board ---

export interface DraftTeams {
  captain_a: string;
  captain_b: string;
  team_a: { id: number; name: string; rating: number }[];
  team_b: { id: number; name: string; rating: number }[];
}

export function DraftBoard({
  code,
  token,
  onBack,
  onDone,
}: {
  code: string;
  token: string;
  onBack?: () => void;
  onDone?: (teams: DraftTeams) => void;
}) {
  const { state, status, error, pick } = useDraftWebSocket(code, token);

  if (status === "connecting" || (!state && status !== "error")) {
    return <p className="text-gray-500">Connecting to draft...</p>;
  }

  if (error && !state) {
    return <p className="text-red-400">Error: {error}</p>;
  }

  if (!state) return null;

  const isMyTurn = state.whose_turn === state.my_captain;
  const turnCaptainName =
    state.whose_turn === "A" ? state.captain_a : state.captain_b;

  return (
    <div className="animate-slide-up">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold bg-gradient-to-r from-green-400 to-emerald-300 bg-clip-text text-transparent">
          Snake Draft
        </h2>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            {status === "connected" ? (
              <>
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse-soft" />
                Live
              </>
            ) : (
              "Reconnecting..."
            )}
          </div>
          {onBack && (
            <button
              onClick={onBack}
              className="flex items-center gap-1 text-sm text-gray-500 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>
          )}
        </div>
      </div>

      {/* Turn banner */}
      {!state.is_complete && (
        <div
          className={`glass-card px-4 py-3 mb-4 text-center font-bold text-sm ${
            isMyTurn
              ? "!border-green-500/30 !bg-green-500/[0.08] shadow-glow text-green-300"
              : "text-gray-400"
          }`}
        >
          {isMyTurn
            ? `Your pick! (Pick ${state.pick_number + 1} of 10)`
            : `Waiting for ${turnCaptainName}... (Pick ${state.pick_number + 1} of 10)`}
        </div>
      )}

      {state.is_complete && (
        <div className="glass-card px-4 py-3 mb-4 flex items-center justify-between !border-green-500/30 !bg-green-500/[0.08] shadow-glow">
          <span className="font-bold text-sm text-green-300">Draft complete!</span>
          {onDone && (
            <button
              onClick={() =>
                onDone({
                  captain_a: state.captain_a,
                  captain_b: state.captain_b,
                  team_a: state.team_a.map((p) => ({ id: p.id, name: p.name, rating: p.rating })),
                  team_b: state.team_b.map((p) => ({ id: p.id, name: p.name, rating: p.rating })),
                })
              }
              className="btn-primary !py-1.5"
            >
              Done
            </button>
          )}
        </div>
      )}

      {error && <p className="text-red-400 text-sm mb-3">{error}</p>}

      {/* Snake order indicator */}
      <div className="flex gap-1.5 mb-4 overflow-x-auto">
        {SNAKE_ORDER.map((captain, i) => {
          const done = i < state.pick_number;
          const current = i === state.pick_number;
          const isA = captain === "A";
          return (
            <div
              key={i}
              className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold transition-all ${
                current
                  ? isA
                    ? "bg-gradient-to-br from-green-500 to-green-700 text-white scale-110 shadow-glow-sm"
                    : "bg-gradient-to-br from-blue-500 to-blue-700 text-white scale-110 shadow-[0_0_10px_rgba(59,130,246,0.2)]"
                  : done
                  ? isA
                    ? "bg-green-500/15 text-green-500"
                    : "bg-blue-500/15 text-blue-500"
                  : "bg-white/[0.04] text-gray-600"
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
            <h3 className="text-xs uppercase tracking-wider font-semibold text-gray-500 mb-2">
              Available ({state.available.length})
            </h3>
            <div className="space-y-1.5 max-h-[60vh] overflow-y-auto pr-1">
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
      : "text-gray-600";

  return (
    <button
      onClick={onPick}
      disabled={!canPick}
      className={`w-full glass-card p-3 text-left text-sm transition-all flex items-center justify-between ${
        canPick
          ? "hover:border-green-500/30 hover:shadow-glow-sm cursor-pointer"
          : "opacity-50 cursor-default"
      }`}
    >
      <div>
        <div className="font-medium">{player.name}</div>
        <div className="text-xs text-gray-500">
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
  const gradient = color === "green"
    ? "from-green-500/[0.07] to-transparent"
    : "from-blue-500/[0.07] to-transparent";
  const borderColor = isMine
    ? color === "green"
      ? "!border-green-500/20"
      : "!border-blue-500/20"
    : "";

  return (
    <div className={`glass-card bg-gradient-to-br ${gradient} ${borderColor} p-4`}>
      <h3 className={`font-bold ${accent} mb-3`}>
        {title}
        {isMine && <span className="text-xs text-gray-500 ml-2">(You)</span>}
        <span className="text-sm font-normal text-gray-500 ml-2">
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
            className="flex justify-between items-center bg-white/[0.03] rounded-xl px-3 py-2"
          >
            <span className="font-medium text-sm">{p.name}</span>
            <span className="text-xs text-gray-500">
              {(p.rating * 100).toFixed(1)}
            </span>
          </div>
        ))}
        {/* Empty slots */}
        {Array.from({ length: 6 - players.length }).map((_, i) => (
          <div
            key={`empty-${i}`}
            className="flex items-center rounded-xl px-3 py-2 border border-dashed border-white/[0.06]"
          >
            <span className="text-xs text-gray-600 italic">Pick {players.length + i + 1}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
