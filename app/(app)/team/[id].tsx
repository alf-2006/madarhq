import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { View } from "react-native";
import { EditMemberSheet, ResetPasswordSheet } from "@/components/madar/member-forms";
import { Page } from "@/components/madar/shell";
import { TaskTable } from "@/components/madar/task-views";
import { Avatar, Button, C, Card, Chip, EmptyState, Icon, Loading, Pill, SectionLabel, T, useIsWide } from "@/components/madar/ui";
import { addDays, fmtDayFull, fmtHours, isOverdue, sessionMinutes, startOfMonth, startOfWeek, todayISO, zonedToUtc, addMonths } from "@/lib/madar/format";
import { MEMBER_STATUS_LABELS, ROLE_HINTS, ROLE_LABELS } from "@/lib/madar/labels";
import { isAdmin } from "@/lib/madar/permissions";
import { useLookups, useSessionsBetween, useTasks } from "@/lib/madar/queries";
import { useMe } from "@/lib/madar/session";
import { sortTasks, useMinutesMap } from "@/lib/madar/task-utils";

export default function MemberScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const me = useMe();
  const router = useRouter();
  const { profileMap, departmentMap, loading } = useLookups();
  const tasksQuery = useTasks();
  const minutes = useMinutesMap();
  const wide = useIsWide(760);
  const [editing, setEditing] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [filter, setFilter] = useState<"open" | "done" | "all">("open");
  const member = id ? profileMap.get(id) : undefined;
  const back = () => (router.canGoBack() ? router.back() : router.replace("/team" as any));

  const today = todayISO();
  const monthStart = startOfMonth(today);
  const fromUtc = zonedToUtc(monthStart).toISOString();
  const toUtc = zonedToUtc(addMonths(monthStart, 1)).toISOString();
  const sessions = useSessionsBetween(fromUtc, toUtc, !!id);
  const weekFrom = zonedToUtc(startOfWeek(today)).toISOString();
  const weekTo = zonedToUtc(addDays(startOfWeek(today), 7)).toISOString();

  const theirTasks = useMemo(() => (tasksQuery.data ?? []).filter((t) => t.task_assignees?.some((a) => a.user_id === id)), [tasksQuery.data, id]);

  if (loading) return <Loading />;
  if (!member) {
    return (
      <Page title="العضو" back={back}>
        <EmptyState icon="user" title="العضو غير موجود" />
      </Page>
    );
  }

  const open = theirTasks.filter((t) => t.status !== "done");
  const late = open.filter((t) => isOverdue(t)).length;
  const doneMonth = theirTasks.filter((t) => t.status === "done" && t.completed_at && t.completed_at >= fromUtc).length;
  const mySessions = (sessions.data ?? []).filter((s) => s.user_id === member.id);
  const monthMinutes = mySessions.reduce((a, s) => a + sessionMinutes(s), 0);
  const weekMinutes = mySessions.filter((s) => s.started_at >= weekFrom && s.started_at < weekTo).reduce((a, s) => a + sessionMinutes(s), 0);
  const dept = member.department_id ? departmentMap.get(member.department_id) : null;
  const self = member.id === me.id;
  const canEditInfo = isAdmin(me) || self || (me.role === "manager" && !!me.department_id && member.department_id === me.department_id);
  const canReset =
    !self &&
    (isAdmin(me) ||
      (me.role === "manager" && !!me.department_id && member.department_id === me.department_id && ["supervisor", "employee", "viewer"].includes(member.role)));

  const list = sortTasks(filter === "open" ? open : filter === "done" ? theirTasks.filter((t) => t.status === "done") : theirTasks, "due");

  return (
    <Page back={back} maxWidth={1180}>
      <Card style={{ flexDirection: wide ? "row" : "column", gap: 18, alignItems: wide ? "center" : "flex-start", marginBottom: 16 }}>
        <View style={{ flexDirection: "row", gap: 14, alignItems: "center", flex: 1 }}>
          <Avatar id={member.id} name={member.full_name} size={64} />
          <View style={{ flex: 1, gap: 3 }}>
            <T weight="bold" style={{ fontSize: 22, lineHeight: 32 }}>
              {member.full_name}
            </T>
            <T className="text-muted">{[member.job_title, dept?.name].filter(Boolean).join(" · ") || "—"}</T>
            <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap", marginTop: 4 }}>
              <Pill label={ROLE_LABELS[member.role]} tone="primary" />
              {member.status !== "active" ? <Pill label={MEMBER_STATUS_LABELS[member.status]} tone={member.status === "disabled" ? "error" : "warning"} /> : null}
            </View>
          </View>
        </View>
        <View style={{ gap: 6 }}>
          <InfoLine icon="mail" value={member.email} />
          {member.phone ? <InfoLine icon="phone" value={member.phone} /> : null}
          <InfoLine icon="calendar" value={`انضم ${fmtDayFull(member.created_at.slice(0, 10))}`} />
        </View>
        <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
          {canEditInfo ? <Button title="تعديل" icon="edit-2" variant="secondary" size="sm" onPress={() => setEditing(true)} /> : null}
          {canReset ? <Button title="كلمة مرور جديدة" icon="key" variant="secondary" size="sm" onPress={() => setResetting(true)} /> : null}
        </View>
      </Card>
      <T className="mb-4 text-[12.5px] text-muted">{ROLE_HINTS[member.role]}</T>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 18 }}>
        <Stat label="مهام مفتوحة" value={String(open.length)} />
        <Stat label="متأخرة" value={String(late)} color={late ? C.error : undefined} />
        <Stat label="أنجزها هذا الشهر" value={String(doneMonth)} />
        <Stat label="ساعات الأسبوع" value={fmtHours(weekMinutes)} />
        <Stat label="ساعات الشهر" value={fmtHours(monthMinutes)} />
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        <SectionLabel className="flex-1">المهام المسندة</SectionLabel>
        <Chip label={`المفتوحة (${open.length})`} active={filter === "open"} onPress={() => setFilter("open")} />
        <Chip label="المكتملة" active={filter === "done"} onPress={() => setFilter("done")} />
        <Chip label="الكل" active={filter === "all"} onPress={() => setFilter("all")} />
      </View>
      {tasksQuery.isLoading ? <Loading /> : <TaskTable tasks={list} minutes={minutes} empty={<EmptyState icon="check-square" title="لا توجد مهام هنا" />} />}
      <EditMemberSheet visible={editing} onClose={() => setEditing(false)} member={member} />
      {canReset ? <ResetPasswordSheet visible={resetting} onClose={() => setResetting(false)} member={member} /> : null}
    </Page>
  );
}

function InfoLine({ icon, value }: { icon: any; value: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
      <Icon name={icon} size={14} color={C.muted} />
      <T className="text-[13px]" selectable>
        {value}
      </T>
    </View>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View style={{ flexBasis: 150, flexGrow: 1, backgroundColor: C.surface, borderRadius: 16, borderWidth: 1, borderColor: C.border, padding: 14, gap: 4 }}>
      <T className="text-[12px] text-muted">{label}</T>
      <T weight="bold" style={{ fontSize: 24, lineHeight: 34, color: color ?? C.foreground, fontVariant: ["tabular-nums"] }}>
        {value}
      </T>
    </View>
  );
}
