import { useMemo, useState } from "react";
import { View } from "react-native";
import { Page } from "@/components/madar/shell";
import { Avatar, Button, C, Card, Chip, DateField, EmptyState, Loading, ProgressBar, SectionLabel, Select, T, useIsWide, useToast } from "@/components/madar/ui";
import { exportCSV, toCSV } from "@/lib/madar/csv";
import {
  addDays,
  addMonths,
  daysBetween,
  fmtDay,
  fmtDayFull,
  fmtHours,
  fmtMinutes,
  fmtWeekdayShort,
  isOverdue,
  isoDateInTz,
  sessionMinutes,
  startOfMonth,
  startOfWeek,
  timeInTz,
  todayISO,
  zonedToUtc,
} from "@/lib/madar/format";
import { PRIORITY_LABELS, ROLE_LABELS, STATUS_LABELS } from "@/lib/madar/labels";
import { isLead } from "@/lib/madar/permissions";
import { useLookups, useSessionsBetween, useTasks } from "@/lib/madar/queries";
import { useMe } from "@/lib/madar/session";

type Period = "week" | "last_week" | "month" | "last_month" | "custom";

export default function ReportsScreen() {
  const me = useMe();
  const toast = useToast();
  const wide = useIsWide();
  const lead = isLead(me) || me.role === "viewer";
  const { profiles, departments, projects, profileMap, projectMap, departmentMap } = useLookups();
  const tasksQuery = useTasks();
  const today = todayISO();
  const [period, setPeriod] = useState<Period>("week");
  const [customFrom, setCustomFrom] = useState<string | null>(addDays(today, -13));
  const [customTo, setCustomTo] = useState<string | null>(today);
  const [memberId, setMemberId] = useState<string | null>(lead ? null : me.id);
  const [deptId, setDeptId] = useState<string | null>(null);

  const [from, toExclusive] = useMemo(() => {
    if (period === "week") return [startOfWeek(today), addDays(startOfWeek(today), 7)];
    if (period === "last_week") return [addDays(startOfWeek(today), -7), startOfWeek(today)];
    if (period === "month") return [startOfMonth(today), addMonths(startOfMonth(today), 1)];
    if (period === "last_month") return [addMonths(startOfMonth(today), -1), startOfMonth(today)];
    const f = customFrom ?? today;
    const t = customTo && customTo >= f ? customTo : f;
    return [f, addDays(t, 1)];
  }, [period, customFrom, customTo, today]);

  const fromUtc = zonedToUtc(from).toISOString();
  const toUtc = zonedToUtc(toExclusive).toISOString();
  const sessionsQuery = useSessionsBetween(fromUtc, toUtc);

  const taskMap = useMemo(() => new Map((tasksQuery.data ?? []).map((t) => [t.id, t])), [tasksQuery.data]);

  const scopedMembers = useMemo(
    () =>
      profiles.filter(
        (p) =>
          p.status !== "pending" &&
          p.role !== "viewer" &&
          (!memberId || p.id === memberId) &&
          (!deptId || p.department_id === deptId) &&
          (lead ? me.role === "admin" || me.role === "viewer" || p.department_id === me.department_id || p.id === me.id : p.id === me.id),
      ),
    [profiles, memberId, deptId, lead, me],
  );
  const memberIds = useMemo(() => new Set(scopedMembers.map((m) => m.id)), [scopedMembers]);

  const report = useMemo(() => {
    const sessions = (sessionsQuery.data ?? []).filter((s) => memberIds.has(s.user_id));
    const totalMinutes = sessions.reduce((a, s) => a + sessionMinutes(s), 0);
    const completed = (tasksQuery.data ?? []).filter(
      (t) =>
        t.status === "done" &&
        t.completed_at &&
        t.completed_at >= fromUtc &&
        t.completed_at < toUtc &&
        (t.task_assignees ?? []).some((a) => memberIds.has(a.user_id)),
    );
    const withDue = completed.filter((t) => t.due_date);
    const onTime = withDue.filter((t) => isoDateInTz(new Date(t.completed_at!)) <= t.due_date!).length;
    const overdueNow = (tasksQuery.data ?? []).filter((t) => isOverdue(t) && (t.task_assignees ?? []).some((a) => memberIds.has(a.user_id))).length;

    const span = Math.min(62, daysBetween(from, toExclusive));
    const days = Array.from({ length: span }, (_, i) => addDays(from, i));
    const perDay = new Map<string, number>();
    sessions.forEach((s) => {
      const d = isoDateInTz(new Date(s.started_at));
      perDay.set(d, (perDay.get(d) ?? 0) + sessionMinutes(s));
    });

    const byMember = scopedMembers
      .map((m) => {
        const ms = sessions.filter((s) => s.user_id === m.id);
        const done = completed.filter((t) => t.task_assignees?.some((a) => a.user_id === m.id));
        const due = done.filter((t) => t.due_date);
        const ontime = due.filter((t) => isoDateInTz(new Date(t.completed_at!)) <= t.due_date!).length;
        return { m, minutes: ms.reduce((a, s) => a + sessionMinutes(s), 0), sessions: ms.length, done: done.length, onTimeRate: due.length ? ontime / due.length : null };
      })
      .sort((a, b) => b.minutes - a.minutes);

    const projectMinutes = new Map<string, number>();
    sessions.forEach((s) => {
      const pid = taskMap.get(s.task_id)?.project_id ?? "none";
      projectMinutes.set(pid, (projectMinutes.get(pid) ?? 0) + sessionMinutes(s));
    });
    const byProject = [...projectMinutes.entries()].sort((a, b) => b[1] - a[1]);

    const taskMinutes = new Map<string, number>();
    sessions.forEach((s) => taskMinutes.set(s.task_id, (taskMinutes.get(s.task_id) ?? 0) + sessionMinutes(s)));
    const topTasks = [...taskMinutes.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);

    return { sessions, totalMinutes, completed, onTimeRate: withDue.length ? onTime / withDue.length : null, overdueNow, days, perDay, byMember, byProject, topTasks };
  }, [sessionsQuery.data, tasksQuery.data, memberIds, scopedMembers, from, toExclusive, fromUtc, toUtc, taskMap]);

  const maxDay = Math.max(1, ...report.days.map((d) => report.perDay.get(d) ?? 0));

  const exportSessions = () => {
    const rows = report.sessions.map((s) => {
      const t = taskMap.get(s.task_id);
      const p = t?.project_id ? projectMap.get(t.project_id) : null;
      return [
        isoDateInTz(new Date(s.started_at)),
        profileMap.get(s.user_id)?.full_name ?? "",
        t ? `#${t.number} ${t.title}` : s.task_id,
        p?.name ?? "",
        timeInTz(new Date(s.started_at)),
        s.ended_at ? timeInTz(new Date(s.ended_at)) : "",
        Math.round(sessionMinutes(s)),
        s.is_manual ? "يدوي" : "مؤقت",
        s.note ?? "",
      ];
    });
    exportCSV(`madar-time-${from}.csv`, toCSV(["التاريخ", "الموظف", "المهمة", "المشروع", "من", "إلى", "الدقائق", "النوع", "ملاحظة"], rows));
    toast.show("صُدّر سجل الوقت");
  };

  const exportTasks = () => {
    const list = (tasksQuery.data ?? []).filter((t) => (lead && !memberId && !deptId ? true : (t.task_assignees ?? []).some((a) => memberIds.has(a.user_id))));
    const rows = list.map((t) => [
      t.number,
      t.title,
      STATUS_LABELS[t.status],
      PRIORITY_LABELS[t.priority],
      t.project_id ? projectMap.get(t.project_id)?.name ?? "" : "",
      t.department_id ? departmentMap.get(t.department_id)?.name ?? "" : "",
      (t.task_assignees ?? []).map((a) => profileMap.get(a.user_id)?.full_name ?? "").join(" | "),
      t.start_date ?? "",
      t.due_date ?? "",
      t.completed_at ? isoDateInTz(new Date(t.completed_at)) : "",
      t.estimate_minutes ?? "",
    ]);
    exportCSV(`madar-tasks-${today}.csv`, toCSV(["الرقم", "العنوان", "الحالة", "الأولوية", "المشروع", "القسم", "المسؤولون", "البدء", "الاستحقاق", "تاريخ الإكمال", "الوقت المقدّر بالدقائق"], rows));
    toast.show("صُدّرت المهام");
  };

  const periods: { value: Period; label: string }[] = [
    { value: "week", label: "هذا الأسبوع" },
    { value: "last_week", label: "الأسبوع الماضي" },
    { value: "month", label: "هذا الشهر" },
    { value: "last_month", label: "الشهر الماضي" },
    { value: "custom", label: "فترة مخصصة" },
  ];

  const loading = sessionsQuery.isLoading || tasksQuery.isLoading;

  return (
    <Page
      title="التقارير"
      subtitle={`${fmtDayFull(from)} — ${fmtDayFull(addDays(toExclusive, -1))}`}
      actions={
        <>
          <Button title="تصدير الوقت" icon="download" variant="secondary" onPress={exportSessions} />
          <Button title="تصدير المهام" icon="download" variant="secondary" onPress={exportTasks} />
        </>
      }
    >
      <View style={{ gap: 10, marginBottom: 18 }}>
        <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
          {periods.map((p) => (
            <Chip key={p.value} label={p.label} active={period === p.value} onPress={() => setPeriod(p.value)} />
          ))}
        </View>
        {period === "custom" ? (
          <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap", maxWidth: 520 }}>
            <View style={{ flex: 1, minWidth: 160 }}>
              <DateField value={customFrom} onChange={setCustomFrom} />
            </View>
            <View style={{ flex: 1, minWidth: 160 }}>
              <DateField value={customTo} onChange={setCustomTo} />
            </View>
          </View>
        ) : null}
        {lead ? (
          <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
            <View style={{ minWidth: 200, flex: 1, maxWidth: 280 }}>
              <Select
                value={memberId}
                onChange={setMemberId}
                options={profiles.filter((p) => p.status === "active" && p.role !== "viewer").map((p) => ({ value: p.id, label: p.full_name, hint: ROLE_LABELS[p.role] }))}
                noneLabel="كل الأعضاء"
                placeholder="كل الأعضاء"
                title="العضو"
              />
            </View>
            {me.role === "admin" || me.role === "viewer" ? (
              <View style={{ minWidth: 200, flex: 1, maxWidth: 280 }}>
                <Select value={deptId} onChange={setDeptId} options={departments.map((d) => ({ value: d.id, label: d.name, color: d.color }))} noneLabel="كل الأقسام" placeholder="كل الأقسام" title="القسم" />
              </View>
            ) : null}
          </View>
        ) : null}
      </View>

      {loading ? (
        <Loading />
      ) : (
        <View style={{ gap: 16 }}>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
            <Kpi label="ساعات العمل الفعلية" value={fmtHours(report.totalMinutes)} hint={`${report.sessions.length} جلسة`} />
            <Kpi label="مهام مكتملة" value={String(report.completed.length)} hint="خلال الفترة" />
            <Kpi label="الالتزام بالمواعيد" value={report.onTimeRate === null ? "—" : `${Math.round(report.onTimeRate * 100)}%`} hint="من المهام ذات الموعد" />
            <Kpi label="متأخرة حاليًا" value={String(report.overdueNow)} hint="مهام مفتوحة" color={report.overdueNow ? C.error : undefined} />
          </View>

          <Card style={{ gap: 12 }}>
            <SectionLabel>الساعات اليومية</SectionLabel>
            {report.totalMinutes === 0 ? (
              <EmptyState icon="clock" title="لا يوجد وقت مسجّل في هذه الفترة" hint="يُحسب الوقت من جلسات المؤقت والإدخالات اليدوية." />
            ) : (
              <View style={{ flexDirection: "row", alignItems: "flex-end", gap: report.days.length > 20 ? 3 : 8, height: 170, paddingTop: 10 }}>
                {report.days.map((d) => {
                  const v = report.perDay.get(d) ?? 0;
                  return (
                    <View key={d} style={{ flex: 1, alignItems: "center", gap: 4, height: "100%" }}>
                      <View style={{ flex: 1, width: "100%", alignItems: "center", justifyContent: "flex-end", gap: 3 }}>
                        {report.days.length <= 14 && v ? <T className="text-[10px] text-muted">{fmtHours(v)}</T> : null}
                        <View style={{ width: "100%", maxWidth: 34, height: `${Math.max(v ? 4 : 1, (v / maxDay) * 80)}%`, backgroundColor: v ? C.primary : C.border, borderRadius: 6 }} />
                      </View>
                      {report.days.length <= 14 ? (
                        <T className="text-[10px] text-muted" numberOfLines={1} style={{ height: 16 }}>
                          {report.days.length <= 7 ? fmtWeekdayShort(d) : fmtDay(d).split(" ")[0]}
                        </T>
                      ) : null}
                    </View>
                  );
                })}
              </View>
            )}
          </Card>

          <View style={{ flexDirection: wide ? "row" : "column", gap: 16, alignItems: wide ? "flex-start" : "stretch" }}>
            <Card style={{ flex: wide ? 1.4 : undefined, gap: 10 }}>
              <SectionLabel>{lead ? "حسب العضو" : "أدائي"}</SectionLabel>
              <View style={{ flexDirection: "row", gap: 8, paddingBottom: 4 }}>
                <T weight="semibold" className="flex-1 text-[11.5px] text-muted">
                  العضو
                </T>
                <T weight="semibold" className="text-[11.5px] text-muted" style={{ width: 70, textAlign: "center" }}>
                  الساعات
                </T>
                <T weight="semibold" className="text-[11.5px] text-muted" style={{ width: 60, textAlign: "center" }}>
                  مكتملة
                </T>
                <T weight="semibold" className="text-[11.5px] text-muted" style={{ width: 70, textAlign: "center" }}>
                  بالموعد
                </T>
              </View>
              {report.byMember.map((r) => (
                <View key={r.m.id} style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 6, borderTopWidth: 1, borderTopColor: C.border }}>
                  <Avatar id={r.m.id} name={r.m.full_name} size={28} />
                  <View style={{ flex: 1 }}>
                    <T weight="semibold" className="text-[13px]" numberOfLines={1}>
                      {r.m.full_name}
                    </T>
                    <T className="text-[11px] text-muted">{r.sessions} جلسة</T>
                  </View>
                  <T weight="bold" className="text-[13px]" style={{ width: 70, textAlign: "center" }}>
                    {fmtMinutes(r.minutes)}
                  </T>
                  <T className="text-[13px]" style={{ width: 60, textAlign: "center" }}>
                    {r.done}
                  </T>
                  <T className="text-[13px]" style={{ width: 70, textAlign: "center", color: r.onTimeRate !== null && r.onTimeRate < 0.6 ? C.error : C.foreground }}>
                    {r.onTimeRate === null ? "—" : `${Math.round(r.onTimeRate * 100)}%`}
                  </T>
                </View>
              ))}
              {report.byMember.length === 0 ? <T className="text-muted">لا يوجد أعضاء في هذا النطاق.</T> : null}
            </Card>

            <View style={{ flex: wide ? 1 : undefined, gap: 16 }}>
              <Card style={{ gap: 10 }}>
                <SectionLabel>الوقت حسب المشروع</SectionLabel>
                {report.byProject.length === 0 ? <T className="text-[13px] text-muted">لا يوجد وقت مسجّل.</T> : null}
                {report.byProject.map(([pid, minutes]) => {
                  const p = pid === "none" ? null : projects.find((x) => x.id === pid);
                  return (
                    <View key={pid} style={{ gap: 4 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                        <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: p?.color ?? C.muted }} />
                        <T className="flex-1 text-[13px]" numberOfLines={1}>
                          {p?.name ?? "بدون مشروع"}
                        </T>
                        <T weight="semibold" className="text-[12.5px]">
                          {fmtMinutes(minutes)}
                        </T>
                      </View>
                      <ProgressBar value={minutes / Math.max(1, report.totalMinutes)} color={p?.color ?? C.muted} />
                    </View>
                  );
                })}
              </Card>
              <Card style={{ gap: 8 }}>
                <SectionLabel>المهام الأكثر استهلاكًا للوقت</SectionLabel>
                {report.topTasks.length === 0 ? <T className="text-[13px] text-muted">لا يوجد وقت مسجّل.</T> : null}
                {report.topTasks.map(([tid, minutes]) => {
                  const t = taskMap.get(tid);
                  return (
                    <View key={tid} style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 4 }}>
                      <T className="flex-1 text-[13px]" numberOfLines={1}>
                        {t ? `#${t.number} ${t.title}` : "مهمة"}
                      </T>
                      <T weight="semibold" className="text-[12.5px]">
                        {fmtMinutes(minutes)}
                      </T>
                      {t?.estimate_minutes ? <T className="text-[11px] text-muted">/ {fmtMinutes(t.estimate_minutes)}</T> : null}
                    </View>
                  );
                })}
              </Card>
            </View>
          </View>
        </View>
      )}
    </Page>
  );
}

function Kpi({ label, value, hint, color }: { label: string; value: string; hint: string; color?: string }) {
  return (
    <View style={{ flexBasis: 200, flexGrow: 1, backgroundColor: C.surface, borderRadius: 18, borderWidth: 1, borderColor: C.border, padding: 16, gap: 4 }}>
      <T weight="semibold" className="text-[12.5px] text-muted">
        {label}
      </T>
      <T weight="bold" style={{ fontSize: 30, lineHeight: 42, color: color ?? C.foreground, fontVariant: ["tabular-nums"] }}>
        {value}
      </T>
      <T className="text-[11.5px] text-muted">{hint}</T>
    </View>
  );
}
