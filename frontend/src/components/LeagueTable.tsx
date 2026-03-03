import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Trophy, RefreshCw, PlusCircle } from "lucide-react";
import { api, LeagueRow } from "../api/football";

type SortKey = keyof Pick<
  LeagueRow,
  "position" | "played" | "won" | "drawn" | "lost" | "mom" | "points" | "goal_difference" | "ppg"
>;

const POSITION_BADGES: Record<number, string> = {
  1: "bg-yellow-500 text-yellow-950",
  2: "bg-gray-300 text-gray-800",
  3: "bg-amber-700 text-amber-100",
};

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
  const [sortKey, setSortKey] = useState<SortKey>("points");
  const [sortAsc, setSortAsc] = useState(false);
  const [showBlockForm, setShowBlockForm] = useState(false);
  const [blockName, setBlockName] = useState("");
  const [blockDate, setBlockDate] = useState("");
  const [blockQuarter, setBlockQuarter] = useState("");

  const createBlockMutation = useMutation({
    mutationFn: api.createBlock,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["blocks"] });
      queryClient.invalidateQueries({ queryKey: ["league"] });
      setBlockName("");
      setBlockDate("");
      setBlockQuarter("");
      setShowBlockForm(false);
    },
  });

  const recalcMutation = useMutation({
    mutationFn: (blockId: number) => api.recalculateStandings(blockId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["league"] }),
  });

  if (isLoading) {
    return (
      <div className="glass-card p-5 animate-slide-up space-y-3">
        <div className="skeleton h-6 w-48" />
        <div className="skeleton h-4 w-full" />
        <div className="skeleton h-4 w-full" />
        <div className="skeleton h-4 w-3/4" />
      </div>
    );
  }
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
    <div className="glass-card p-5 animate-slide-up">
      <div className="flex items-center gap-3 mb-4">
        <Trophy className="w-5 h-5 text-green-400" />
        <h2 className="text-lg font-bold bg-gradient-to-r from-green-400 to-emerald-300 bg-clip-text text-transparent">
          {data.block_name} — League Table
        </h2>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => {
              const latestBlock = blocks?.[0];
              if (latestBlock) recalcMutation.mutate(latestBlock.id);
            }}
            disabled={recalcMutation.isPending || !blocks?.length}
            className="btn-secondary flex items-center gap-1.5 !px-3 !py-1.5 !text-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${recalcMutation.isPending ? "animate-spin" : ""}`} />
            {recalcMutation.isPending ? "Recalculating..." : "Recalculate"}
          </button>
          <button
            onClick={() => setShowBlockForm(!showBlockForm)}
            className="btn-secondary flex items-center gap-1.5 !px-3 !py-1.5 !text-xs !text-green-400 !border-green-500/20"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            New Block
          </button>
        </div>
      </div>

      {showBlockForm && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (blockName.trim()) {
              createBlockMutation.mutate({
                name: blockName.trim(),
                start_date: blockDate || null,
                quarter: blockQuarter ? Number(blockQuarter) : null,
              });
            }
          }}
          className="flex gap-2 mb-4 flex-wrap"
        >
          <input
            type="text"
            placeholder="Block name"
            value={blockName}
            onChange={(e) => setBlockName(e.target.value)}
            className="input-glass"
          />
          <input
            type="date"
            value={blockDate}
            onChange={(e) => setBlockDate(e.target.value)}
            className="input-glass"
          />
          <select
            value={blockQuarter}
            onChange={(e) => setBlockQuarter(e.target.value)}
            className="select-glass"
          >
            <option value="">Quarter</option>
            <option value="1">Q1</option>
            <option value="2">Q2</option>
            <option value="3">Q3</option>
            <option value="4">Q4</option>
          </select>
          <button
            type="submit"
            disabled={createBlockMutation.isPending || !blockName.trim()}
            className="btn-primary"
          >
            {createBlockMutation.isPending ? "Creating..." : "Create"}
          </button>
          {createBlockMutation.isError && (
            <span className="text-red-400 text-sm self-center">
              {(createBlockMutation.error as Error).message}
            </span>
          )}
        </form>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm table-premium">
          <thead>
            <tr>
              {cols.slice(0, 1).map((c) => (
                <th
                  key={c.key}
                  onClick={() => handleSort(c.key)}
                  className={`px-2 py-2.5 text-left cursor-pointer hover:text-gray-300 ${c.cls ?? ""}`}
                >
                  {c.label}
                  {sortKey === c.key && (
                    <span className="text-green-400 ml-0.5">{sortAsc ? " \u25B2" : " \u25BC"}</span>
                  )}
                </th>
              ))}
              <th className="px-2 py-2.5 text-left">Player</th>
              {cols.slice(1).map((c) => (
                <th
                  key={c.key}
                  onClick={() => handleSort(c.key)}
                  className="px-2 py-2.5 text-right cursor-pointer hover:text-gray-300"
                >
                  {c.label}
                  {sortKey === c.key && (
                    <span className="text-green-400 ml-0.5">{sortAsc ? " \u25B2" : " \u25BC"}</span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((row, i) => (
              <tr
                key={row.player_id}
                className={
                  i >= sorted.length - 3 ? "bg-red-500/[0.03]" : ""
                }
              >
                <td className="px-2 py-2.5">
                  {POSITION_BADGES[row.position] ? (
                    <span
                      className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${POSITION_BADGES[row.position]}`}
                    >
                      {row.position}
                    </span>
                  ) : (
                    <span className="text-gray-500">{row.position}</span>
                  )}
                </td>
                <td
                  className="px-2 py-2.5 font-medium cursor-pointer hover:text-green-400 transition-colors"
                  onClick={() => onPlayerClick(row.player_id)}
                >
                  {row.player_name}
                </td>
                <td className="px-2 py-2.5 text-right text-gray-400">{row.played}</td>
                <td className="px-2 py-2.5 text-right text-gray-400">{row.won}</td>
                <td className="px-2 py-2.5 text-right text-gray-400">{row.drawn}</td>
                <td className="px-2 py-2.5 text-right text-gray-400">{row.lost}</td>
                <td className="px-2 py-2.5 text-right text-gray-400">{row.mom}</td>
                <td className="px-2 py-2.5 text-right font-bold text-green-400">{row.points}</td>
                <td className="px-2 py-2.5 text-right text-gray-400">{row.goal_difference}</td>
                <td className="px-2 py-2.5 text-right font-semibold">{row.ppg.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
