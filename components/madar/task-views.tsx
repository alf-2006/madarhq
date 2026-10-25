import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { ScrollView, View, useWindowDimensions } from "react-native";
import {
  addDays,
  addMonths,
  daysBetween,
  fmtDay,
  fmtMinutes,
  fmtMonth,
  isOverdue,
  parseISODate,
  startOfMonth,
  startOfWeek,
  todayISO,
} from "@/lib/madar/format";
import { STATUS_LABELS, STATUS_ORDER, STATUS_TONE } from "@/lib/madar/labels";
import { useLookups } from "@/lib/madar/queries";
import type { Task } from "@/lib/madar/types";
import { Assignees, DueLabel, PriorityPill, StatusMenu } from "./tasks";
import { C, EmptyState, Icon, IconButton, T, Tap, toneColor, useIsWide, insetStart } from "./ui";

type ViewProps = { tasks: Task[]; minutes: Map<string, number>; empty?: React.ReactNode };

function useOpenTask() {
  const router = useRouter();
  return (task: Task) => router.push(`/tasks/${task.id}` as any);
}

function ProjectTag({ projectId }: { projectId: string | null }) {
  const { projectMap } = useLookups();
  const project = projectId ? projectMap.get(projectId) : null;
  if (!project) return null;
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 5, maxWidth: 180 }}>
      <View style={{ width: 7, height: 7, borderRadius: 2, backgroundColor: project.color }} />
      <T className="text-[12px] text-muted" numberOfLines={1}>
        {project.name}
      </T>
    </View>
  );
}

// ---------------------------------------------------------------- table / list

export function TaskTable({ tasks, minutes, empty }: ViewProps) {
  const wide = useIsWide(980);
  const open = useOpenTask();
  if (tasks.length === 0) return <>{empty ?? <EmptyState icon="check-square" title="لا توجد مهام مطابقة" />}</>;
  if (!wide) {
    return (
      <View style={{ gap: 10 }}>
        {tasks.map((t) => (
          <TaskCard key={t.id} task={t} minutes={minutes.get(t.id)} onPress={() => open(t)} />
        ))}
      </View>
    );
  }
  const head = (label: string, flex: number, width?: number) => (
    <View style={{ flex: width ? undefined : flex, width }}>
      <T weight="semibold" className="text-[11.5px] text-muted">
        {label}
      </T>
    </View>
  );
  return (
    <View style={{ backgroundColor: C.surface, borderRadius: 18, borderWidth: 1, borderColor: C.border, overflow: "hidden" }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 18, paddingVertical: 11, backgroundColor: C.sand }}>
        {head("#", 0, 44)}
        {head("المهمة", 3)}
        {head("المسؤولون", 0, 96)}
        {head("الحالة", 0, 132)}
        {head("الأولوية", 0, 88)}
        {head("الاستحقاق", 0, 116)}
        {head("الوقت الفعلي", 0, 92)}
      </View>
      {tasks.map((t, i) => (
        <Tap
          key={t.id}
          onPress={() => open(t)}
          style={({ pressed }) => ({
            flexDirection: "row",
            alignItems: "center",
            gap: 14,
            paddingHorizontal: 18,
            paddingVertical: 12,
            borderTopWidth: i === 0 ? 0 : 1,
            borderTopColor: C.border,
            backgroundColor: pressed ? C.background : C.surface,
          })}
        >
          <T className="text-[12px] text-muted" style={{ width: 44, fontVariant: ["tabular-nums"] }}>
            {t.number}
          </T>
          <View style={{ flex: 3, gap: 2 }}>
            <T weight="semibold" numberOfLines={1} style={{ textDecorationLine: t.status === "done" ? "line-through" : "none", color: t.status === "done" ? C.muted : C.foreground }}>
              {t.title}
            </T>
            <ProjectTag projectId={t.project_id} />
          </View>
          <View style={{ width: 96 }}>
            <Assignees task={t} />
          </View>
          <View style={{ width: 132 }}>
            <StatusMenu task={t} />
          </View>
          <View style={{ width: 88 }}>
            <PriorityPill priority={t.priority} />
          </View>
          <View style={{ width: 116 }}>
            <DueLabel task={t} />
          </View>
          <View style={{ width: 92 }}>
            <T className="text-[12.5px]" style={{ fontVariant: ["tabular-nums"] }}>
              {minutes.get(t.id) ? fmtMinutes(minutes.get(t.id)) : "—"}
              {t.estimate_minutes ? <T className="text-[11px] text-muted"> / {fmtMinutes(t.estimate_minutes)}</T> : null}
            </T>
          </View>
        </Tap>
      ))}
    </View>
  );
}

