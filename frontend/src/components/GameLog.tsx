import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Clock, Trash2, ChevronLeft, ChevronRight } from "lucide-react";
import { api } from "../api/football";

const RESULT_COLORS: Record<string, string> = {
  W: "text-green-400",
  D: "text-yellow-400",
  L: "text-red-400",
};

export default function GameLog() {
  const queryClient = useQueryClient();
  const [blockId, setBlockId] = useState<number | undefined>();
  const [page, setPage] = useState(1);

  const deleteMutation = useMutation({
    mutationFn: api.deleteGame,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["games"] });
      queryClient.invalidateQueries({ queryKey: ["league"] });
      queryClient.invalidateQueries({ queryKey: ["players"] });
    },
  });

  const { data: blocks } = useQuery({
    queryKey: ["blocks"],
    queryFn: api.getBlocks,
  });

  const { data, isLoading, error } = useQuery({
    queryKey: ["games", blockId, page],
    queryFn: () => api.getGames(blockId, page),
  });

  if (error) return <p className="text-red-400">Error: {(error as Error).message}</p>;

  const totalPages = data ? Math.ceil(data.total / data.page_size) : 1;

  // Group games by date
  const grouped: Record<string, typeof data extends undefined ? never : NonNullable<typeof data>["games"]> = {};
  if (data) {
    for (const g of data.games) {
      const key = `${g.block_name} — Wk ${g.week_number} (${g.game_date ?? "?"})`;
      (grouped[key] ??= []).push(g);
    }
  }

  return (
    <div className="animate-slide-up">
      <div className="flex items-center gap-2 mb-4">
        <Clock className="w-5 h-5 text-green-400" />
        <h2 className="text-lg font-bold bg-gradient-to-r from-green-400 to-emerald-300 bg-clip-text text-transparent">
          Game History
        </h2>
      </div>

      <div className="flex gap-3 mb-4 flex-wrap">
        <select
          value={blockId ?? ""}
          onChange={(e) => {
            setBlockId(e.target.value ? Number(e.target.value) : undefined);
            setPage(1);
          }}
          className="select-glass"
        >
          <option value="">All blocks</option>
          {blocks?.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name} ({b.start_date ?? "?"})
            </option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="glass-card p-4 space-y-2">
              <div className="skeleton h-4 w-48" />
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-1">
                {Array.from({ length: 4 }).map((_, j) => (
                  <div key={j} className="skeleton h-10" />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <>
          {Object.entries(grouped).map(([key, games]) => {
            const first = games[0];
            return (
            <div key={key} className="glass-card p-4 mb-4">
              <div className="flex items-center gap-2 mb-3">
                <h3 className="text-xs uppercase tracking-wider font-semibold text-gray-500">{key}</h3>
                <button
                  onClick={() => {
                    if (!confirm(`Delete all ${games.length} results for this game?`)) return;
                    deleteMutation.mutate({
                      block_id: first.block_id,
                      week_number: first.week_number,
                      game_date: first.game_date ?? "",
                    });
                  }}
                  disabled={deleteMutation.isPending}
                  className="ml-auto flex items-center gap-1 text-xs text-gray-600 hover:text-red-400 transition-colors disabled:opacity-50"
                >
                  <Trash2 className="w-3 h-3" />
                  Delete
                </button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-1.5">
                {games.map((g, i) => (
                  <div
                    key={i}
                    className="bg-white/[0.03] rounded-xl px-3 py-2 flex justify-between items-center text-sm"
                  >
                    <span className="text-gray-300">
                      {g.player_name}
                      {g.is_sub && (
                        <span className="text-xs text-gray-600 ml-1">(sub)</span>
                      )}
                    </span>
                    <span className={`font-bold ${RESULT_COLORS[g.result] ?? ""}`}>
                      {g.result}
                      {g.goals_for != null && (
                        <span className="text-xs text-gray-600 ml-1">
                          {g.goals_for}-{g.goals_against}
                        </span>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          );
          })}

          {totalPages > 1 && (
            <div className="flex justify-center items-center gap-2 mt-4">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="btn-secondary flex items-center gap-1 !px-3 !py-1.5"
              >
                <ChevronLeft className="w-4 h-4" />
                Prev
              </button>
              <span className="px-3 py-1 text-sm text-gray-500">
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="btn-secondary flex items-center gap-1 !px-3 !py-1.5"
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
