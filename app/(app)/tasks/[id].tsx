import * as DocumentPicker from "expo-document-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useState } from "react";
import { Platform, View } from "react-native";
import { ActivityList } from "@/components/madar/activity";
import { Page } from "@/components/madar/shell";
import { DueLabel, PriorityPill, StatusPill, TaskForm, allowedTransitions } from "@/components/madar/tasks";
import {
  Avatar,
  Button,
  C,
  Card,
  DateField,
  Divider,
  EmptyState,
  ErrorBox,
  Field,
  Icon,
  IconButton,
  InfoBox,
  Input,
  Loading,
  ProgressBar,
  SectionLabel,
  Segmented,
  Sheet,
  T,
  Tap,
  TimeField,
  confirmAction,
  useIsWide,
  useNow,
  useToast,
} from "@/components/madar/ui";
import {
  fmtBytes,
  fmtClock,
  fmtDateTime,
  fmtDayFull,
  fmtMinutes,
  fmtRelative,
  fmtTime,
  sessionMinutes,
  timeInTz,
  todayISO,
  zonedToUtc,
} from "@/lib/madar/format";
import { ROLE_LABELS } from "@/lib/madar/labels";
import {
  canDeleteTask,
  canEditTaskDetails,
  canManageTask,
  canTrackTime,
  canWorkOnTask,
  isAdmin,
  isSelfOwned,
  isAssignee,
} from "@/lib/madar/permissions";
import {
  attachmentUrl,
  useAddTimeEntry,
  useAttachmentActions,
  useAttachments,
  useCommentActions,
  useComments,
  useDeleteTask,
  useDeleteTimeSession,
  useLookups,
  useOpenSession,
  useSetTaskStatus,
  useStartTimer,
  useStopTimer,
  useSubtaskActions,
  useSubtasks,
  useTask,
  useTaskActivity,
  useTaskSessions,
} from "@/lib/madar/queries";
import { useMe } from "@/lib/madar/session";
import type { Task, TaskStatus } from "@/lib/madar/types";
import { errorMessage } from "@/lib/supabase";

export default function TaskDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const taskQuery = useTask(id);
  const wide = useIsWide(1100);
  const back = () => (router.canGoBack() ? router.back() : router.replace("/tasks" as any));

  if (taskQuery.isLoading) return <Loading />;
  if (taskQuery.error) {
    return (
      <Page title="المهمة" back={back}>
        <ErrorBox message={errorMessage(taskQuery.error)} />
      </Page>
    );
  }
  const task = taskQuery.data;
  if (!task) {
    return (
      <Page title="المهمة" back={back}>
        <EmptyState icon="lock" title="المهمة غير متاحة" hint="ربما حُذفت أو لا تملك صلاحية عرضها." action={<Button title="العودة إلى المهام" onPress={() => router.replace("/tasks" as any)} />} />
      </Page>
    );
  }

  return (
    <Page back={back} maxWidth={1240}>
      <TaskHeader task={task} />
      {wide ? (
        <View style={{ flexDirection: "row", gap: 20, alignItems: "flex-start" }}>
          <View style={{ flex: 1.65, gap: 16 }}>
            <MainColumn task={task} />
          </View>
          <View style={{ flex: 1, gap: 16 }}>
            <SideColumn task={task} />
          </View>
        </View>
      ) : (
        <View style={{ gap: 16 }}>
          <WorkflowCard task={task} />
          <TimeCard task={task} />
          <DetailsCard task={task} />
          <MainColumn task={task} />
          <AttachmentsCard task={task} />
        </View>
      )}
    </Page>
  );
}