export function TaskCard({ task, minutes, onPress, compact }: { task: Task; minutes?: number; onPress: () => void; compact?: boolean }) {
  const overdue = isOverdue(task);
  return (
    <Tap
      onPress={onPress}
      style={{
        backgroundColor: C.surface,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: overdue ? C.error + "55" : C.border,
        padding: 14,
        gap: 10,
      }}
    >
      <View style={{ flexDirection: "row", gap: 8, alignItems: "flex-start" }}>
        <T weight="semibold" style={{ flex: 1, lineHeight: 22, color: task.status === "done" ? C.muted : C.foreground }} numberOfLines={compact ? 2 : 3}>
          {task.title}
        </T>
        <T className="text-[11px] text-muted">#{task.number}</T>
      </View>
      <ProjectTag projectId={task.project_id} />
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        {!compact ? <StatusMenu task={task} /> : null}
        <PriorityPill priority={task.priority} />
        <DueLabel task={task} compact />
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Assignees task={task} />
        {minutes ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <Icon name="clock" size={12} color={C.muted} />
            <T className="text-[12px] text-muted">{fmtMinutes(minutes)}</T>
          </View>
        ) : null}
      </View>
    </Tap>
  );
}

// ---------------------------------------------------------------- kanban

export function TaskKanban({ tasks, minutes }: ViewProps) {
  const open = useOpenTask();
  const { width } = useWindowDimensions();
  const colWidth = width < 600 ? Math.min(300, width - 64) : 290;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={{ gap: 12, paddingBottom: 8 }}>
      {STATUS_ORDER.map((status) => {
        const items = tasks.filter((t) => t.status === status);
        return (
          <View key={status} style={{ width: colWidth, backgroundColor: C.sand, borderRadius: 18, padding: 10, gap: 10, alignSelf: "flex-start" }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 4, paddingTop: 2 }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: toneColor(STATUS_TONE[status]) }} />
              <T weight="bold" style={{ flex: 1 }}>
                {STATUS_LABELS[status]}
              </T>
              <T weight="semibold" className="text-[12px] text-muted">
                {items.length}
              </T>
            </View>
            {items.map((t) => (
              <View key={t.id} style={{ gap: 6 }}>
                <TaskCard task={t} minutes={minutes.get(t.id)} onPress={() => open(t)} compact />
                <StatusMenu
                  task={t}
                  trigger={(openMenu) => (
                    <Tap onPress={openMenu} style={{ flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start", paddingHorizontal: 6 }}>
                      <Icon name="move" size={12} color={C.muted} />
                      <T className="text-[11.5px] text-muted">نقل</T>
                    </Tap>
                  )}
                />
              </View>
            ))}
            {items.length === 0 ? (
              <View style={{ paddingVertical: 18, alignItems: "center" }}>
                <T className="text-[12px] text-muted">لا توجد مهام</T>
              </View>
            ) : null}
          </View>
        );
      })}
    </ScrollView>
  );
}

// ---------------------------------------------------------------- calendar

const WEEKDAYS = ["سبت", "أحد", "اثنين", "ثلاثاء", "أربعاء", "خميس", "جمعة"];

