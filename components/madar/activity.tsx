import { useRouter } from "expo-router";
import { View } from "react-native";
import { fmtDay, fmtRelative } from "@/lib/madar/format";
import { PRIORITY_LABELS, STATUS_LABELS } from "@/lib/madar/labels";
import { useLookups } from "@/lib/madar/queries";
import type { Activity, Priority, TaskStatus } from "@/lib/madar/types";
import { Avatar, C, T, Tap } from "./ui";

export function describeActivity(a: Activity, nameOf: (id: string | null | undefined) => string): string {
  const d = (a.details ?? {}) as Record<string, any>;
  switch (a.action) {
    case "task_created":
      return `أنشأ المهمة «${d.title ?? ""}»`;
    case "status_changed": {
      const to = STATUS_LABELS[d.to as TaskStatus] ?? d.to;
      if (d.to === "review") return "أرسل المهمة للمراجعة";
      if (d.to === "done" && d.from === "review") return "اعتمد المهمة";
      if (d.from === "review" && d.to === "in_progress") return `أعاد المهمة للتنفيذ${d.note ? `: «${d.note}»` : ""}`;
      return `غيّر الحالة من «${STATUS_LABELS[d.from as TaskStatus] ?? d.from}» إلى «${to}»`;
    }
    case "due_changed":
      return d.to ? `غيّر موعد التسليم إلى ${fmtDay(d.to)}` : "أزال موعد التسليم";
    case "priority_changed":
      return `غيّر الأولوية إلى «${PRIORITY_LABELS[d.to as Priority] ?? d.to}»`;
    case "assigned":
      return `أسند المهمة إلى ${nameOf(d.user_id)}`;
    case "unassigned":
      return `ألغى إسناد ${nameOf(d.user_id)}`;
    case "commented":
      return `علّق: «${d.excerpt ?? ""}»`;
    case "file_attached":
      return `أرفق الملف ${d.file_name ?? ""}`;
    default:
      return a.action;
  }
}

export function ActivityList({ items, showTask }: { items: Activity[]; showTask?: boolean }) {
  const { profileMap } = useLookups();
  const router = useRouter();
  const nameOf = (id: string | null | undefined) => (id ? profileMap.get(id)?.full_name ?? "عضو" : "النظام");
  if (items.length === 0) return <T className="py-3 text-muted">لا يوجد نشاط بعد.</T>;
  return (
    <View style={{ gap: 2 }}>
      {items.map((a, i) => (
        <Tap
          key={a.id}
          onPress={showTask && a.task_id ? () => router.push(`/tasks/${a.task_id}` as any) : undefined}
          style={{ flexDirection: "row", gap: 10, paddingVertical: 9, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: C.border }}
        >
          <Avatar id={a.actor_id} name={nameOf(a.actor_id)} size={28} />
          <View style={{ flex: 1, gap: 1 }}>
            <T className="text-[13px]" style={{ lineHeight: 21 }}>
              <T weight="semibold" className="text-[13px]">
                {nameOf(a.actor_id)}
              </T>{" "}
              {describeActivity(a, nameOf)}
            </T>
            <T className="text-[11.5px] text-muted">{fmtRelative(a.created_at)}</T>
          </View>
        </Tap>
      ))}
    </View>
  );
}
