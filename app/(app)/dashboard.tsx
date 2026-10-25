import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { View } from "react-native";
import { ActivityList } from "@/components/madar/activity";
import { Page } from "@/components/madar/shell";
import { DueLabel, PriorityPill, TaskForm } from "@/components/madar/tasks";
import { Avatar, Button, C, Card, EmptyState, Icon, ProgressBar, SectionLabel, T, Tap, useIsWide, type IconName } from "@/components/madar/ui";
import { addDays, fmtHours, fmtTodayHeading, greeting, isOverdue, sessionMinutes, startOfWeek, todayISO, zonedToUtc } from "@/lib/madar/format";
import { PROJECT_STATUS_LABELS, ROLE_LABELS } from "@/lib/madar/labels";
import { canCreateTask, canManageTask, isAssignee, isLead } from "@/lib/madar/permissions";
import { useLookups, useRecentActivity, useSessionsBetween, useTasks } from "@/lib/madar/queries";
import { useMe, useSession } from "@/lib/madar/session";
import { sortTasks } from "@/lib/madar/task-utils";
import type { Task } from "@/lib/madar/types";

export default function Dashboard() {
  const me = useMe();
  const { settings } = useSession();
  const router = useRouter();
  const wide = useIsWide();
  const tasksQuery = useTasks();
  const { profiles, projects } = useLookups();
  const activity = useRecentActivity(10);
  const [creating, setCreating] = useState(false);
  const lead = isLead(me) || me.role === "viewer";

  const today = todayISO();
  const weekStart = startOfWeek(today);
  const fromUtc = zonedToUtc(weekStart).toISOString();
  const toUtc = zonedToUtc(addDays(weekStart, 7)).toISOString();
  const sessions = useSessionsBetween(fromUtc, toUtc);

  const data = useMemo(() => {
    const tasks = tasksQuery.data ?? [];
    const open = tasks.filter((t) => t.status !== "done");
    const mine = open.filter((t) => isAssignee(me, t));
    const review = tasks.filter((t) => t.status === "review" && (canManageTask(me, t) || t.reviewer_id === me.id));
    const overdue = (lead ? open : mine).filter((t) => isOverdue(t));
    const dueToday = mine.filter((t) => t.due_date === today);
    const doneThisWeek = tasks.filter((t) => t.status === "done" && t.completed_at && t.completed_at >= fromUtc);
    const allSessions = sessions.data ?? [];
    const myMinutes = allSessions.filter((s) => s.user_id === me.id).reduce((a, s) => a + sessionMinutes(s), 0);
    const teamMinutes = allSessions.reduce((a, s) => a + sessionMinutes(s), 0);
    return { tasks, open, mine, review, overdue, dueToday, doneThisWeek, myMinutes, teamMinutes, allSessions };
  }, [tasksQuery.data, sessions.data, me, lead, today, fromUtc]);

  const firstName = me.full_name.split(" ")[0];

  const stats: { label: string; value: string; hint: string; icon: IconName; tone: string; onPress?: () => void }[] = lead
    ? [
        { label: "مهام مفتوحة", value: String(data.open.length), hint: `${data.doneThisWeek.length} اكتملت هذا الأسبوع`, icon: "layers", tone: C.primary, onPress: () => router.push("/tasks?scope=all" as any) },
        { label: "متأخرة", value: String(data.overdue.length), hint: "تجاوزت موعد التسليم", icon: "alert-triangle", tone: C.error, onPress: () => router.push("/tasks?scope=overdue" as any) },
        { label: "بانتظار المراجعة", value: String(data.review.length), hint: "تحتاج اعتمادك", icon: "inbox", tone: C.warning, onPress: () => router.push("/tasks?scope=review" as any) },
        { label: "ساعات الفريق", value: fmtHours(data.teamMinutes), hint: "منذ بداية الأسبوع", icon: "clock", tone: C.info, onPress: () => router.push("/reports" as any) },
      ]
    : [
        { label: "مهامي المفتوحة", value: String(data.mine.length), hint: `${data.doneThisWeek.length} اكتملت هذا الأسبوع`, icon: "check-square", tone: C.primary, onPress: () => router.push("/tasks?scope=mine" as any) },
        { label: "مستحقة اليوم", value: String(data.dueToday.length), hint: "ركّز عليها أولًا", icon: "sun", tone: C.warning, onPress: () => router.push("/tasks?scope=mine" as any) },
        { label: "متأخرة", value: String(data.overdue.length), hint: "تجاوزت موعد التسليم", icon: "alert-triangle", tone: C.error, onPress: () => router.push("/tasks?scope=overdue" as any) },
        { label: "ساعاتي", value: fmtHours(data.myMinutes), hint: "منذ بداية الأسبوع", icon: "clock", tone: C.info, onPress: () => router.push("/reports" as any) },
      ];

  const myList = sortTasks(data.mine, "due").slice(0, 6);
  const activeProjects = projects.filter((p) => p.status === "active" || p.status === "planning").slice(0, 5);

  return (
    <Page
      title={`${greeting()}، ${firstName}`}
      subtitle={`${fmtTodayHeading()} · ${settings?.company_name ?? ""}`}
      actions={canCreateTask(me) ? <Button title="مهمة جديدة" icon="plus" onPress={() => setCreating(true)} /> : null}
    >
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 18 }}>
        {stats.map((s) => (
          <Tap
            key={s.label}
            onPress={s.onPress}
            style={{ flexBasis: wide ? 0 : "46%", flexGrow: 1, backgroundColor: C.surface, borderRadius: 18, borderWidth: 1, borderColor: C.border, padding: 16, gap: 8 }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <View style={{ width: 30, height: 30, borderRadius: 10, backgroundColor: s.tone + "18", alignItems: "center", justifyContent: "center" }}>
                <Icon name={s.icon} size={15} color={s.tone} />
              </View>
              <T weight="semibold" className="flex-1 text-[12.5px] text-muted" numberOfLines={1}>
                {s.label}
              </T>
            </View>
            <T weight="bold" style={{ fontSize: 30, lineHeight: 40, fontVariant: ["tabular-nums"] }}>
              {s.value}
            </T>
            <T className="text-[11.5px] text-muted" numberOfLines={1}>
              {s.hint}
            </T>
          </Tap>
        ))}
      </View>

      <View style={{ flexDirection: wide ? "row" : "column", gap: 16, alignItems: wide ? "flex-start" : "stretch" }}>
        <View style={{ flex: wide ? 1.5 : undefined, gap: 16 }}>
          {lead && data.review.length ? (
            <Card style={{ gap: 10, borderColor: C.warning + "55" }}>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <SectionLabel className="flex-1">بانتظار مراجعتك</SectionLabel>
                <Tap onPress={() => router.push("/tasks?scope=review" as any)}>
                  <T weight="semibold" className="text-[12.5px]" style={{ color: C.primary }}>
                    عرض الكل
                  </T>
                </Tap>
              </View>
              {data.review.slice(0, 5).map((t) => (
                <TaskLine key={t.id} task={t} />
              ))}
            </Card>
          ) : null}

          <Card style={{ gap: 10 }}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <SectionLabel className="flex-1">مهامي القادمة</SectionLabel>
              <Tap onPress={() => router.push("/tasks?scope=mine" as any)}>
                <T weight="semibold" className="text-[12.5px]" style={{ color: C.primary }}>
                  كل مهامي
                </T>
              </Tap>
            </View>
            {myList.length ? (
              myList.map((t) => <TaskLine key={t.id} task={t} />)
            ) : (
              <EmptyState icon="coffee" title="لا توجد مهام مفتوحة مسندة إليك" hint={me.role === "viewer" ? "حساب المشاهدة لا تُسند إليه مهام." : "عندما تُسند إليك مهمة ستظهر هنا."} />
            )}
          </Card>

          {lead ? <Workload tasks={data.tasks} sessions={data.allSessions} profiles={profiles} /> : null}
        </View>

        <View style={{ flex: wide ? 1 : undefined, gap: 16 }}>
          <Card style={{ gap: 12 }}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <SectionLabel className="flex-1">المشاريع الجارية</SectionLabel>
              <Tap onPress={() => router.push("/projects" as any)}>
                <T weight="semibold" className="text-[12.5px]" style={{ color: C.primary }}>
                  كل المشاريع
                </T>
              </Tap>
            </View>
            {activeProjects.length ? (
              activeProjects.map((p) => {
                const pt = data.tasks.filter((t) => t.project_id === p.id);
                const done = pt.filter((t) => t.status === "done").length;
                return (
                  <Tap key={p.id} onPress={() => router.push(`/projects/${p.id}` as any)} style={{ gap: 6 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <View style={{ width: 9, height: 9, borderRadius: 3, backgroundColor: p.color }} />
                      <T weight="semibold" className="flex-1" numberOfLines={1}>
                        {p.name}
                      </T>
                      <T className="text-[12px] text-muted">
                        {done}/{pt.length}
                      </T>
                    </View>
                    <ProgressBar value={pt.length ? done / pt.length : 0} color={p.color} />
                    <T className="text-[11px] text-muted">{PROJECT_STATUS_LABELS[p.status]}</T>
                  </Tap>
                );
              })
            ) : (
              <T className="text-[13px] text-muted">لا توجد مشاريع نشطة.</T>
            )}
          </Card>
          <Card style={{ gap: 8 }}>
            <SectionLabel>آخر النشاطات</SectionLabel>
            <ActivityList items={activity.data ?? []} showTask />
          </Card>
        </View>
      </View>
      <TaskForm visible={creating} onClose={() => setCreating(false)} onSaved={(id) => router.push(`/tasks/${id}` as any)} />
    </Page>
  );
}

function TaskLine({ task }: { task: Task }) {
  const router = useRouter();
  const { projectMap } = useLookups();
  const project = task.project_id ? projectMap.get(task.project_id) : null;
  return (
    <Tap
      onPress={() => router.push(`/tasks/${task.id}` as any)}
      style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8, borderTopWidth: 1, borderTopColor: C.border }}
    >
      <View style={{ width: 4, alignSelf: "stretch", borderRadius: 2, backgroundColor: project?.color ?? C.border }} />
      <View style={{ flex: 1, gap: 2 }}>
        <T weight="semibold" numberOfLines={1}>
          {task.title}
        </T>
        <View style={{ flexDirection: "row", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <DueLabel task={task} />
          {project ? (
            <T className="text-[12px] text-muted" numberOfLines={1}>
              · {project.name}
            </T>
          ) : null}
        </View>
      </View>
      <PriorityPill priority={task.priority} />
    </Tap>
  );
}

function Workload({
  tasks,
  sessions,
  profiles,
}: {
  tasks: Task[];
  sessions: { user_id: string; started_at: string; ended_at: string | null }[];
  profiles: ReturnType<typeof useLookups>["profiles"];
}) {
  const router = useRouter();
  const me = useMe();
  const members = profiles.filter(
    (p) => p.status === "active" && p.role !== "viewer" && (me.role === "admin" || me.role === "viewer" || p.department_id === me.department_id),
  );
  const rows = members
    .map((p) => {
      const open = tasks.filter((t) => t.status !== "done" && t.task_assignees?.some((a) => a.user_id === p.id));
      const minutes = sessions.filter((s) => s.user_id === p.id).reduce((a, s) => a + sessionMinutes(s), 0);
      return { p, open: open.length, overdue: open.filter((t) => isOverdue(t)).length, minutes };
    })
    .sort((a, b) => b.open - a.open)
    .slice(0, 8);
  const max = Math.max(1, ...rows.map((r) => r.open));
  return (
    <Card style={{ gap: 12 }}>
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <SectionLabel className="flex-1">حمل العمل على الفريق</SectionLabel>
        <T className="text-[11.5px] text-muted">مهام مفتوحة · ساعات الأسبوع</T>
      </View>
      {rows.length === 0 ? <T className="text-[13px] text-muted">لا يوجد أعضاء نشطون بعد.</T> : null}
      {rows.map((r) => (
        <Tap key={r.p.id} onPress={() => router.push(`/team/${r.p.id}` as any)} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <Avatar id={r.p.id} name={r.p.full_name} size={30} />
          <View style={{ flex: 1, gap: 4 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <T weight="semibold" className="flex-1 text-[13px]" numberOfLines={1}>
                {r.p.full_name}
                <T className="text-[11.5px] text-muted"> · {r.p.job_title || ROLE_LABELS[r.p.role]}</T>
              </T>
              {r.overdue ? (
                <T style={{ color: C.error }} className="text-[11.5px]" weight="semibold">
                  {r.overdue} متأخرة
                </T>
              ) : null}
            </View>
            <ProgressBar value={r.open / max} color={r.overdue ? C.warning : C.primary} />
          </View>
          <View style={{ width: 66, alignItems: "flex-end" }}>
            <T weight="bold" className="text-[13px]">
              {r.open}
            </T>
            <T className="text-[11px] text-muted">{fmtHours(r.minutes)} س</T>
          </View>
        </Tap>
      ))}
    </Card>
  );
}
