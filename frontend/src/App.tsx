import { useState, useEffect, useCallback, useRef } from "react";
import { Trophy, Users, Swords, Clock, Star, Home, X } from "lucide-react";
import LeagueTable from "./components/LeagueTable";
import PlayerList from "./components/PlayerList";
import PlayerProfile from "./components/PlayerProfile";
import TeamPicker from "./components/TeamPicker";
import GameLog from "./components/GameLog";
import MomLeaderboard from "./components/MomLeaderboard";
import Dashboard from "./components/Dashboard";

type HideableTab = "league" | "players" | "picker" | "history" | "mom";
type Tab = "home" | HideableTab;

const TABS: { id: HideableTab; label: string; icon: typeof Trophy }[] = [
  { id: "league", label: "League", icon: Trophy },
  { id: "players", label: "Players", icon: Users },
  { id: "picker", label: "Pick Teams", icon: Swords },
  { id: "history", label: "History", icon: Clock },
  { id: "mom", label: "MoM", icon: Star },
];

const ALL_TAB_IDS = new Set<string>(["home", ...TABS.map((t) => t.id)]);
const STORAGE_KEY = "app.visibleTabs";

function loadVisibleTabs(): Set<HideableTab> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const arr = JSON.parse(raw) as string[];
      const valid = arr.filter((id) => TABS.some((t) => t.id === id)) as HideableTab[];
      if (valid.length > 0) return new Set(valid);
    }
  } catch { /* ignore */ }
  return new Set(TABS.map((t) => t.id));
}

function saveVisibleTabs(tabs: Set<HideableTab>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...tabs]));
}

function parseHash(visibleTabs: Set<HideableTab>): { tab: Tab; playerId: number | null } {
  const hash = window.location.hash.slice(1);
  if (!hash) return { tab: "home", playerId: null };

  const playerMatch = hash.match(/^players\/(\d+)$/);
  if (playerMatch && visibleTabs.has("players"))
    return { tab: "players", playerId: Number(playerMatch[1]) };

  if (ALL_TAB_IDS.has(hash)) {
    const tab = hash as Tab;
    if (tab === "home") return { tab: "home", playerId: null };
    if (visibleTabs.has(tab as HideableTab)) return { tab, playerId: null };
  }

  return { tab: "home", playerId: null };
}

function setHash(tab: Tab, playerId: number | null) {
  const hash = playerId ? `players/${playerId}` : tab === "home" ? "" : tab;
  const newUrl = hash ? `#${hash}` : window.location.pathname + window.location.search;
  window.history.pushState(null, "", newUrl);
}

export default function App() {
  const [visibleTabs, setVisibleTabs] = useState<Set<HideableTab>>(loadVisibleTabs);
  const [showSettings, setShowSettings] = useState(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [activeTab, setActiveTab] = useState<Tab>(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("draft") && params.get("token")) return "picker";
    return parseHash(visibleTabs).tab;
  });
  const [selectedPlayerId, setSelectedPlayerId] = useState<number | null>(
    () => parseHash(visibleTabs).playerId
  );

  const visibleTabsRef = useRef(visibleTabs);
  visibleTabsRef.current = visibleTabs;

  const onPopState = useCallback(() => {
    const { tab, playerId } = parseHash(visibleTabsRef.current);
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

  const toggleTab = (id: HideableTab) => {
    setVisibleTabs((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        // If hiding the currently active tab, redirect home
        if (activeTab === id) {
          setActiveTab("home");
          setHash("home", null);
        }
      } else {
        next.add(id);
      }
      saveVisibleTabs(next);
      return next;
    });
  };

  // Long-press handler
  const startLongPress = () => {
    longPressTimer.current = setTimeout(() => {
      setShowSettings(true);
    }, 3000);
  };
  const cancelLongPress = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <header className="relative bg-hero-glow border-b border-white/[0.06] px-4 py-4 sm:px-6">
        <div className="flex items-center gap-3 max-w-6xl mx-auto">
          <div
            className="w-9 h-9 rounded-lg bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-glow-sm select-none touch-none"
            onPointerDown={startLongPress}
            onPointerUp={cancelLongPress}
            onPointerLeave={cancelLongPress}
            onPointerCancel={cancelLongPress}
          >
            <Trophy className="w-5 h-5 text-white pointer-events-none" />
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
          {/* Home pill — always visible */}
          <button
            onClick={() => navigateTab("home")}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium whitespace-nowrap rounded-xl transition-all ${
              activeTab === "home"
                ? "bg-green-500/10 text-green-400 shadow-glow-sm"
                : "text-gray-500 hover:text-gray-300 hover:bg-white/[0.04]"
            }`}
          >
            <Home className="w-4 h-4" />
            Home
          </button>
          {TABS.filter((t) => visibleTabs.has(t.id)).map((tab) => {
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
        {activeTab === "home" && (
          <Dashboard onNavigate={navigateTab} />
        )}
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

      {/* Settings Panel */}
      {showSettings && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setShowSettings(false); }}
        >
          <div className="glass-card p-6 w-full max-w-sm animate-slide-up">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-gray-100">Settings</h2>
              <button
                onClick={() => setShowSettings(false)}
                className="text-gray-500 hover:text-gray-300 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3">
              {TABS.map((tab) => {
                const Icon = tab.icon;
                const isVisible = visibleTabs.has(tab.id);
                return (
                  <div
                    key={tab.id}
                    className="flex items-center justify-between py-2 px-3 rounded-xl bg-white/[0.03]"
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon className="w-4 h-4 text-gray-400" />
                      <span className="text-sm text-gray-300">{tab.label}</span>
                    </div>
                    <button
                      onClick={() => toggleTab(tab.id)}
                      className={`relative w-10 h-6 rounded-full transition-colors ${
                        isVisible ? "bg-green-500" : "bg-gray-700"
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                          isVisible ? "translate-x-4" : "translate-x-0"
                        }`}
                      />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
