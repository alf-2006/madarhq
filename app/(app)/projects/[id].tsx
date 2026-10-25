import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { View } from "react-native";
import { ProjectForm } from "@/components/madar/project-form";
import { Page } from "@/components/madar/shell";
import { TaskForm } from "@/components/madar/tasks";
import { TaskKanban, TaskTable, TaskTimeline } from "@/components/madar/task-views";
import { Button, C, Card, EmptyState, Loading, Pill, ProgressBar, Segmented, T, confirmAction, useIsWide, useToast } from "@/components/madar/ui";
import { fmtDayFull, fmtHours, isOverdue } from "@/lib/madar/format";
import { PROJECT_STATUS_LABELS, PROJECT_STATUS_TONE, STATUS_LABELS, STATUS_ORDER, STATUS_TONE } from "@/lib/madar/labels";
import { canCreateTask, canDeleteProject, canEditProject } from "@/lib/madar/permissions";
import { useDeleteProject, useLookups, useTasks } from "@/lib/madar/queries";
import { useMe } from "@/lib/madar/session";
import { sortTasks, useMinutesMap } from "@/lib/madar/task-utils";
import { errorMessage } from "@/lib/supabase";
import { toneColor } from "@/components/madar/ui";

export default function ProjectDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const me = useMe();
  const router = useRouter();
  const { projectMap, departmentMap, profileMap, loading } = useLookups();
  const tasksQuery = useTasks();
  const minutes = useMinutesMap();
  const del = useDeleteProject();
  const toast = useToast();
  const wide = useIsWide(760);
  const [view, setView] = useState<"table" | "kanban" | "timeline">("table");
  const [editing, setEditing] = useState(false);
  const [creating, setCreating] = useState(false);
  const project = id ? projectMap.get(id) : undefined;
  const back = () => (router.canGoBack() ? router.back() : router.replace("/projects" as any));

  const tasks = useMemo(() => sortTasks((tasksQuery.data ?? []).filter((t) => t.project_id === id), "due"), [tasksQuery.data, id]);

  if (loading || tasksQuery.isLoading) return <Loading />;
  if (!project) {
    return (
      <Page title="المشروع" back={back}>
        <EmptyState icon="folder" title="المشروع غير متاح" hint="ربما حُذف أو لا تملك صلاحية عرضه." />
      </Page>
    );
  }

  const done = tasks.filter((t) => t.status === "done").length;
  const overdue = tasks.filter((t) => isOverdue(t)).length;
  const spent = tasks.reduce((a, t) => a + (minutes.get(t.id) ?? 0), 0);
  const estimate = tasks.reduce((a, t) => a + (t.estimate_minutes ?? 0), 0);
  const dept = project.department_id ? departmentMap.get(project.department_id) : null;
  const owner = project.owner_id ? profileMap.get(project.owner_id) : null;

  return (
    <Page
      back={back}
      title={project.name}
      subtitle={[dept?.name ?? "مشروع عام", owner ? `المسؤول: ${owner.full_name}` : null].filter(Boolean).join(" · ")}
      maxWidth={view === "kanban" ? 1600 : 1240}
      actions={
        <>
          {canCreateTask(me) ? <Button title="مهمة في المشروع" icon="plus" onPress={() => setCreating(true)} /> : null}
          {canEditProject(me, project) ? <Button title="تعديل" icon="edit-2" variant="secondary" onPress={() => setEditing(true)} /> : null}
          {canDeleteProject(me, project) ? (
            <Button
              icon="trash-2"
              label="حذف المشروع"
              variant="danger"
              onPress={async () => {
                if (!(await confirmAction("حذف المشروع؟ ستبقى مهامه موجودة بدون مشروع.", "حذف"))) return;
                del.mutate(project.id, {
                  onSuccess: () => {
                    toast.show("حُذف المشروع");
                    router.replace("/projects" as any);
                  },
                  onError: (e) => toast.show(errorMessage(e), "error"),
                });
              }}
            />
          ) : null}
        </>
      }
    >
      <View style={{ flexDirection: wide ? "row" : "column", gap: 14, marginBottom: 18 }}>
        <Card style={{ flex: wide ? 1.4 : undefined, gap: 12 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <View style={{ width: 12, height: 12, borderRadius: 4, backgroundColor: project.color }} />
            <Pill label={PROJECT_STATUS_LABELS[project.status]} tone={PROJECT_STATUS_TONE[project.status]} />
            <View style={{ flex: 1 }} />
            {project.start_date || project.due_date ? (
              <T className="text-[12px] text-muted">
                {project.start_date ? fmtDayFull(project.start_date) : "بدون بداية"} ← {project.due_date ? fmtDayFull(project.due_date) : "بدون موعد نهائي"}
              </T>
            ) : null}
          </View>
          {project.description ? <T style={{ lineHeight: 25 }}>{project.description}</T> : <T className="text-muted">لا يوجد وصف.</T>}
          <View style={{ gap: 6 }}>
            <View style={{ flexDirection: "row" }}>
              <T weight="bold" className="flex-1">
                {tasks.length ? Math.round((done / tasks.length) * 100) : 0}% مكتمل
              </T>
              <T className="text-[12px] text-muted">
                {done} من {tasks.length} مهمة
              </T>
            </View>
            <ProgressBar value={tasks.length ? done / tasks.length : 0} color={project.color} height={8} />
          </View>
          <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
            {STATUS_ORDER.map((s) => {
              const n = tasks.filter((t) => t.status === s).length;
              if (!n) return null;
              return (
                <View key={s} style={{ flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, backgroundColor: C.background }}>
                  <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: toneColor(STATUS_TONE[s]) }} />
                  <T className="text-[12px]">
                    {STATUS_LABELS[s]} {n}
                  </T>
                </View>
              );
            })}
          </View>
        </Card>
        <View style={{ flex: wide ? 1 : undefined, flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
          <Metric label="متأخرة" value={String(overdue)} color={overdue ? C.error : C.foreground} />
          <Metric label="ساعات مسجّلة" value={fmtHours(spent)} />
          <Metric label="ساعات مقدّرة" value={estimate ? fmtHours(estimate) : "—"} />
          <Metric label="مهام مفتوحة" value={String(tasks.length - done)} />
        </View>
      </View>
      <View style={{ marginBottom: 14 }}>
        <Segmented
          value={view}
          onChange={setView}
          options={[
            { value: "table", label: "قائمة", icon: "list" },
            { value: "kanban", label: "كانبان", icon: "columns" },
            { value: "timeline", label: "زمني", icon: "sliders" },
          ]}
        />
      </View>
      {tasks.length === 0 ? (
        <EmptyState icon="check-square" title="لا توجد مهام في هذا المشروع" action={canCreateTask(me) ? <Button title="أضف مهمة" icon="plus" onPress={() => setCreating(true)} /> : null} />
      ) : view === "kanban" ? (
        <TaskKanban tasks={tasks} minutes={minutes} />
      ) : view === "timeline" ? (
        <TaskTimeline tasks={tasks} minutes={minutes} />
      ) : (
        <TaskTable tasks={tasks} minutes={minutes} />
      )}
      <ProjectForm visible={editing} onClose={() => setEditing(false)} project={project} />
      <TaskForm visible={creating} onClose={() => setCreating(false)} defaults={{ project_id: project.id }} />
    </Page>
  );
}

function Metric({ label, value, color = C.foreground }: { label: string; value: string; color?: string }) {
  return (
    <View style={{ flexBasis: "46%", flexGrow: 1, backgroundColor: C.surface, borderRadius: 16, borderWidth: 1, borderColor: C.border, padding: 14, gap: 4 }}>
      <T className="text-[12px] text-muted">{label}</T>
      <T weight="bold" style={{ fontSize: 24, lineHeight: 34, color, fontVariant: ["tabular-nums"] }}>
        {value}
      </T>
    </View>
  );
}
