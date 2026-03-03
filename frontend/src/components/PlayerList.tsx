import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/football";

export default function PlayerList({
  onPlayerClick,
}: {
  onPlayerClick: (id: number) => void;
}) {
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ["players"],
    queryFn: api.getPlayers,
  });
  const toggleMutation = useMutation({
    mutationFn: api.toggleActive,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["players"] }),
  });
  const [filter, setFilter] = useState("");
  const [showActive, setShowActive] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState("");

  const createMutation = useMutation({
    mutationFn: api.createPlayer,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["players"] });
      setNewName("");
      setShowAddForm(false);
    },
  });

  if (isLoading) return <p className="text-gray-400">Loading players...</p>;
  if (error) return <p className="text-red-400">Error: {(error as Error).message}</p>;
  if (!data) return null;

  const filtered = data.filter(
    (p) =>
      p.name.toLowerCase().includes(filter.toLowerCase()) &&
      (!showActive || p.is_active)
  );

  return (
    <div>
      <h2 className="text-lg font-bold text-green-400 mb-3">Players</h2>
      <div className="flex gap-3 mb-4 flex-wrap items-center">
        <input
          type="text"
          placeholder="Search players..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="bg-gray-800 text-white rounded-lg px-3 py-2 text-sm flex-1 max-w-xs focus:outline-none focus:ring-1 focus:ring-green-500"
        />
        <label className="flex items-center gap-2 text-sm text-gray-400">
          <input
            type="checkbox"
            checked={showActive}
            onChange={(e) => setShowActive(e.target.checked)}
            className="accent-green-500"
          />
          Active only
        </label>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="text-xs bg-green-900/50 hover:bg-green-800 text-green-300 px-2 py-1 rounded transition-colors"
        >
          + Add Player
        </button>
      </div>

      {showAddForm && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (newName.trim()) createMutation.mutate({ name: newName.trim() });
          }}
          className="flex gap-2 mb-4"
        >
          <input
            type="text"
            placeholder="Player name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="bg-gray-800 text-white rounded-lg px-3 py-2 text-sm flex-1 max-w-xs focus:outline-none focus:ring-1 focus:ring-green-500"
          />
          <button
            type="submit"
            disabled={createMutation.isPending || !newName.trim()}
            className="text-sm bg-green-700 hover:bg-green-600 disabled:opacity-50 text-white px-3 py-2 rounded transition-colors"
          >
            {createMutation.isPending ? "Adding..." : "Add"}
          </button>
          {createMutation.isError && (
            <span className="text-red-400 text-sm self-center">
              {(createMutation.error as Error).message}
            </span>
          )}
        </form>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.map((p) => (
          <button
            key={p.id}
            onClick={() => onPlayerClick(p.id)}
            className="bg-gray-800 rounded-lg p-3 text-left hover:bg-gray-700 transition-colors"
          >
            <div className="flex justify-between items-center">
              <span className="font-medium">{p.name}</span>
              <div className="flex items-center gap-2">
                {p.is_active && (
                  <span className="text-xs bg-green-900 text-green-300 px-2 py-0.5 rounded-full">
                    Active
                  </span>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleMutation.mutate(p.id);
                  }}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                    p.is_active ? "bg-green-600" : "bg-gray-600"
                  }`}
                  aria-label={`Toggle ${p.name} active`}
                >
                  <span
                    className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${
                      p.is_active ? "translate-x-4.5" : "translate-x-0.5"
                    }`}
                  />
                </button>
              </div>
            </div>
            <div className="text-sm text-gray-400 mt-1">
              {p.total_games} games &middot; {p.total_wins} wins &middot;{" "}
              {p.win_rate}%
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
