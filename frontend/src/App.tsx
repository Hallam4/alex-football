import { useState } from "react";
import LeagueTable from "./components/LeagueTable";
import PlayerList from "./components/PlayerList";
import PlayerProfile from "./components/PlayerProfile";
import TeamPicker from "./components/TeamPicker";
import GameLog from "./components/GameLog";
import MomLeaderboard from "./components/MomLeaderboard";

type Tab = "league" | "players" | "picker" | "history" | "mom";

const TABS: { id: Tab; label: string }[] = [
  { id: "league", label: "League" },
  { id: "players", label: "Players" },
  { id: "picker", label: "Pick Teams" },
  { id: "history", label: "History" },
  { id: "mom", label: "MoM" },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>("league");
  const [selectedPlayerId, setSelectedPlayerId] = useState<number | null>(null);

  const handlePlayerClick = (playerId: number) => {
    setSelectedPlayerId(playerId);
    setActiveTab("players");
  };

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-gray-900 border-b border-gray-700 px-4 py-3 flex items-center gap-3">
        <h1 className="text-xl font-extrabold text-green-400">Alex Football</h1>
        <span className="text-sm text-gray-400">6-a-side stats & team picker</span>
      </header>

      <nav className="bg-gray-900 border-b border-gray-800 px-4 flex gap-1 overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => {
              setActiveTab(tab.id);
              if (tab.id !== "players") setSelectedPlayerId(null);
            }}
            className={`px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors border-b-2 ${
              activeTab === tab.id
                ? "border-green-500 text-green-400"
                : "border-transparent text-gray-400 hover:text-white"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <main className="flex-1 p-4 md:p-6 max-w-6xl mx-auto w-full">
        {activeTab === "league" && (
          <LeagueTable onPlayerClick={handlePlayerClick} />
        )}
        {activeTab === "players" && !selectedPlayerId && (
          <PlayerList onPlayerClick={setSelectedPlayerId} />
        )}
        {activeTab === "players" && selectedPlayerId && (
          <PlayerProfile
            playerId={selectedPlayerId}
            onBack={() => setSelectedPlayerId(null)}
          />
        )}
        {activeTab === "picker" && <TeamPicker />}
        {activeTab === "history" && <GameLog />}
        {activeTab === "mom" && <MomLeaderboard />}
      </main>
    </div>
  );
}