function TaskHeader({ task }: { task: Task }) {
  const me = useMe();
  const router = useRouter();
  const { projectMap } = useLookups();
  const [editing, setEditing] = useState(false);
  const del = useDeleteTask();
  const toast = useToast();
  const project = task.project_id ? projectMap.get(task.project_id) : null;
  return (
    <View style={{ gap: 10, marginBottom: 20 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <T weight="semibold" className="text-[12px] text-muted">
          مهمة #{task.number}
        </T>
        {project ? (
          <Tap onPress={() => router.push(`/projects/${project.id}` as any)} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: project.color }} />
            <T weight="semibold" className="text-[12px]" style={{ color: C.primary }}>
              {project.name}
            </T>
          </Tap>
        ) : null}
      </View>
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
        <T weight="bold" style={{ flex: 1, minWidth: 240, fontSize: 25, lineHeight: 38 }}>
          {task.title}
        </T>
        <View style={{ flexDirection: "row", gap: 8 }}>
          {canEditTaskDetails(me, task) ? <Button title="تعديل" icon="edit-2" variant="secondary" size="sm" onPress={() => setEditing(true)} /> : null}
          {canDeleteTask(me, task) ? (
            <Button
              icon="trash-2"
              variant="danger"
              size="sm"
              onPress={async () => {
                if (!(await confirmAction("حذف هذه المهمة نهائيًا مع تعليقاتها وسجل وقتها؟", "حذف"))) return;
                del.mutate(task.id, {
                  onSuccess: () => {
                    toast.show("تم حذف المهمة");
                    router.replace("/tasks" as any);
                  },
                  onError: (e) => toast.show(errorMessage(e), "error"),
                });
              }}
            />
          ) : null}
        </View>
      </View>
      <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <StatusPill status={task.status} />
        <PriorityPill priority={task.priority} />
        <DueLabel task={task} />
      </View>
      <TaskForm visible={editing} onClose={() => setEditing(false)} task={task} />
    </View>
  );
}

function MainColumn({ task }: { task: Task }) {
  const [tab, setTab] = useState<"comments" | "activity">("comments");
  return (
    <>
      <Card style={{ gap: 10 }}>
        <SectionLabel>الوصف</SectionLabel>
        {task.description ? (
          <T style={{ lineHeight: 26 }}>{task.description}</T>
        ) : (
          <T className="text-muted">لا يوجد وصف.</T>
        )}
      </Card>
      <SubtasksCard task={task} />
      <Card style={{ gap: 12 }}>
        <Segmented
          size="sm"
          value={tab}
          onChange={setTab}
          options={[
            { value: "comments", label: "التعليقات", icon: "message-circle" },
            { value: "activity", label: "سجل النشاط", icon: "activity" },
          ]}
        />
        {tab === "comments" ? <Comments task={task} /> : <TaskActivity task={task} />}
      </Card>
    </>
  );
}

function SideColumn({ task }: { task: Task }) {
  return (
    <>
      <WorkflowCard task={task} />
      <TimeCard task={task} />
      <DetailsCard task={task} />
      <AttachmentsCard task={task} />
    </>
  );
}

// ---------------------------------------------------------------- workflow

