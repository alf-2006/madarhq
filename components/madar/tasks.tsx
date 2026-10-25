import { useEffect, useMemo, useState } from "react";
import { View } from "react-native";
import { fmtDay, isOverdue, todayISO } from "@/lib/madar/format";
import {
  PRIORITY_LABELS,
  PRIORITY_ORDER,
  PRIORITY_TONE,
  ROLE_LABELS,
  STATUS_LABELS,
  STATUS_ORDER,
  STATUS_TONE,
} from "@/lib/madar/labels";
import { canManageTask, canWorkOnTask, isAdmin, isSelfOwned } from "@/lib/madar/permissions";
import { useLookups, useSaveTask, useSetTaskStatus } from "@/lib/madar/queries";
import { useMe } from "@/lib/madar/session";
import type { Priority, Task, TaskInput, TaskStatus } from "@/lib/madar/types";
import { errorMessage } from "@/lib/supabase";
import {
  AvatarStack,
  Button,
  C,
  DateField,
  ErrorBox,
  Field,
  Icon,
  Input,
  MultiSelect,
  Pill,
  Segmented,
  Select,
  Sheet,
  T,
  Tap,
  useToast,
} from "./ui";

export function StatusPill({ status }: { status: TaskStatus }) {
  return <Pill label={STATUS_LABELS[status]} tone={STATUS_TONE[status]} dot />;
}

export function PriorityPill({ priority }: { priority: Priority }) {
  const icon = priority === "urgent" ? "zap" : priority === "high" ? "arrow-up" : priority === "low" ? "arrow-down" : "minus";
  return <Pill label={PRIORITY_LABELS[priority]} tone={PRIORITY_TONE[priority]} icon={icon as any} />;
}

export function DueLabel({ task, compact }: { task: Task; compact?: boolean }) {
  if (!task.due_date) return <T className="text-[12px] text-muted">{compact ? "" : "بدون موعد"}</T>;
  const overdue = isOverdue(task);
  const today = task.due_date === todayISO() && task.status !== "done";
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
      <Icon name="calendar" size={12} color={overdue ? C.error : today ? C.warning : C.muted} />
      <T weight={overdue || today ? "semibold" : "regular"} style={{ fontSize: 12, color: overdue ? C.error : today ? C.warning : C.muted }}>
        {today ? "اليوم" : fmtDay(task.due_date)}
        {overdue ? " · متأخرة" : ""}
      </T>
    </View>
  );
}

export function useTaskPeople(task: Task) {
  const { profileMap } = useLookups();
  return (task.task_assignees ?? [])
    .map((a) => profileMap.get(a.user_id))
    .filter(Boolean)
    .map((p) => ({ id: p!.id, full_name: p!.full_name }));
}

export function Assignees({ task, size = 24 }: { task: Task; size?: number }) {
  const people = useTaskPeople(task);
  return <AvatarStack people={people} size={size} />;
}

/** Status transitions the current member is allowed to make (mirrors the tasks_guard trigger). */
export function allowedTransitions(me: ReturnType<typeof useMe>, task: Task): TaskStatus[] {
  if (!canWorkOnTask(me, task)) return [];
  const manage = canManageTask(me, task);
  const self = isSelfOwned(me, task);
  if (!manage && !self && task.status === "done") return [];
  return STATUS_ORDER.filter((s) => s !== task.status && (manage || self || s !== "done"));
}

export function StatusMenu({ task, trigger }: { task: Task; trigger?: (open: () => void) => React.ReactNode }) {
  const me = useMe();
  const [open, setOpen] = useState(false);
  const setStatus = useSetTaskStatus();
  const toast = useToast();
  const options = allowedTransitions(me, task);
  const opener = () => setOpen(true);
  return (
    <>
      {trigger ? (
        trigger(opener)
      ) : (
        <Tap onPress={options.length ? opener : undefined}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <StatusPill status={task.status} />
            {options.length ? <Icon name="chevron-down" size={13} color={C.muted} /> : null}
          </View>
        </Tap>
      )}
      <Sheet visible={open} onClose={() => setOpen(false)} title="تغيير الحالة" subtitle={task.title} width={420}>
        <View style={{ gap: 6 }}>
          {options.map((s) => (
            <Tap
              key={s}
              onPress={() =>
                setStatus.mutate(
                  { id: task.id, status: s },
                  {
                    onSuccess: () => {
                      setOpen(false);
                      toast.show(`أصبحت المهمة: ${STATUS_LABELS[s]}`);
                    },
                    onError: (e) => toast.show(errorMessage(e), "error"),
                  },
                )
              }
              style={{ flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderRadius: 12, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border }}
            >
              <StatusPill status={s} />
              <View style={{ flex: 1 }} />
              <Icon name="arrow-left" size={15} color={C.muted} />
            </Tap>
          ))}
          {options.length === 0 ? <T className="text-muted">لا تملك صلاحية تغيير حالة هذه المهمة.</T> : null}
        </View>
      </Sheet>
    </>
  );
}

// ---------------------------------------------------------------- form

