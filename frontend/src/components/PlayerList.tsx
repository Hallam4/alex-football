import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Users, Search, PlusCircle, Save } from "lucide-react";
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

  if (isLoading) {
    return (
      <div className="animate-slide-up space-y-3">
        <div className="skeleton h-6 w-32" />
        <div className="skeleton h-10 w-64" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skeleton h-20" />
          ))}
        </div>
      </div>
    );
  }
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
    <div className="animate-slide-up">
      <div className="flex items-center gap-2 mb-4">
        <Users className="w-5 h-5 text-green-400" />
        <h2 className="text-lg font-bold bg-gradient-to-r from-green-400 to-emerald-300 bg-clip-text text-transparent">
          Players
        </h2>
      </div>

      <div className="flex gap-3 mb-4 flex-wrap items-center">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="Search players..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="input-glass w-full pl-10"
          />
        </div>
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
          className="btn-secondary flex items-center gap-1.5 !text-xs !text-green-400 !border-green-500/20"
        >
          <PlusCircle className="w-3.5 h-3.5" />
          Add Player
        </button>
        {isDirty && (
          <button
            onClick={() => saveMutation.mutate([...pendingActive])}
            disabled={saveMutation.isPending}
            className="btn-primary flex items-center gap-1.5"
          >
            <Save className="w-3.5 h-3.5" />
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
            className="input-glass flex-1 max-w-xs"
          />
          <button
            type="submit"
            disabled={createMutation.isPending || !newName.trim()}
            className="btn-primary"
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
            className="glass-card p-4 text-left hover:-translate-y-0.5 hover:shadow-glow-sm transition-all group"
          >
            <div className="flex justify-between items-center">
              <span className="font-medium group-hover:text-green-400 transition-colors">{p.name}</span>
              <div className="flex items-center gap-2">
                {pendingActive.has(p.id) && (
                  <span className="badge-active">Active</span>
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
            <div className="text-sm text-gray-500 mt-1">
              {p.total_games} games &middot; {p.total_wins} wins &middot;{" "}
              {p.win_rate}%
            </div>
            {/* Mini win-rate bar */}
            <div className="mt-2 h-1 rounded-full bg-white/[0.06] overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-green-500 to-emerald-400"
                style={{ width: `${p.win_rate}%` }}
              />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