function WorkflowCard({ task }: { task: Task }) {
  const me = useMe();
  const setStatus = useSetTaskStatus();
  const toast = useToast();
  const [returning, setReturning] = useState(false);
  const [note, setNote] = useState("");
  const manage = canManageTask(me, task);
  const work = canWorkOnTask(me, task);
  const self = isSelfOwned(me, task);
  const allowed = allowedTransitions(me, task);
  const { profileMap } = useLookups();
  const reviewer = task.reviewer_id ? profileMap.get(task.reviewer_id) : null;

  const move = (status: TaskStatus, message: string, review_note?: string | null) =>
    setStatus.mutate(
      { id: task.id, status, review_note },
      {
        onSuccess: () => toast.show(message),
        onError: (e) => toast.show(errorMessage(e), "error"),
      },
    );

  const actions: React.ReactNode[] = [];
  if (task.status === "review" && manage) {
    actions.push(<Button key="approve" title="اعتماد وإغلاق" icon="check-circle" onPress={() => move("done", "تم اعتماد المهمة")} full />);
    actions.push(<Button key="return" title="إعادة للتنفيذ مع ملاحظة" icon="corner-up-right" variant="secondary" onPress={() => setReturning(true)} full />);
  } else if (task.status !== "done" && task.status !== "review" && work) {
    if (self || manage) {
      actions.push(<Button key="done" title="إكمال المهمة" icon="check-circle" onPress={() => move("done", "أُغلقت المهمة")} full />);
    }
    if (!self) {
      actions.push(
        <Button
          key="review"
          title="إرسال للمراجعة"
          icon="send"
          variant={self || manage ? "secondary" : "primary"}
          onPress={() => move("review", "أُرسلت المهمة للمراجعة")}
          full
        />,
      );
    }
    if (task.status === "todo") actions.push(<Button key="start" title="بدء التنفيذ" icon="play" variant="soft" onPress={() => move("in_progress", "بدأ التنفيذ")} full />);
    if (task.status === "blocked") actions.push(<Button key="resume" title="استئناف" icon="play" variant="soft" onPress={() => move("in_progress", "تم استئناف المهمة")} full />);
    else actions.push(<Button key="block" title="تعليق المهمة" icon="pause" variant="ghost" onPress={() => move("blocked", "عُلّقت المهمة")} full />);
  } else if (task.status === "review" && work) {
    actions.push(<Button key="recall" title="سحب من المراجعة" icon="rotate-ccw" variant="secondary" onPress={() => move("in_progress", "عادت المهمة للتنفيذ")} full />);
  } else if (task.status === "done" && allowed.includes("in_progress")) {
    actions.push(<Button key="reopen" title="إعادة فتح المهمة" icon="rotate-ccw" variant="secondary" onPress={() => move("in_progress", "أُعيد فتح المهمة")} full />);
  }

  const statusHint =
    task.status === "review"
      ? manage
        ? "المهمة بانتظار اعتمادك."
        : `بانتظار المراجعة${reviewer ? ` من ${reviewer.full_name}` : " من مدير القسم"}.`
      : task.status === "done"
        ? `اكتملت ${task.completed_at ? fmtRelative(task.completed_at) : ""}.`
        : task.status === "blocked"
          ? "المهمة معلّقة حاليًا."
          : !isAssignee(me, task) && (manage || self)
            ? "يمكنك إغلاق المهمة مباشرة بصفتك مسؤولًا عنها، أو انتظار إرسالها للمراجعة."
            : self
              ? "مهمة شخصية: يمكنك إغلاقها مباشرة."
              : "عند الانتهاء أرسلها للمراجعة ليعتمدها المسؤول.";

  return (
    <Card style={{ gap: 12 }}>
      <SectionLabel>سير العمل</SectionLabel>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <StatusPill status={task.status} />
        <T className="flex-1 text-[12.5px] text-muted">{statusHint}</T>
      </View>
      {task.review_note && task.status !== "done" ? (
        <InfoBox tone="warning" icon="message-square">
          <T weight="semibold" style={{ color: C.warning }} className="text-[12px]">
            ملاحظة المراجع
          </T>
          <T style={{ color: C.foreground }} className="text-[13px]">
            {task.review_note}
          </T>
        </InfoBox>
      ) : null}
      {actions.length ? <View style={{ gap: 8 }}>{actions}</View> : me.role === "viewer" ? <T className="text-[12px] text-muted">حساب المشاهدة للاطلاع فقط.</T> : null}
      <Sheet
        visible={returning}
        onClose={() => setReturning(false)}
        title="إعادة المهمة للتنفيذ"
        subtitle="اكتب ما يحتاج للتعديل ليصل للمسؤولين"
        width={480}
        footer={
          <>
            <Button
              title="إعادة للتنفيذ"
              icon="corner-up-right"
              loading={setStatus.isPending}
              onPress={() => {
                move("in_progress", "أُعيدت المهمة مع ملاحظتك", note.trim() || null);
                setReturning(false);
                setNote("");
              }}
            />
            <Button title="إلغاء" variant="secondary" onPress={() => setReturning(false)} />
          </>
        }
      >
        <Input value={note} onChangeText={setNote} placeholder="مثال: الأرقام في الجدول الثاني تحتاج مراجعة" multiline autoFocus />
      </Sheet>
    </Card>
  );
}

