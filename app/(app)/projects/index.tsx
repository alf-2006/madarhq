import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { View } from "react-native";
import { ProjectForm } from "@/components/madar/project-form";
import { Page } from "@/components/madar/shell";
import { AvatarStack, Button, C, Chip, EmptyState, Icon, Loading, Pill, ProgressBar, SearchInput, T, Tap, useIsWide } from "@/components/madar/ui";
import { fmtDay, isOverdue, todayISO } from "@/lib/madar/format";
import { PROJECT_STATUS_LABELS, PROJECT_STATUS_TONE } from "@/lib/madar/labels";
import { canCreateProject } from "@/lib/madar/permissions";
import { useLookups, useProjects, useTasks } from "@/lib/madar/queries";
import { useMe } from "@/lib/madar/session";
import type { ProjectStatus } from "@/lib/madar/types";

type Filter = "current" | ProjectStatus | "all";

export default function ProjectsScreen() {
  const me = useMe();
  const router = useRouter();
  const projects = useProjects();
  const tasks = useTasks();
  const { departmentMap, profileMap } = useLookups();
  const wide = useIsWide(760);
  const [filter, setFilter] = useState<Filter>("current");
  const [q, setQ] = useState("");
  const [creating, setCreating] = useState(false);

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (projects.data ?? [])
      .filter((p) => {
        if (filter === "current" && !(p.status === "active" || p.status === "planning" || p.status === "on_hold")) return false;
        if (filter !== "current" && filter !== "all" && p.status !== filter) return false;
        if (term && !`${p.name} ${p.description ?? ""}`.toLowerCase().includes(term)) return false;
        return true;
      })
      .map((p) => {
        const list = (tasks.data ?? []).filter((t) => t.project_id === p.id);
        const done = list.filter((t) => t.status === "done").length;
        const overdue = list.filter((t) => isOverdue(t)).length;
        const people = new Map<string, { id: string; full_name: string }>();
        list.forEach((t) =>
          t.task_assignees?.forEach((a) => {
            const prof = profileMap.get(a.user_id);
            if (prof) people.set(prof.id, { id: prof.id, full_name: prof.full_name });
          }),
        );
        return { p, total: list.length, done, overdue, people: [...people.values()] };
      });
  }, [projects.data, tasks.data, filter, q, profileMap]);

  const filters: { value: Filter; label: string }[] = [
    { value: "current", label: "الجارية" },
    { value: "planning", label: PROJECT_STATUS_LABELS.planning },
    { value: "active", label: PROJECT_STATUS_LABELS.active },
    { value: "on_hold", label: PROJECT_STATUS_LABELS.on_hold },
    { value: "completed", label: PROJECT_STATUS_LABELS.completed },
    { value: "archived", label: PROJECT_STATUS_LABELS.archived },
    { value: "all", label: "الكل" },
  ];

  return (
    <Page
      title="المشاريع"
      subtitle={projects.data ? `${projects.data.length} مشروع` : undefined}
      actions={canCreateProject(me) ? <Button title="مشروع جديد" icon="plus" onPress={() => setCreating(true)} /> : null}
    >
      <View style={{ gap: 12, marginBottom: 16 }}>
        <SearchInput value={q} onChangeText={setQ} placeholder="ابحث عن مشروع…" />
        <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
          {filters.map((f) => (
            <Chip key={f.value} label={f.label} active={filter === f.value} onPress={() => setFilter(f.value)} />
          ))}
        </View>
      </View>
      {projects.isLoading ? (
        <Loading />
      ) : rows.length === 0 ? (
        <EmptyState
          icon="folder"
          title={(projects.data ?? []).length ? "لا توجد مشاريع مطابقة" : "لا توجد مشاريع بعد"}
          hint={canCreateProject(me) ? "أنشئ مشروعًا لتجميع المهام المرتبطة ومتابعة تقدّمها." : "يُنشئ مديرو الأقسام المشاريع وتظهر هنا."}
          action={canCreateProject(me) && !(projects.data ?? []).length ? <Button title="مشروع جديد" icon="plus" onPress={() => setCreating(true)} /> : null}
        />
      ) : (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 14 }}>
          {rows.map(({ p, total, done, overdue, people }) => {
            const dept = p.department_id ? departmentMap.get(p.department_id) : null;
            const late = p.due_date && p.due_date < todayISO() && p.status !== "completed" && p.status !== "archived";
            return (
              <Tap
                key={p.id}
                onPress={() => router.push(`/projects/${p.id}` as any)}
                style={{
                  flexBasis: wide ? 340 : "100%",
                  flexGrow: 1,
                  maxWidth: wide ? 560 : undefined,
                  backgroundColor: C.surface,
                  borderRadius: 18,
                  borderWidth: 1,
                  borderColor: C.border,
                  overflow: "hidden",
                }}
              >
                <View style={{ height: 5, backgroundColor: p.color }} />
                <View style={{ padding: 16, gap: 12 }}>
                  <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 8 }}>
                    <View style={{ flex: 1, gap: 2 }}>
                      <T weight="bold" className="text-[16px]" numberOfLines={1}>
                        {p.name}
                      </T>
                      <T className="text-[12px] text-muted" numberOfLines={1}>
                        {dept?.name ?? "مشروع عام"}
                        {p.owner_id && profileMap.get(p.owner_id) ? ` · ${profileMap.get(p.owner_id)!.full_name}` : ""}
                      </T>
                    </View>
                    <Pill label={PROJECT_STATUS_LABELS[p.status]} tone={PROJECT_STATUS_TONE[p.status]} />
                  </View>
                  {p.description ? (
                    <T className="text-[13px] text-muted" numberOfLines={2} style={{ lineHeight: 21 }}>
                      {p.description}
                    </T>
                  ) : null}
                  <View style={{ gap: 6 }}>
                    <View style={{ flexDirection: "row", alignItems: "center" }}>
                      <T weight="semibold" className="flex-1 text-[12px]">
                        {total ? `${Math.round((done / total) * 100)}% مكتمل` : "لا توجد مهام"}
                      </T>
                      <T className="text-[12px] text-muted">
                        {done} من {total}
                      </T>
                    </View>
                    <ProgressBar value={total ? done / total : 0} color={p.color} />
                  </View>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                    <AvatarStack people={people} size={24} max={4} />
                    <View style={{ flex: 1 }} />
                    {overdue ? (
                      <T weight="semibold" className="text-[12px]" style={{ color: C.error }}>
                        {overdue} متأخرة
                      </T>
                    ) : null}
                    {p.due_date ? (
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                        <Icon name="flag" size={12} color={late ? C.error : C.muted} />
                        <T className="text-[12px]" style={{ color: late ? C.error : C.muted }}>
                          {fmtDay(p.due_date)}
                        </T>
                      </View>
                    ) : null}
                  </View>
                </View>
              </Tap>
            );
          })}
        </View>
      )}
      <ProjectForm visible={creating} onClose={() => setCreating(false)} onSaved={(id) => router.push(`/projects/${id}` as any)} />
    </Page>
  );
}
