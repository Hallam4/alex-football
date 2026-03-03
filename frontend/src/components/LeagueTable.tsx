import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, LeagueRow } from "../api/football";

type SortKey = keyof Pick<
  LeagueRow,
  "position" | "played" | "won" | "drawn" | "lost" | "mom" | "points" | "goal_difference" | "ppg"
>;

export default function LeagueTable({
  onPlayerClick,
}: {
  onPlayerClick: (id: number) => void;
}) {
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ["league"],
    queryFn: api.getLeague,
  });
  const { data: blocks } = useQuery({
    queryKey: ["blocks"],
    queryFn: api.getBlocks,
  });
  const [sortKey, setSortKey] = useState<SortKey>("ppg");
  const [sortAsc, setSortAsc] = useState(false);

  const recalcMutation = useMutation({
    mutationFn: (blockId: number) => api.recalculateStandings(blockId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["league"] }),
  });

  if (isLoading) return <p className="text-gray-400">Loading league table...</p>;
  if (error) return <p className="text-red-400">Error: {(error as Error).message}</p>;
  if (!data) return null;

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else {
      setSortKey(key);
      setSortAsc(false);
    }
  };

  const sorted = [...data.standings].sort((a, b) => {
    const diff = (a[sortKey] as number) - (b[sortKey] as number);
    return sortAsc ? diff : -diff;
  });

  const cols: { key: SortKey; label: string; cls?: string }[] = [
    { key: "position", label: "#", cls: "w-8" },
    { key: "played", label: "P" },
    { key: "won", label: "W" },
    { key: "drawn", label: "D" },
    { key: "lost", label: "L" },
    { key: "mom", label: "MoM" },
    { key: "points", label: "Pts" },
    { key: "goal_difference", label: "GD" },
    { key: "ppg", label: "PPG" },
  ];

  return (
    <div>
      <div className="flex items-center gap-3 mb-3">
        <h2 className="text-lg font-bold text-green-400">{data.block_name} — League Table</h2>
        <button
          onClick={() => {
            const latestBlock = blocks?.[0];
            if (latestBlock) recalcMutation.mutate(latestBlock.id);
          }}
          disabled={recalcMutation.isPending || !blocks?.length}
          className="text-xs bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-gray-300 px-2 py-1 rounded transition-colors"
        >
          {recalcMutation.isPending ? "Recalculating..." : "Recalculate"}
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-gray-400 border-b border-gray-700">
              {cols.slice(0, 1).map((c) => (
                <th
                  key={c.key}
                  onClick={() => handleSort(c.key)}
                  className={`px-2 py-2 text-left cursor-pointer hover:text-white ${c.cls ?? ""}`}
                >
                  {c.label}
                </th>
              ))}
              <th className="px-2 py-2 text-left">Player</th>
              {cols.slice(1).map((c) => (
                <th
                  key={c.key}
                  onClick={() => handleSort(c.key)}
                  className="px-2 py-2 text-right cursor-pointer hover:text-white"
                >
                  {c.label}
                  {sortKey === c.key && (sortAsc ? " \u25B2" : " \u25BC")}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((row, i) => (
              <tr
                key={row.player_id}
                className={`border-b border-gray-800 hover:bg-gray-800/50 ${
                  i < 3 ? "text-green-300" : i >= sorted.length - 3 ? "text-red-300" : ""
                }`}
              >
                <td className="px-2 py-2">{row.position}</td>
                <td
                  className="px-2 py-2 font-medium cursor-pointer hover:text-green-400"
                  onClick={() => onPlayerClick(row.player_id)}
                >
                  {row.player_name}
                </td>
                <td className="px-2 py-2 text-right">{row.played}</td>
                <td className="px-2 py-2 text-right">{row.won}</td>
                <td className="px-2 py-2 text-right">{row.drawn}</td>
                <td className="px-2 py-2 text-right">{row.lost}</td>
                <td className="px-2 py-2 text-right">{row.mom}</td>
                <td className="px-2 py-2 text-right font-semibold">{row.points}</td>
                <td className="px-2 py-2 text-right">{row.goal_difference}</td>
                <td className="px-2 py-2 text-right font-semibold">{row.ppg.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