// ---------------------------------------------------------------- time

function TimeCard({ task }: { task: Task }) {
  const me = useMe();
  const open = useOpenSession();
  const sessions = useTaskSessions(task.id);
  const start = useStartTimer();
  const stop = useStopTimer();
  const remove = useDeleteTimeSession();
  const toast = useToast();
  const { profileMap } = useLookups();
  const [manual, setManual] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const running = open.data && open.data.task_id === task.id ? open.data : null;
  const elsewhere = open.data && open.data.task_id !== task.id;
  const now = useNow(1000, !!running);
  const list = sessions.data ?? [];
  const total = list.reduce((sum, s) => sum + sessionMinutes(s, now), 0);
  const mine = list.filter((s) => s.user_id === me.id).reduce((sum, s) => sum + sessionMinutes(s, now), 0);
  const track = canTrackTime(me, task);
  const progress = task.estimate_minutes ? total / task.estimate_minutes : 0;

  return (
    <Card style={{ gap: 12 }}>
      <SectionLabel>الوقت الفعلي</SectionLabel>
      {running ? (
        <View style={{ backgroundColor: C.forest, borderRadius: 14, padding: 14, gap: 10 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#8FD3B6" }} />
            <T style={{ color: "#C9D6CF" }} className="text-[12px]">
              جلسة جارية منذ {fmtTime(running.started_at)}
            </T>
          </View>
          <T weight="bold" style={{ color: "#F4F1EA", fontSize: 30, lineHeight: 40, fontVariant: ["tabular-nums"] }}>
            {fmtClock(now - new Date(running.started_at).getTime())}
          </T>
          <Button
            title="إيقاف وحفظ"
            icon="square"
            variant="secondary"
            loading={stop.isPending}
            onPress={() =>
              stop.mutate(null, {
                onSuccess: () => toast.show("حُفظت الجلسة"),
                onError: (e) => toast.show(errorMessage(e), "error"),
              })
            }
          />
        </View>
      ) : track ? (
        <View style={{ gap: 6 }}>
          <Button
            title="ابدأ المؤقت"
            icon="play"
            loading={start.isPending}
            onPress={() =>
              start.mutate(task.id, {
                onSuccess: () => toast.show(elsewhere ? "أُوقفت الجلسة السابقة وبدأ المؤقت هنا" : "بدأ المؤقت"),
                onError: (e) => toast.show(errorMessage(e), "error"),
              })
            }
            full
          />
          {elsewhere ? <T className="text-[12px] text-muted">لديك مؤقت يعمل على مهمة أخرى وسيتوقف تلقائيًا.</T> : null}
        </View>
      ) : null}
      <View style={{ flexDirection: "row", gap: 10 }}>
        <Stat label="الإجمالي" value={fmtMinutes(total)} />
        <Stat label="وقتي" value={fmtMinutes(mine)} />
        <Stat label="المقدّر" value={task.estimate_minutes ? fmtMinutes(task.estimate_minutes) : "—"} />
      </View>
      {task.estimate_minutes ? (
        <View style={{ gap: 4 }}>
          <ProgressBar value={progress} color={progress > 1 ? C.error : C.primary} />
          <T className="text-[11.5px] text-muted">
            {progress > 1 ? `تجاوز التقدير بـ ${fmtMinutes(total - task.estimate_minutes)}` : `${Math.round(progress * 100)}% من الوقت المقدّر`}
          </T>
        </View>
      ) : null}
      {list.length ? (
        <View style={{ gap: 2 }}>
          {(showAll ? list : list.slice(0, 4)).map((s) => {
            const person = profileMap.get(s.user_id);
            const canRemove = (s.user_id === me.id && s.ended_at) || isAdmin(me);
            return (
              <View key={s.id} style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 6 }}>
                <Avatar id={s.user_id} name={person?.full_name} size={24} />
                <View style={{ flex: 1 }}>
                  <T className="text-[12.5px]" numberOfLines={1}>
                    {person?.full_name ?? "عضو"} · {fmtDateTime(s.started_at)}
                    {s.is_manual ? " · يدوي" : ""}
                  </T>
                  {s.note ? (
                    <T className="text-[11.5px] text-muted" numberOfLines={1}>
                      {s.note}
                    </T>
                  ) : null}
                </View>
                <T weight="semibold" className="text-[12.5px]" style={{ fontVariant: ["tabular-nums"] }}>
                  {s.ended_at ? fmtMinutes(sessionMinutes(s)) : "جارية"}
                </T>
                {canRemove ? (
                  <IconButton
                    icon="x"
                    size={28}
                    color={C.muted}
                    label="حذف الجلسة"
                    onPress={async () => {
                      if (!(await confirmAction("حذف جلسة الوقت هذه؟", "حذف"))) return;
                      remove.mutate(s.id, { onError: (e) => toast.show(errorMessage(e), "error") });
                    }}
                  />
                ) : null}
              </View>
            );
          })}
          {list.length > 4 ? (
            <Tap onPress={() => setShowAll(!showAll)}>
              <T weight="semibold" style={{ color: C.primary }} className="text-[12.5px]">
                {showAll ? "عرض أقل" : `عرض كل الجلسات (${list.length})`}
              </T>
            </Tap>
          ) : null}
        </View>
      ) : (
        <T className="text-[12.5px] text-muted">لم يُسجّل وقت على هذه المهمة بعد.</T>
      )}
      {track ? <Button title="إضافة وقت يدويًا" icon="plus" variant="ghost" size="sm" onPress={() => setManual(true)} /> : null}
      <ManualTimeSheet visible={manual} onClose={() => setManual(false)} task={task} />
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1, backgroundColor: C.background, borderRadius: 12, padding: 10, gap: 2 }}>
      <T className="text-[11px] text-muted">{label}</T>
      <T weight="bold" className="text-[15px]" style={{ fontVariant: ["tabular-nums"] }}>
        {value}
      </T>
    </View>
  );
}

