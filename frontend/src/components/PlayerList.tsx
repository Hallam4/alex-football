import { useState, useEffect, useRef } from "react";
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
  const [pendingActive, setPendingActive] = useState<Set<number>>(new Set());
  const serverActiveRef = useRef<Set<number>>(new Set());

  // Sync pendingActive from server data on load / after save
  useEffect(() => {
    if (data) {
      const serverSet = new Set(data.filter((p) => p.is_active).map((p) => p.id));
      serverActiveRef.current = serverSet;
      setPendingActive(new Set(serverSet));
    }
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: api.setActivePlayers,
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

  // Check if pendingActive differs from server state
  const serverActive = serverActiveRef.current;
  const isDirty =
    pendingActive.size !== serverActive.size ||
    [...pendingActive].some((id) => !serverActive.has(id));

  const togglePending = (id: number) => {
    const next = new Set(pendingActive);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setPendingActive(next);
  };

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
        {isDirty && (
          <button
            onClick={() => saveMutation.mutate([...pendingActive])}
            disabled={saveMutation.isPending}
            className="text-sm bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-3 py-1.5 rounded transition-colors"
          >
            {saveMutation.isPending
              ? "Saving..."
              : `Save (${pendingActive.size} active)`}
          </button>
        )}
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
                {pendingActive.has(p.id) && (
                  <span className="text-xs bg-green-900 text-green-300 px-2 py-0.5 rounded-full">
                    Active
                  </span>
                )}
                <input
                  type="checkbox"
                  checked={pendingActive.has(p.id)}
                  onClick={(e) => e.stopPropagation()}
                  onChange={() => togglePending(p.id)}
                  className="accent-green-500 h-4 w-4 cursor-pointer"
                />
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
