import { useState, useEffect, useCallback } from "react";
import { Trophy, Users, Swords, Clock, Star } from "lucide-react";
import LeagueTable from "./components/LeagueTable";
import PlayerList from "./components/PlayerList";
import PlayerProfile from "./components/PlayerProfile";
import TeamPicker from "./components/TeamPicker";
import GameLog from "./components/GameLog";
import MomLeaderboard from "./components/MomLeaderboard";

type Tab = "league" | "players" | "picker" | "history" | "mom";

const TABS: { id: Tab; label: string; icon: typeof Trophy }[] = [
  { id: "league", label: "League", icon: Trophy },
  { id: "players", label: "Players", icon: Users },
  { id: "picker", label: "Pick Teams", icon: Swords },
  { id: "history", label: "History", icon: Clock },
  { id: "mom", label: "MoM", icon: Star },
];

const VALID_TABS = new Set<string>(TABS.map((t) => t.id));

function parseHash(): { tab: Tab; playerId: number | null } {
  const hash = window.location.hash.slice(1); // remove #
  if (!hash) return { tab: "league", playerId: null };

  // #players/123
  const playerMatch = hash.match(/^players\/(\d+)$/);
  if (playerMatch) return { tab: "players", playerId: Number(playerMatch[1]) };

  if (VALID_TABS.has(hash)) return { tab: hash as Tab, playerId: null };
  return { tab: "league", playerId: null };
}

function setHash(tab: Tab, playerId: number | null) {
  const hash = playerId ? `players/${playerId}` : tab === "league" ? "" : tab;
  const newUrl = hash ? `#${hash}` : window.location.pathname + window.location.search;
  window.history.pushState(null, "", newUrl);
}

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>(() => {
    // Draft URL params take priority
    const params = new URLSearchParams(window.location.search);
    if (params.get("draft") && params.get("token")) return "picker";
    return parseHash().tab;
  });
  const [selectedPlayerId, setSelectedPlayerId] = useState<number | null>(
    () => parseHash().playerId
  );

  // Sync hash → state on popstate (back/forward)
  const onPopState = useCallback(() => {
    const { tab, playerId } = parseHash();
    setActiveTab(tab);
    setSelectedPlayerId(playerId);
  }, []);

  useEffect(() => {
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [onPopState]);

  const navigateTab = (tab: Tab) => {
    setActiveTab(tab);
    if (tab !== "players") setSelectedPlayerId(null);
    setHash(tab, null);
  };

  const handlePlayerClick = (playerId: number) => {
    setSelectedPlayerId(playerId);
    setActiveTab("players");
    setHash("players", playerId);
  };

  const handlePlayerBack = () => {
    setSelectedPlayerId(null);
    setHash("players", null);
  };

  return (
    <div className="min-h-screen flex flex-col">
      <header className="relative bg-hero-glow border-b border-white/[0.06] px-4 py-4 sm:px-6">
        <div className="flex items-center gap-3 max-w-6xl mx-auto">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-glow-sm">
            <Trophy className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold bg-gradient-to-r from-green-400 to-emerald-300 bg-clip-text text-transparent">
              Alex Football
            </h1>
            <p className="text-xs text-gray-500">6-a-side stats & team picker</p>
          </div>
        </div>
      </header>

      <nav className="border-b border-white/[0.06] px-4 sm:px-6">
        <div className="flex gap-1 overflow-x-auto max-w-6xl mx-auto py-2">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => navigateTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 text-sm font-medium whitespace-nowrap rounded-xl transition-all ${
                  isActive
                    ? "bg-green-500/10 text-green-400 shadow-glow-sm"
                    : "text-gray-500 hover:text-gray-300 hover:bg-white/[0.04]"
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </nav>

      <main className="flex-1 p-4 md:p-6 max-w-6xl mx-auto w-full animate-fade-in" key={activeTab + (selectedPlayerId ?? "")}>
        {activeTab === "league" && (
          <LeagueTable onPlayerClick={handlePlayerClick} />
        )}
        {activeTab === "players" && !selectedPlayerId && (
          <PlayerList onPlayerClick={handlePlayerClick} />
        )}
        {activeTab === "players" && selectedPlayerId && (
          <PlayerProfile
            playerId={selectedPlayerId}
            onBack={handlePlayerBack}
          />
        )}
        {activeTab === "picker" && <TeamPicker />}
        {activeTab === "history" && <GameLog />}
        {activeTab === "mom" && <MomLeaderboard />}
      </main>
    </div>
  );
}