type Defaults = Partial<Pick<TaskInput, "project_id" | "status" | "due_date" | "start_date">> & { assignees?: string[] };

export function TaskForm({
  visible,
  onClose,
  task,
  defaults,
  onSaved,
}: {
  visible: boolean;
  onClose: () => void;
  task?: Task | null;
  defaults?: Defaults;
  onSaved?: (id: string) => void;
}) {
  const me = useMe();
  const { profiles, projects, departments, departmentMap, projectMap, profileMap } = useLookups();
  const save = useSaveTask();
  const toast = useToast();
  const admin = isAdmin(me);

  const initial = useMemo(
    () => ({
      title: task?.title ?? "",
      description: task?.description ?? "",
      project_id: task?.project_id ?? defaults?.project_id ?? null,
      department_id: task?.department_id ?? (admin ? null : me.department_id),
      status: task?.status ?? defaults?.status ?? ("todo" as TaskStatus),
      priority: task?.priority ?? ("medium" as Priority),
      start_date: task?.start_date ?? defaults?.start_date ?? null,
      due_date: task?.due_date ?? defaults?.due_date ?? null,
      estimateHours: task?.estimate_minutes ? String(Math.floor(task.estimate_minutes / 60)) : "",
      estimateMinutes: task?.estimate_minutes ? String(task.estimate_minutes % 60) : "",
      reviewer_id: task?.reviewer_id ?? null,
      assignees: task ? (task.task_assignees ?? []).map((a) => a.user_id) : defaults?.assignees ?? [],
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [task?.id, visible],
  );
  const [form, setForm] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    setForm(initial);
    setError(null);
  }, [initial]);

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => setForm((f) => ({ ...f, [key]: value }));

  const activePeople = profiles.filter((p) => p.status === "active" && p.role !== "viewer");
  const assigneeOptions = activePeople
    .slice()
    .sort((a, b) => {
      const da = a.department_id === me.department_id ? 0 : 1;
      const db = b.department_id === me.department_id ? 0 : 1;
      return da - db || a.full_name.localeCompare(b.full_name, "ar");
    })
    .map((p) => ({
      value: p.id,
      label: p.id === me.id ? `${p.full_name} (أنا)` : p.full_name,
      hint: [p.job_title, p.department_id ? departmentMap.get(p.department_id)?.name : null].filter(Boolean).join(" · "),
    }));
  const reviewerOptions = activePeople
    .filter((p) => p.role === "admin" || p.role === "manager" || p.role === "supervisor")
    .map((p) => ({ value: p.id, label: p.full_name, hint: ROLE_LABELS[p.role] }));
  const projectOptions = projects
    .filter((p) => p.status !== "archived" || p.id === form.project_id)
    .filter((p) => admin || !p.department_id || p.department_id === me.department_id || p.id === form.project_id)
    .map((p) => ({ value: p.id, label: p.name, color: p.color }));

  const submit = () => {
    setError(null);
    if (!form.title.trim()) return setError("اكتب عنوان المهمة");
    if (form.start_date && form.due_date && form.due_date < form.start_date) return setError("تاريخ الاستحقاق يجب أن يكون بعد تاريخ البدء");
    const h = Number(form.estimateHours || 0);
    const m = Number(form.estimateMinutes || 0);
    if (Number.isNaN(h) || Number.isNaN(m) || h < 0 || m < 0) return setError("الوقت المقدّر غير صحيح");
    const estimate = h * 60 + m > 0 ? Math.round(h * 60 + m) : null;

    let departmentId = form.department_id;
    if (admin && !departmentId && form.project_id) departmentId = projectMap.get(form.project_id)?.department_id ?? null;
    if (!admin) departmentId = task ? task.department_id : me.department_id;

    const full: TaskInput = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      project_id: form.project_id,
      department_id: departmentId,
      status: form.status,
      priority: form.priority,
      start_date: form.start_date,
      due_date: form.due_date,
      estimate_minutes: estimate,
      reviewer_id: form.reviewer_id,
    };
    let input: Partial<TaskInput> = full;
    if (task) {
      input = {};
      (Object.keys(full) as (keyof TaskInput)[]).forEach((k) => {
        if ((full[k] ?? null) !== ((task as any)[k] ?? null)) (input as any)[k] = full[k];
      });
      delete input.status;
    }
    save.mutate(
      { id: task?.id, input, assignees: form.assignees, previousAssignees: (task?.task_assignees ?? []).map((a) => a.user_id) },
      {
        onSuccess: (id) => {
          toast.show(task ? "تم حفظ التعديلات" : "تمت إضافة المهمة");
          onClose();
          onSaved?.(id);
        },
        onError: (e) => setError(errorMessage(e)),
      },
    );
  };

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={task ? "تعديل المهمة" : "مهمة جديدة"}
      subtitle={task ? `#${task.number}` : "حدّد المطلوب ومن ينفّذه وموعد التسليم"}
      width={640}
      footer={
        <>
          <Button title={task ? "حفظ" : "إضافة المهمة"} icon="check" onPress={submit} loading={save.isPending} />
          <Button title="إلغاء" variant="secondary" onPress={onClose} />
        </>
      }
    >
      <Field label="العنوان" required>
        <Input value={form.title} onChangeText={(v) => set("title", v)} placeholder="مثال: إعداد عرض سعر لعميل جديد" autoFocus={!task} />
      </Field>
      <Field label="الوصف">
        <Input value={form.description} onChangeText={(v) => set("description", v)} placeholder="التفاصيل والمخرجات المطلوبة" multiline />
      </Field>
      <Field label="الأولوية">
        <Segmented
          size="sm"
          value={form.priority}
          onChange={(v) => set("priority", v)}
          options={PRIORITY_ORDER.slice().reverse().map((p) => ({ value: p, label: PRIORITY_LABELS[p] }))}
        />
      </Field>
      <Field label="المسؤولون عن التنفيذ">
        <MultiSelect
          values={form.assignees}
          onChange={(v) =>
            setForm((f) => {
              const next = { ...f, assignees: v };
              // Admin tasks inherit the first assignee's department so that department leads can follow them.
              if (admin && !task && !f.department_id) {
                const dept = v.map((id) => profileMap.get(id)?.department_id).find(Boolean);
                if (dept) next.department_id = dept;
              }
              return next;
            })
          }
          options={assigneeOptions}
          placeholder="اختر موظفًا أو أكثر"
          title="إسناد المهمة"
          renderValue={(sel) => <AvatarStack people={sel.map((s) => ({ id: s.value, full_name: s.label }))} max={5} size={24} />}
        />
      </Field>
      <View style={{ flexDirection: "row", gap: 12, flexWrap: "wrap" }}>
        <View style={{ flex: 1, minWidth: 220 }}>
          <Field label="المشروع">
            <Select
              value={form.project_id}
              onChange={(v) =>
                setForm((f) => {
                  const next = { ...f, project_id: v };
                  const projectDept = v ? projectMap.get(v)?.department_id : null;
                  if (admin && !task && !f.department_id && projectDept) next.department_id = projectDept;
                  return next;
                })
              }
              options={projectOptions} noneLabel="بدون مشروع" placeholder="بدون مشروع" title="اختر المشروع" />
          </Field>
        </View>
        <View style={{ flex: 1, minWidth: 220 }}>
          <Field label="القسم" hint={admin ? undefined : "تُنشأ المهام داخل قسمك"}>
            <Select
              value={admin ? form.department_id : task ? task.department_id : me.department_id}
              onChange={(v) => set("department_id", v)}
              options={departments.map((d) => ({ value: d.id, label: d.name, color: d.color }))}
              noneLabel="بدون قسم"
              placeholder="بدون قسم"
              disabled={!admin}
            />
          </Field>
        </View>
      </View>
      <View style={{ flexDirection: "row", gap: 12, flexWrap: "wrap" }}>
        <View style={{ flex: 1, minWidth: 180 }}>
          <Field label="تاريخ البدء">
            <DateField value={form.start_date} onChange={(v) => set("start_date", v)} />
          </Field>
        </View>
        <View style={{ flex: 1, minWidth: 180 }}>
          <Field label="تاريخ الاستحقاق">
            <DateField value={form.due_date} onChange={(v) => set("due_date", v)} />
          </Field>
        </View>
      </View>
      <View style={{ flexDirection: "row", gap: 12, flexWrap: "wrap" }}>
        <View style={{ flex: 1, minWidth: 220 }}>
          <Field label="المراجع" hint="يعتمد المهمة قبل إغلاقها. بدون مراجع: يراجعها مديرو القسم ومنشئ المهمة.">
            <Select value={form.reviewer_id} onChange={(v) => set("reviewer_id", v)} options={reviewerOptions} noneLabel="بدون مراجع محدد" placeholder="بدون مراجع محدد" title="اختر المراجع" />
          </Field>
        </View>
        <View style={{ flex: 1, minWidth: 220 }}>
          <Field label="الوقت المقدّر">
            <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
              <Input value={form.estimateHours} onChangeText={(v) => set("estimateHours", v.replace(/[^0-9]/g, ""))} placeholder="0" keyboardType="number-pad" style={{ flex: 1 }} />
              <T className="text-muted">ساعة</T>
              <Input value={form.estimateMinutes} onChangeText={(v) => set("estimateMinutes", v.replace(/[^0-9]/g, ""))} placeholder="0" keyboardType="number-pad" style={{ flex: 1 }} />
              <T className="text-muted">دقيقة</T>
            </View>
          </Field>
        </View>
      </View>
      {!task ? (
        <Field label="الحالة الأولية">
          <Segmented
            size="sm"
            value={form.status}
            onChange={(v) => set("status", v)}
            options={(["todo", "in_progress", "blocked"] as TaskStatus[]).map((s) => ({ value: s, label: STATUS_LABELS[s] }))}
          />
        </Field>
      ) : null}
      <ErrorBox message={error} />
    </Sheet>
  );
}