function ManualTimeSheet({ visible, onClose, task }: { visible: boolean; onClose: () => void; task: Task }) {
  const add = useAddTimeEntry();
  const toast = useToast();
  const [date, setDate] = useState<string | null>(todayISO());
  const [from, setFrom] = useState("09:00");
  const [to, setTo] = useState(timeInTz(new Date()));
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const submit = () => {
    setError(null);
    if (!date) return setError("اختر التاريخ");
    if (!/^\d{1,2}:\d{2}$/.test(from) || !/^\d{1,2}:\d{2}$/.test(to)) return setError("اكتب الوقت بصيغة HH:MM");
    const started = zonedToUtc(date, from);
    const ended = zonedToUtc(date, to);
    if (ended <= started) return setError("وقت الانتهاء يجب أن يكون بعد وقت البدء");
    add.mutate(
      { taskId: task.id, started: started.toISOString(), ended: ended.toISOString(), note: note.trim() || null },
      {
        onSuccess: () => {
          toast.show("أُضيف الوقت");
          setNote("");
          onClose();
        },
        onError: (e) => setError(errorMessage(e)),
      },
    );
  };
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="إضافة وقت يدويًا"
      subtitle="لعمل أُنجز دون تشغيل المؤقت (بتوقيت الشركة)"
      width={480}
      footer={
        <>
          <Button title="إضافة" icon="check" onPress={submit} loading={add.isPending} />
          <Button title="إلغاء" variant="secondary" onPress={onClose} />
        </>
      }
    >
      <Field label="التاريخ">
        <DateField value={date} onChange={setDate} />
      </Field>
      <View style={{ flexDirection: "row", gap: 12 }}>
        <View style={{ flex: 1 }}>
          <Field label="من">
            <TimeField value={from} onChange={setFrom} />
          </Field>
        </View>
        <View style={{ flex: 1 }}>
          <Field label="إلى">
            <TimeField value={to} onChange={setTo} />
          </Field>
        </View>
      </View>
      <Field label="ملاحظة">
        <Input value={note} onChangeText={setNote} placeholder="ماذا أنجزت؟ (اختياري)" />
      </Field>
      <ErrorBox message={error} />
    </Sheet>
  );
}

