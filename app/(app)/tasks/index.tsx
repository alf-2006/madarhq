import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { View } from "react-native";
import { Page } from "@/components/madar/shell";
import { TaskForm } from "@/components/madar/tasks";
import { TaskCalendar, TaskKanban, TaskTable, TaskTimeline } from "@/components/madar/task-views";
import { Button, Chip, EmptyState, Loading, SearchInput, Segmented, Select, T, ErrorBox, useIsWide } from "@/components/madar/ui";
import { isOverdue } from "@/lib/madar/format";
import { PRIORITY_LABELS, PRIORITY_ORDER, STATUS_LABELS, STATUS_ORDER } from "@/lib/madar/labels";
import { canCreateTask, canManageTask, isAssignee, isLead } from "@/lib/madar/permissions";
import { useLookups, useTasks } from "@/lib/madar/queries";
import { sortTasks, useMinutesMap, type Sort } from "@/lib/madar/task-utils";
import { useMe } from "@/lib/madar/session";
import type { Priority, TaskStatus } from "@/lib/madar/types";
import { errorMessage } from "@/lib/supabase";

type ViewMode = "table" | "kanban" | "calendar" | "timeline";
type Scope = "all" | "mine" | "created" | "review" | "overdue";

export default function TasksScreen() {
  const me = useMe();
  const router = useRouter();
  const params = useLocalSearchParams<{ view?: string; scope?: string; project?: string; new?: string }>();
  const tasksQuery = useTasks();
  const minutes = useMinutesMap();
  const { profiles, projects, departments } = useLookups();
  const wide = useIsWide();

  const [view, setView] = useState<ViewMode>((params.view as ViewMode) || "table");
  const [scope, setScope] = useState<Scope>((params.scope as Scope) || (isLead(me) || me.role === "viewer" ? "all" : "mine"));
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<TaskStatus | null>(null);
  const [priority, setPriority] = useState<Priority | null>(null);
  const [projectId, setProjectId] = useState<string | null>(params.project ?? null);
  const [assigneeId, setAssigneeId] = useState<string | null>(null);
  const [departmentId, setDepartmentId] = useState<string | null>(null);
  const [hideDone, setHideDone] = useState(false);
  const [sort, setSort] = useState<Sort>("due");
  const [creating, setCreating] = useState(params.new === "1");

  const tasks = useMemo(() => {
    const term = q.trim().toLowerCase();
    let list = (tasksQuery.data ?? []).filter((t) => {
      if (scope === "mine" && !isAssignee(me, t)) return false;
      if (scope === "created" && t.created_by !== me.id) return false;
      if (scope === "review" && !(t.status === "review" && (canManageTask(me, t) || t.reviewer_id === me.id || t.created_by === me.id))) return false;
      if (scope === "overdue" && !isOverdue(t)) return false;
      if (status && t.status !== status) return false;
      if (priority && t.priority !== priority) return false;
      if (projectId && t.project_id !== projectId) return false;
      if (departmentId && t.department_id !== departmentId) return false;
      if (assigneeId && !t.task_assignees?.some((a) => a.user_id === assigneeId)) return false;
      if (hideDone && t.status === "done") return false;
      if (term && !(`${t.title} ${t.description ?? ""} #${t.number}`.toLowerCase().includes(term))) return false;
      return true;
    });
    list = sortTasks(list, sort);
    return list;
  }, [tasksQuery.data, q, scope, status, priority, projectId, assigneeId, departmentId, hideDone, sort, me]);

  const filtersActive = !!(status || priority || projectId || assigneeId || departmentId || q);

  const scopes: { value: Scope; label: string }[] = [
    { value: "mine", label: "مهامي" },
    { value: "all", label: me.role === "admin" || me.role === "viewer" ? "كل المهام" : isLead(me) ? "مهام القسم" : "كل ما يخصني" },
    { value: "created", label: "أنشأتها" },
    { value: "review", label: "للمراجعة" },
    { value: "overdue", label: "متأخرة" },
  ];

  return (
    <Page
      title="المهام"
      subtitle={tasksQuery.data ? `${tasks.length} من ${tasksQuery.data.length} مهمة` : undefined}
      actions={canCreateTask(me) ? <Button title="مهمة جديدة" icon="plus" onPress={() => setCreating(true)} /> : null}
      maxWidth={view === "kanban" ? 1600 : 1240}
    >
      <View style={{ gap: 12, marginBottom: 16 }}>
        <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <Segmented
            value={view}
            onChange={setView}
            options={[
              { value: "table", label: wide ? "جدول" : "قائمة", icon: "list" },
              { value: "kanban", label: "كانبان", icon: "columns" },
              { value: "calendar", label: "تقويم", icon: "calendar" },
              { value: "timeline", label: "زمني", icon: "sliders" },
            ]}
          />
          <SearchInput value={q} onChangeText={setQ} placeholder="ابحث بالعنوان أو الرقم…" />
        </View>
        <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
          {scopes.map((s) => (
            <Chip key={s.value} label={s.label} active={scope === s.value} onPress={() => setScope(s.value)} />
          ))}
          <Chip label="إخفاء المكتملة" icon={hideDone ? "eye-off" : "eye"} active={hideDone} onPress={() => setHideDone(!hideDone)} />
        </View>
        <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
          <View style={{ minWidth: 150, flex: 1, maxWidth: 220 }}>
            <Select value={status} onChange={setStatus} options={STATUS_ORDER.map((s) => ({ value: s, label: STATUS_LABELS[s] }))} noneLabel="كل الحالات" placeholder="كل الحالات" title="الحالة" />
          </View>
          <View style={{ minWidth: 150, flex: 1, maxWidth: 220 }}>
            <Select value={priority} onChange={setPriority} options={PRIORITY_ORDER.map((p) => ({ value: p, label: PRIORITY_LABELS[p] }))} noneLabel="كل الأولويات" placeholder="كل الأولويات" title="الأولوية" />
          </View>
          <View style={{ minWidth: 150, flex: 1, maxWidth: 220 }}>
            <Select value={projectId} onChange={setProjectId} options={projects.map((p) => ({ value: p.id, label: p.name, color: p.color }))} noneLabel="كل المشاريع" placeholder="كل المشاريع" title="المشروع" />
          </View>
          {isLead(me) || me.role === "viewer" ? (
            <View style={{ minWidth: 150, flex: 1, maxWidth: 220 }}>
              <Select
                value={assigneeId}
                onChange={setAssigneeId}
                options={profiles.filter((p) => p.status === "active").map((p) => ({ value: p.id, label: p.full_name }))}
                noneLabel="كل الموظفين"
                placeholder="كل الموظفين"
                title="المسؤول"
              />
            </View>
          ) : null}
          {(me.role === "admin" || me.role === "viewer") && departments.length ? (
            <View style={{ minWidth: 150, flex: 1, maxWidth: 220 }}>
              <Select value={departmentId} onChange={setDepartmentId} options={departments.map((d) => ({ value: d.id, label: d.name, color: d.color }))} noneLabel="كل الأقسام" placeholder="كل الأقسام" title="القسم" />
            </View>
          ) : null}
          {view === "table" ? (
            <View style={{ minWidth: 150, flex: 1, maxWidth: 200 }}>
              <Select
                value={sort}
                onChange={(v) => setSort((v as Sort) ?? "due")}
                options={[
                  { value: "due", label: "ترتيب: الاستحقاق" },
                  { value: "priority", label: "ترتيب: الأولوية" },
                  { value: "recent", label: "ترتيب: الأحدث" },
                ]}
                title="الترتيب"
              />
            </View>
          ) : null}
          {filtersActive ? (
            <Button
              title="مسح الفلاتر"
              variant="ghost"
              icon="x"
              size="sm"
              onPress={() => {
                setQ("");
                setStatus(null);
                setPriority(null);
                setProjectId(null);
                setAssigneeId(null);
                setDepartmentId(null);
              }}
            />
          ) : null}
        </View>
      </View>

      {tasksQuery.isLoading ? (
        <Loading />
      ) : tasksQuery.error ? (
        <ErrorBox message={errorMessage(tasksQuery.error)} />
      ) : (tasksQuery.data ?? []).length === 0 ? (
        <EmptyState
          icon="check-square"
          title="لا توجد مهام بعد"
          hint={canCreateTask(me) ? "ابدأ بإضافة أول مهمة وإسنادها لفريقك." : "ستظهر هنا المهام المتاحة لك."}
          action={canCreateTask(me) ? <Button title="مهمة جديدة" icon="plus" onPress={() => setCreating(true)} /> : null}
        />
      ) : view === "kanban" ? (
        <TaskKanban tasks={tasks} minutes={minutes} />
      ) : view === "calendar" ? (
        <TaskCalendar tasks={tasks} minutes={minutes} />
      ) : view === "timeline" ? (
        <TaskTimeline tasks={tasks} minutes={minutes} />
      ) : (
        <TaskTable tasks={tasks} minutes={minutes} empty={<EmptyState icon="filter" title="لا توجد مهام مطابقة" hint="جرّب تغيير الفلاتر أو نطاق العرض." />} />
      )}
      {!tasksQuery.isLoading && scope === "mine" && tasks.length === 0 && (tasksQuery.data ?? []).length > 0 ? (
        <T className="mt-3 text-center text-[12px] text-muted">اعرض «كل ما يخصني» لرؤية المهام التي أنشأتها أو تراجعها.</T>
      ) : null}

      <TaskForm
        visible={creating}
        onClose={() => setCreating(false)}
        defaults={{ project_id: projectId }}
        onSaved={(id) => router.push(`/tasks/${id}` as any)}
      />
    </Page>
  );
}
