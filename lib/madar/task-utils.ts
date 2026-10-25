import { useMemo } from "react";
import { PRIORITY_RANK } from "./labels";
import { useTimeTotals } from "./queries";
import type { Task } from "./types";

export type Sort = "due" | "priority" | "recent";

export function useMinutesMap() {
  const totals = useTimeTotals();
  return useMemo(() => new Map((totals.data ?? []).map((t) => [t.task_id, t.minutes])), [totals.data]);
}

export function sortTasks(tasks: Task[], sort: Sort) {
  const list = tasks.slice();
  if (sort === "recent") return list.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  if (sort === "priority") {
    return list.sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999"));
  }
  return list.sort((a, b) => {
    const doneA = a.status === "done" ? 1 : 0;
    const doneB = b.status === "done" ? 1 : 0;
    return doneA - doneB || (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999") || PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
  });
}