// ---------------------------------------------------------------- details

function DetailsCard({ task }: { task: Task }) {
  const { profileMap, departmentMap } = useLookups();
  const router = useRouter();
  const assignees = (task.task_assignees ?? []).map((a) => profileMap.get(a.user_id)).filter(Boolean);
  const reviewer = task.reviewer_id ? profileMap.get(task.reviewer_id) : null;
  const creator = task.created_by ? profileMap.get(task.created_by) : null;
  const dept = task.department_id ? departmentMap.get(task.department_id) : null;
  return (
    <Card style={{ gap: 12 }}>
      <SectionLabel>التفاصيل</SectionLabel>
      <View style={{ gap: 6 }}>
        <T className="text-[12px] text-muted">المسؤولون</T>
        {assignees.length ? (
          assignees.map((p) => (
            <Tap key={p!.id} onPress={() => router.push(`/team/${p!.id}` as any)} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Avatar id={p!.id} name={p!.full_name} size={28} />
              <View style={{ flex: 1 }}>
                <T weight="semibold" className="text-[13px]">
                  {p!.full_name}
                </T>
                <T className="text-[11.5px] text-muted">{p!.job_title || ROLE_LABELS[p!.role]}</T>
              </View>
            </Tap>
          ))
        ) : (
          <T className="text-[13px] text-muted">غير مسندة لأحد</T>
        )}
      </View>
      <Divider />
      <DetailRow icon="user-check" label="المراجع" value={reviewer?.full_name ?? "مديرو القسم"} />
      <DetailRow icon="layers" label="القسم" value={dept?.name ?? "بدون قسم"} />
      <DetailRow icon="play-circle" label="البدء" value={fmtDayFull(task.start_date)} />
      <DetailRow icon="flag" label="الاستحقاق" value={fmtDayFull(task.due_date)} />
      <DetailRow icon="user-plus" label="أنشأها" value={`${creator?.full_name ?? "—"} · ${fmtRelative(task.created_at)}`} />
      {task.submitted_at ? <DetailRow icon="send" label="أُرسلت للمراجعة" value={fmtDateTime(task.submitted_at)} /> : null}
      {task.completed_at ? <DetailRow icon="check-circle" label="اكتملت" value={fmtDateTime(task.completed_at)} /> : null}
    </Card>
  );
}

function DetailRow({ icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
      <Icon name={icon} size={15} color={C.muted} />
      <T className="text-[12.5px] text-muted" style={{ width: 92 }}>
        {label}
      </T>
      <T weight="medium" className="flex-1 text-[13px]">
        {value}
      </T>
    </View>
  );
}

// ---------------------------------------------------------------- subtasks

