import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api/football";

const RESULT_COLORS: Record<string, string> = {
  W: "text-green-400",
  D: "text-yellow-400",
  L: "text-red-400",
};

export default function GameLog() {
  const [blockId, setBlockId] = useState<number | undefined>();
  const [page, setPage] = useState(1);

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
    <div>
      <h2 className="text-lg font-bold text-green-400 mb-3">Game History</h2>

      <div className="flex gap-3 mb-4 flex-wrap">
        <select
          value={blockId ?? ""}
          onChange={(e) => {
            setBlockId(e.target.value ? Number(e.target.value) : undefined);
            setPage(1);
          }}
          className="bg-gray-800 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
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
        <p className="text-gray-400">Loading...</p>
      ) : (
        <>
          {Object.entries(grouped).map(([key, games]) => (
            <div key={key} className="mb-4">
              <h3 className="text-sm font-semibold text-gray-400 mb-2">{key}</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-1">
                {games.map((g, i) => (
                  <div
                    key={i}
                    className="bg-gray-800 rounded px-3 py-2 flex justify-between items-center text-sm"
                  >
                    <span>
                      {g.player_name}
                      {g.is_sub && (
                        <span className="text-xs text-gray-500 ml-1">(sub)</span>
                      )}
                    </span>
                    <span className={`font-bold ${RESULT_COLORS[g.result] ?? ""}`}>
                      {g.result}
                      {g.goals_for != null && (
                        <span className="text-xs text-gray-500 ml-1">
                          {g.goals_for}-{g.goals_against}
                        </span>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-4">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1 rounded bg-gray-800 text-sm disabled:opacity-50 hover:bg-gray-700"
              >
                Prev
              </button>
              <span className="px-3 py-1 text-sm text-gray-400">
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1 rounded bg-gray-800 text-sm disabled:opacity-50 hover:bg-gray-700"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