export function TaskCalendar({ tasks, minutes }: ViewProps) {
  const open = useOpenTask();
  const today = todayISO();
  const [month, setMonth] = useState(startOfMonth(today));
  const [selected, setSelected] = useState<string | null>(today);
  const wide = useIsWide(760);

  const byDay = useMemo(() => {
    const map = new Map<string, Task[]>();
    tasks.forEach((t) => {
      if (!t.due_date) return;
      const list = map.get(t.due_date) ?? [];
      list.push(t);
      map.set(t.due_date, list);
    });
    return map;
  }, [tasks]);

  const gridStart = startOfWeek(month);
  const days = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  const weeks = [0, 1, 2, 3, 4, 5].map((w) => days.slice(w * 7, w * 7 + 7)).filter((w, i) => i < 5 || w[0].slice(0, 7) === month.slice(0, 7));
  const selectedTasks = selected ? byDay.get(selected) ?? [] : [];
  const undated = tasks.filter((t) => !t.due_date).length;

  return (
    <View style={{ gap: 14 }}>
      <View style={{ backgroundColor: C.surface, borderRadius: 18, borderWidth: 1, borderColor: C.border, overflow: "hidden" }}>
        <View style={{ flexDirection: "row", alignItems: "center", padding: 12, gap: 6 }}>
          <IconButton icon="chevron-right" label="الشهر السابق" onPress={() => setMonth(addMonths(month, -1))} />
          <T weight="bold" style={{ flex: 1, textAlign: "center", fontSize: 16 }}>
            {fmtMonth(month)}
          </T>
          <IconButton icon="chevron-left" label="الشهر التالي" onPress={() => setMonth(addMonths(month, 1))} />
        </View>
        <View style={{ flexDirection: "row", borderTopWidth: 1, borderTopColor: C.border, backgroundColor: C.sand }}>
          {WEEKDAYS.map((d) => (
            <View key={d} style={{ flex: 1, paddingVertical: 8, alignItems: "center" }}>
              <T weight="semibold" className="text-[11.5px] text-muted">
                {d}
              </T>
            </View>
          ))}
        </View>
        {weeks.map((week) => (
          <View key={week[0]} style={{ flexDirection: "row", borderTopWidth: 1, borderTopColor: C.border }}>
            {week.map((day, i) => {
              const inMonth = day.slice(0, 7) === month.slice(0, 7);
              const items = byDay.get(day) ?? [];
              const isToday = day === today;
              const isSel = day === selected;
              return (
                <Tap
                  key={day}
                  onPress={() => setSelected(day)}
                  style={{
                    flex: 1,
                    minHeight: wide ? 96 : 58,
                    padding: wide ? 6 : 4,
                    gap: 3,
                    borderLeftWidth: i === 6 ? 0 : 1,
                    borderLeftColor: C.border,
                    backgroundColor: isSel ? C["primary-soft"] : inMonth ? C.surface : C.background,
                  }}
                >
                  <View
                    style={{
                      alignSelf: "flex-start",
                      minWidth: 22,
                      height: 22,
                      borderRadius: 11,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: isToday ? C.primary : "transparent",
                    }}
                  >
                    <T weight={isToday ? "bold" : "medium"} style={{ fontSize: 12, color: isToday ? "#fff" : inMonth ? C.foreground : C.muted + "99" }}>
                      {parseISODate(day).getUTCDate()}
                    </T>
                  </View>
                  {wide ? (
                    <>
                      {items.slice(0, 3).map((t) => (
                        <View
                          key={t.id}
                          style={{
                            backgroundColor: t.status === "done" ? C.sand : isOverdue(t) ? C["error-soft"] : C["primary-soft"],
                            borderRadius: 6,
                            paddingHorizontal: 5,
                            paddingVertical: 1,
                          }}
                        >
                          <T numberOfLines={1} style={{ fontSize: 11, color: t.status === "done" ? C.muted : isOverdue(t) ? C.error : C.primary }}>
                            {t.title}
                          </T>
                        </View>
                      ))}
                      {items.length > 3 ? <T className="text-[10.5px] text-muted">+{items.length - 3} أخرى</T> : null}
                    </>
                  ) : items.length ? (
                    <View style={{ flexDirection: "row", gap: 2, flexWrap: "wrap" }}>
                      {items.slice(0, 4).map((t) => (
                        <View key={t.id} style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: isOverdue(t) ? C.error : t.status === "done" ? C.muted : C.primary }} />
                      ))}
                    </View>
                  ) : null}
                </Tap>
              );
            })}
          </View>
        ))}
      </View>
      {selected ? (
        <View style={{ gap: 10 }}>
          <T weight="bold">
            مستحقة في {fmtDay(selected)} · {selectedTasks.length}
          </T>
          {selectedTasks.map((t) => (
            <TaskCard key={t.id} task={t} minutes={minutes.get(t.id)} onPress={() => open(t)} />
          ))}
          {selectedTasks.length === 0 ? <T className="text-muted">لا توجد مهام مستحقة في هذا اليوم.</T> : null}
        </View>
      ) : null}
      {undated ? <T className="text-[12px] text-muted">{undated} مهمة بدون تاريخ استحقاق لا تظهر في التقويم.</T> : null}
    </View>
  );
}

// ---------------------------------------------------------------- timeline