function SubtasksCard({ task }: { task: Task }) {
  const me = useMe();
  const subtasks = useSubtasks(task.id);
  const { add, toggle, remove } = useSubtaskActions(task.id);
  const toast = useToast();
  const [title, setTitle] = useState("");
  const work = canWorkOnTask(me, task);
  const list = subtasks.data ?? [];
  const done = list.filter((s) => s.done).length;
  const submit = () => {
    const v = title.trim();
    if (!v) return;
    add.mutate(v, { onSuccess: () => setTitle(""), onError: (e) => toast.show(errorMessage(e), "error") });
  };
  return (
    <Card style={{ gap: 12 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <SectionLabel className="flex-1">المهام الفرعية</SectionLabel>
        {list.length ? (
          <T weight="semibold" className="text-[12px] text-muted">
            {done} / {list.length}
          </T>
        ) : null}
      </View>
      {list.length ? <ProgressBar value={done / list.length} /> : null}
      <View style={{ gap: 2 }}>
        {list.map((s) => (
          <View key={s.id} style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 6 }}>
            <Tap
              disabled={!work}
              onPress={() => toggle.mutate({ id: s.id, done: !s.done }, { onError: (e) => toast.show(errorMessage(e), "error") })}
              style={{
                width: 22,
                height: 22,
                borderRadius: 7,
                borderWidth: 1.5,
                borderColor: s.done ? C.primary : C.border,
                backgroundColor: s.done ? C.primary : C.surface,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {s.done ? <Icon name="check" size={14} color="#fff" /> : null}
            </Tap>
            <T className="flex-1" style={{ color: s.done ? C.muted : C.foreground, textDecorationLine: s.done ? "line-through" : "none" }}>
              {s.title}
            </T>
            {work ? <IconButton icon="trash-2" size={28} color={C.muted} label="حذف" onPress={() => remove.mutate(s.id)} /> : null}
          </View>
        ))}
        {list.length === 0 && !work ? <T className="text-[13px] text-muted">لا توجد مهام فرعية.</T> : null}
      </View>
      {work ? (
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Input value={title} onChangeText={setTitle} placeholder="أضف خطوة…" onSubmitEditing={submit} returnKeyType="done" style={{ flex: 1 }} />
          <Button icon="plus" label="إضافة خطوة" onPress={submit} loading={add.isPending} variant="soft" />
        </View>
      ) : null}
    </Card>
  );
}

// ---------------------------------------------------------------- comments

function Comments({ task }: { task: Task }) {
  const me = useMe();
  const comments = useComments(task.id);
  const { add, remove } = useCommentActions(task.id);
  const { profileMap } = useLookups();
  const toast = useToast();
  const [body, setBody] = useState("");
  const list = comments.data ?? [];
  const submit = () => {
    const v = body.trim();
    if (!v) return;
    add.mutate(v, { onSuccess: () => setBody(""), onError: (e) => toast.show(errorMessage(e), "error") });
  };
  return (
    <View style={{ gap: 12 }}>
      {list.length === 0 ? <T className="text-[13px] text-muted">لا توجد تعليقات بعد. ابدأ النقاش حول المهمة هنا.</T> : null}
      {list.map((c) => {
        const author = c.author_id ? profileMap.get(c.author_id) : null;
        return (
          <View key={c.id} style={{ flexDirection: "row", gap: 10 }}>
            <Avatar id={c.author_id} name={author?.full_name} size={30} />
            <View style={{ flex: 1, backgroundColor: c.author_id === me.id ? C["primary-soft"] : C.background, borderRadius: 14, padding: 10, gap: 3 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <T weight="semibold" className="text-[13px]">
                  {author?.full_name ?? "عضو"}
                </T>
                <T className="flex-1 text-[11px] text-muted">{fmtRelative(c.created_at)}</T>
                {c.author_id === me.id || isAdmin(me) ? (
                  <Tap
                    onPress={async () => {
                      if (await confirmAction("حذف التعليق؟", "حذف")) remove.mutate(c.id);
                    }}
                  >
                    <Icon name="trash-2" size={13} color={C.muted} />
                  </Tap>
                ) : null}
              </View>
              <T style={{ lineHeight: 23 }}>{c.body}</T>
            </View>
          </View>
        );
      })}
      {me.role !== "viewer" ? (
        <View style={{ flexDirection: "row", gap: 8, alignItems: "flex-end" }}>
          <Input value={body} onChangeText={setBody} placeholder="اكتب تعليقًا…" multiline style={{ flex: 1, minHeight: 44 }} />
          <Button icon="send" label="إرسال التعليق" onPress={submit} loading={add.isPending} />
        </View>
      ) : null}
    </View>
  );
}

function TaskActivity({ task }: { task: Task }) {
  const activity = useTaskActivity(task.id);
  if (activity.isLoading) return <Loading />;
  return <ActivityList items={activity.data ?? []} />;
}

// ---------------------------------------------------------------- attachments

function AttachmentsCard({ task }: { task: Task }) {
  const me = useMe();
  const attachments = useAttachments(task.id);
  const { upload, remove } = useAttachmentActions(task.id);
  const toast = useToast();
  const { profileMap } = useLookups();
  const work = canWorkOnTask(me, task);
  const manage = canManageTask(me, task);
  const list = attachments.data ?? [];

  const pick = async () => {
    const result = await DocumentPicker.getDocumentAsync({ multiple: false, copyToCacheDirectory: true });
    if (result.canceled || !result.assets?.length) return;
    const asset = result.assets[0];
    if (asset.size && asset.size > 25 * 1024 * 1024) {
      toast.show("الحد الأقصى لحجم الملف 25 ميجابايت", "error");
      return;
    }
    try {
      const body: Blob | ArrayBuffer =
        Platform.OS === "web" && (asset as any).file ? (asset as any).file : await (await fetch(asset.uri)).arrayBuffer();
      upload.mutate(
        { name: asset.name, size: asset.size ?? null, type: asset.mimeType ?? null, body },
        { onSuccess: () => toast.show("تم رفع الملف"), onError: (e) => toast.show(errorMessage(e), "error") },
      );
    } catch (e) {
      toast.show(errorMessage(e), "error");
    }
  };

  const openFile = async (att: (typeof list)[number]) => {
    try {
      const url = await attachmentUrl(att);
      if (Platform.OS === "web") window.open(url, "_blank");
      else await WebBrowser.openBrowserAsync(url);
    } catch (e) {
      toast.show(errorMessage(e), "error");
    }
  };

  return (
    <Card style={{ gap: 12 }}>
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <SectionLabel className="flex-1">المرفقات</SectionLabel>
        {work ? <Button title="رفع ملف" icon="paperclip" variant="soft" size="sm" onPress={pick} loading={upload.isPending} /> : null}
      </View>
      {list.length === 0 ? <T className="text-[13px] text-muted">لا توجد مرفقات.</T> : null}
      {list.map((a) => (
        <View key={a.id} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: C.sand, alignItems: "center", justifyContent: "center" }}>
            <Icon name={a.mime_type?.startsWith("image/") ? "image" : "file-text"} size={16} color={C.muted} />
          </View>
          <Tap onPress={() => openFile(a)} style={{ flex: 1 }}>
            <T weight="semibold" className="text-[13px]" numberOfLines={1} style={{ color: C.primary }}>
              {a.file_name}
            </T>
            <T className="text-[11px] text-muted" numberOfLines={1}>
              {[fmtBytes(a.size_bytes), a.uploader_id ? profileMap.get(a.uploader_id)?.full_name : null, fmtRelative(a.created_at)].filter(Boolean).join(" · ")}
            </T>
          </Tap>
          {a.uploader_id === me.id || manage ? (
            <IconButton
              icon="trash-2"
              size={30}
              color={C.muted}
              label="حذف الملف"
              onPress={async () => {
                if (!(await confirmAction(`حذف الملف «${a.file_name}»؟`, "حذف"))) return;
                remove.mutate(a, { onError: (e) => toast.show(errorMessage(e), "error") });
              }}
            />
          ) : null}
        </View>
      ))}
    </Card>
  );
}