export function TaskTimeline({ tasks }: ViewProps) {
  const open = useOpenTask();
  const today = todayISO();
  const wide = useIsWide(760);
  const span = wide ? 42 : 21;
  const [start, setStart] = useState(addDays(startOfWeek(today), -7));
  const end = addDays(start, span - 1);
  const labelWidth = wide ? 230 : 120;

  const rows = tasks
    .filter((t) => t.start_date || t.due_date)
    .map((t) => {
      const s = t.start_date ?? t.created_at.slice(0, 10);
      const e = t.due_date ?? s;
      return { task: t, s: s <= e ? s : e, e: e >= s ? e : s };
    })
    .filter((r) => r.e >= start && r.s <= end)
    .sort((a, b) => (a.s < b.s ? -1 : a.s > b.s ? 1 : 0));

  const weeks = Array.from({ length: Math.ceil(span / 7) }, (_, i) => addDays(start, i * 7));
  const todayOffset = daysBetween(start, today);

  return (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <IconButton icon="chevron-right" label="السابق" onPress={() => setStart(addDays(start, -14))} />
        <T weight="bold" style={{ flex: 1, textAlign: "center" }}>
          {fmtDay(start)} — {fmtDay(end)}
        </T>
        <IconButton icon="chevron-left" label="التالي" onPress={() => setStart(addDays(start, 14))} />
      </View>
      <View style={{ backgroundColor: C.surface, borderRadius: 18, borderWidth: 1, borderColor: C.border, overflow: "hidden" }}>
        <View style={{ flexDirection: "row", backgroundColor: C.sand, borderBottomWidth: 1, borderBottomColor: C.border }}>
          <View style={{ width: labelWidth, padding: 10 }}>
            <T weight="semibold" className="text-[11.5px] text-muted">
              المهمة
            </T>
          </View>
          <View style={{ flex: 1, flexDirection: "row" }}>
            {weeks.map((w) => (
              <View key={w} style={{ flex: 1, padding: 10, borderRightWidth: 1, borderRightColor: C.border }}>
                <T weight="semibold" className="text-[11.5px] text-muted" numberOfLines={1}>
                  {fmtDay(w)}
                </T>
              </View>
            ))}
          </View>
        </View>
        {rows.length === 0 ? (
          <EmptyState icon="sliders" title="لا توجد مهام في هذه الفترة" hint="يعتمد الجدول الزمني على تاريخي البدء والاستحقاق." />
        ) : (
          rows.map(({ task, s, e }, i) => {
            const from = Math.max(0, daysBetween(start, s));
            const to = Math.min(span - 1, daysBetween(start, e));
            const left = (from / span) * 100;
            const widthPct = ((to - from + 1) / span) * 100;
            const color = task.status === "done" ? C.muted : isOverdue(task) ? C.error : toneColor(STATUS_TONE[task.status]);
            return (
              <Tap key={task.id} onPress={() => open(task)} style={{ flexDirection: "row", borderTopWidth: i === 0 ? 0 : 1, borderTopColor: C.border }}>
                <View style={{ width: labelWidth, paddingHorizontal: 10, paddingVertical: 9, gap: 1 }}>
                  <T weight="medium" numberOfLines={1} className="text-[13px]">
                    {task.title}
                  </T>
                  <T className="text-[11px] text-muted">{STATUS_LABELS[task.status]}</T>
                </View>
                <View style={{ flex: 1, justifyContent: "center", position: "relative" }}>
                  {todayOffset >= 0 && todayOffset < span ? (
                    <View style={{ position: "absolute", top: 0, bottom: 0, ...insetStart(`${((todayOffset + 0.5) / span) * 100}%`), width: 1.5, backgroundColor: C.warning + "88" }} />
                  ) : null}
                  <View
                    style={{
                      position: "absolute",
                      ...insetStart(`${left}%`),
                      width: `${widthPct}%`,
                      height: 18,
                      borderRadius: 6,
                      backgroundColor: color + "33",
                      borderWidth: 1,
                      borderColor: color,
                    }}
                  />
                </View>
              </Tap>
            );
          })
        )}
      </View>
      <View style={{ flexDirection: "row", gap: 14, flexWrap: "wrap" }}>
        <Legend color={C.warning} label="اليوم" />
        <Legend color={C.error} label="متأخرة" />
        <Legend color={C.info} label="قيد التنفيذ" />
        <Legend color={C.muted} label="مكتملة" />
      </View>
    </View>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
      <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: color }} />
      <T className="text-[12px] text-muted">{label}</T>
    </View>
  );
}

