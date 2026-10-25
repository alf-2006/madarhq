import * as DocumentPicker from "expo-document-picker";
import Constants from "expo-constants";
import { useEffect, useMemo, useState } from "react";
import { Platform, View } from "react-native";
import { EditMemberSheet } from "@/components/madar/member-forms";
import { Page } from "@/components/madar/shell";
import { Avatar, Button, C, Card, ErrorBox, Field, InfoBox, Input, SectionLabel, Select, T, useIsWide, useToast } from "@/components/madar/ui";
import { exportCSV, parseCSV, toCSV } from "@/lib/madar/csv";
import { addDays, todayISO } from "@/lib/madar/format";
import { PRIORITY_LABELS, ROLE_HINTS, ROLE_LABELS, TIMEZONES } from "@/lib/madar/labels";
import { canCreateTask, isAdmin } from "@/lib/madar/permissions";
import { useImportTasks, useLookups, useSaveSettings } from "@/lib/madar/queries";
import { useMe, useSession } from "@/lib/madar/session";
import type { Priority, TaskInput } from "@/lib/madar/types";
import { errorMessage, supabase } from "@/lib/supabase";

export default function SettingsScreen() {
  const me = useMe();
  const wide = useIsWide();
  return (
    <Page title="الإعدادات" maxWidth={980}>
      <View style={{ flexDirection: wide ? "row" : "column", gap: 16, alignItems: wide ? "flex-start" : "stretch" }}>
        <View style={{ flex: wide ? 1 : undefined, gap: 16 }}>
          <AccountCard />
          <PasswordCard />
        </View>
        <View style={{ flex: wide ? 1 : undefined, gap: 16 }}>
          {isAdmin(me) ? <CompanyCard /> : null}
          {canCreateTask(me) ? <ImportCard /> : null}
          <AboutCard />
        </View>
      </View>
    </Page>
  );
}

function AccountCard() {
  const me = useMe();
  const { signOut } = useSession();
  const { departmentMap } = useLookups();
  const [editing, setEditing] = useState(false);
  const dept = me.department_id ? departmentMap.get(me.department_id) : null;
  return (
    <Card style={{ gap: 14 }}>
      <SectionLabel>حسابي</SectionLabel>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <Avatar id={me.id} name={me.full_name} size={52} />
        <View style={{ flex: 1, gap: 2 }}>
          <T weight="bold" className="text-[16px]">
            {me.full_name}
          </T>
          <T className="text-[12.5px] text-muted">{me.email}</T>
          <T className="text-[12.5px] text-muted">
            {ROLE_LABELS[me.role]}
            {dept ? ` · ${dept.name}` : ""}
            {me.job_title ? ` · ${me.job_title}` : ""}
          </T>
        </View>
      </View>
      <T className="text-[12.5px] text-muted">{ROLE_HINTS[me.role]}</T>
      <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
        <Button title="تعديل بياناتي" icon="edit-2" variant="secondary" size="sm" onPress={() => setEditing(true)} />
        <Button title="تسجيل الخروج" icon="log-out" variant="danger" size="sm" onPress={signOut} />
      </View>
      <EditMemberSheet visible={editing} onClose={() => setEditing(false)} member={me} />
    </Card>
  );
}

function PasswordCard() {
  const toast = useToast();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setError(null);
    if (password.length < 8) return setError("كلمة المرور 8 أحرف على الأقل");
    if (password !== confirm) return setError("كلمتا المرور غير متطابقتين");
    setBusy(true);
    const { error: err } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (err) return setError(errorMessage(err));
    setPassword("");
    setConfirm("");
    toast.show("تم تغيير كلمة المرور");
  };
  return (
    <Card style={{ gap: 12 }}>
      <SectionLabel>تغيير كلمة المرور</SectionLabel>
      <Field label="كلمة المرور الجديدة">
        <Input value={password} onChangeText={setPassword} secureTextEntry placeholder="8 أحرف على الأقل" />
      </Field>
      <Field label="تأكيد كلمة المرور">
        <Input value={confirm} onChangeText={setConfirm} secureTextEntry onSubmitEditing={submit} />
      </Field>
      <ErrorBox message={error} />
      <Button title="تحديث كلمة المرور" icon="lock" onPress={submit} loading={busy} />
    </Card>
  );
}

function CompanyCard() {
  const { settings } = useSession();
  const save = useSaveSettings();
  const toast = useToast();
  const [name, setName] = useState(settings?.company_name ?? "");
  const [tz, setTz] = useState<string | null>(settings?.timezone ?? "Africa/Cairo");
  useEffect(() => {
    if (settings) {
      setName(settings.company_name);
      setTz(settings.timezone);
    }
  }, [settings]);
  return (
    <Card style={{ gap: 12 }}>
      <SectionLabel>الشركة</SectionLabel>
      <Field label="اسم الشركة">
        <Input value={name} onChangeText={setName} />
      </Field>
      <Field label="المنطقة الزمنية" hint="تُعرض كل الأوقات والتقارير وفق هذا التوقيت، بينما تُخزّن على الخادم بتوقيت UTC.">
        <Select value={tz} onChange={setTz} options={TIMEZONES.map((t) => ({ value: t.value, label: t.label, hint: t.value }))} title="المنطقة الزمنية" />
      </Field>
      <Button
        title="حفظ إعدادات الشركة"
        icon="check"
        loading={save.isPending}
        onPress={() => {
          if (!name.trim()) return toast.show("اكتب اسم الشركة", "error");
          save.mutate(
            { company_name: name.trim(), timezone: tz ?? "Africa/Cairo" },
            { onSuccess: () => toast.show("حُفظت إعدادات الشركة"), onError: (e) => toast.show(errorMessage(e), "error") },
          );
        }}
      />
    </Card>
  );
}

// ---------------------------------------------------------------- import

const PRIORITY_ALIASES: Record<string, Priority> = {
  low: "low",
  medium: "medium",
  high: "high",
  urgent: "urgent",
  منخفضة: "low",
  متوسطة: "medium",
  عالية: "high",
  عاجلة: "urgent",
};

const HEADER_ALIASES: Record<string, string> = {
  العنوان: "title",
  title: "title",
  الوصف: "description",
  description: "description",
  المسؤول: "assignees",
  المسؤولون: "assignees",
  assignee: "assignees",
  assignees: "assignees",
  الأولوية: "priority",
  priority: "priority",
  البدء: "start",
  start: "start",
  "تاريخ البدء": "start",
  الاستحقاق: "due",
  due: "due",
  "تاريخ الاستحقاق": "due",
  المشروع: "project",
  project: "project",
  "الوقت المقدر": "estimate",
  estimate: "estimate",
};

type ParsedRow = { line: number; title: string; input: Partial<TaskInput>; assignees: string[]; errors: string[] };

function ImportCard() {
  const me = useMe();
  const admin = isAdmin(me);
  const { profiles, projects } = useLookups();
  const importTasks = useImportTasks();
  const toast = useToast();
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);

  const parsed = useMemo<ParsedRow[]>(() => {
    if (!text.trim()) return [];
    const rows = parseCSV(text);
    if (rows.length < 2) return [];
    const headers = rows[0].map((h) => HEADER_ALIASES[h.trim().toLowerCase()] ?? HEADER_ALIASES[h.trim()] ?? "");
    return rows.slice(1).map((cells, idx) => {
      const get = (key: string) => {
        const i = headers.indexOf(key);
        return i >= 0 ? (cells[i] ?? "").trim() : "";
      };
      const errors: string[] = [];
      const title = get("title");
      if (!title) errors.push("العنوان مطلوب");
      const priorityRaw = get("priority");
      const priority = priorityRaw ? PRIORITY_ALIASES[priorityRaw.toLowerCase()] ?? PRIORITY_ALIASES[priorityRaw] : "medium";
      if (!priority) errors.push(`أولوية غير معروفة «${priorityRaw}»`);
      const due = get("due");
      const start = get("start");
      const isDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v);
      if (due && !isDate(due)) errors.push("صيغة الاستحقاق YYYY-MM-DD");
      if (start && !isDate(start)) errors.push("صيغة البدء YYYY-MM-DD");
      const projectName = get("project");
      const project = projectName ? projects.find((p) => p.name.trim() === projectName) : null;
      if (projectName && !project) errors.push(`المشروع «${projectName}» غير موجود`);
      const assignees: string[] = [];
      get("assignees")
        .split(/[|،;]/)
        .map((s) => s.trim())
        .filter(Boolean)
        .forEach((key) => {
          const person = profiles.find((p) => p.status === "active" && (p.email.toLowerCase() === key.toLowerCase() || p.full_name === key));
          if (person) {
            if (!assignees.includes(person.id)) assignees.push(person.id);
          }
          else errors.push(`لا يوجد عضو «${key}»`);
        });
      const est = get("estimate");
      const estimate = est ? Math.round(Number(est) * 60) : null;
      if (est && Number.isNaN(Number(est))) errors.push("الوقت المقدّر بالساعات رقمًا");
      return {
        line: idx + 2,
        title,
        assignees,
        errors,
        input: {
          title,
          description: get("description") || null,
          priority: (priority ?? "medium") as Priority,
          due_date: due || null,
          start_date: start || null,
          project_id: project?.id ?? null,
          department_id: admin ? project?.department_id ?? (assignees.map((id) => profiles.find((p) => p.id === id)?.department_id).find(Boolean) ?? null) : me.department_id,
          status: "todo",
          estimate_minutes: estimate && !Number.isNaN(estimate) ? estimate : null,
          reviewer_id: null,
        },
      };
    });
  }, [text, profiles, projects, admin, me.department_id]);

  const valid = parsed.filter((r) => r.errors.length === 0);
  const invalid = parsed.filter((r) => r.errors.length > 0);

  const pickFile = async () => {
    const result = await DocumentPicker.getDocumentAsync({ type: ["text/csv", "text/comma-separated-values", "text/plain", "*/*"], copyToCacheDirectory: true });
    if (result.canceled || !result.assets?.length) return;
    const asset = result.assets[0];
    try {
      const content = Platform.OS === "web" && (asset as any).file ? await (asset as any).file.text() : await (await fetch(asset.uri)).text();
      setText(content);
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  const template = () => {
    const sample = profiles.find((p) => p.status === "active" && p.role !== "viewer");
    exportCSV(
      "madar-import-template.csv",
      toCSV(
        ["العنوان", "الوصف", "المسؤول", "الأولوية", "البدء", "الاستحقاق", "المشروع", "الوقت المقدر"],
        [["تحديث قائمة الأسعار", "مراجعة أسعار الربع القادم", sample?.email ?? "name@company.com", PRIORITY_LABELS.high, todayISO(), addDays(todayISO(), 7), projects[0]?.name ?? "", "3"]],
      ),
    );
  };

  return (
    <Card style={{ gap: 12 }}>
      <SectionLabel>استيراد المهام</SectionLabel>
      <T className="text-[12.5px] text-muted" style={{ lineHeight: 21 }}>
        الصق محتوى ملف CSV أو اختر الملف. الأعمدة المدعومة: العنوان، الوصف، المسؤول (البريد أو الاسم، وافصل بين أكثر من مسؤول بـ |)، الأولوية، البدء، الاستحقاق (YYYY-MM-DD)، المشروع، الوقت المقدر بالساعات.
      </T>
      <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
        <Button title="اختيار ملف" icon="upload" variant="secondary" size="sm" onPress={pickFile} />
        <Button title="تنزيل نموذج" icon="download" variant="ghost" size="sm" onPress={template} />
      </View>
      <Input value={text} onChangeText={setText} multiline placeholder="العنوان,المسؤول,الاستحقاق&#10;..." style={{ minHeight: 110, textAlign: "left", writingDirection: "ltr", fontSize: 12.5 }} />
      {parsed.length ? (
        <View style={{ gap: 6 }}>
          <InfoBox tone={invalid.length ? "warning" : "success"} icon={invalid.length ? "alert-triangle" : "check-circle"}>
            {`${valid.length} صف جاهز للاستيراد${invalid.length ? ` · ${invalid.length} صف به أخطاء سيتم تجاهله` : ""}`}
          </InfoBox>
          {invalid.slice(0, 6).map((r) => (
            <T key={r.line} className="text-[12px]" style={{ color: C.error }}>
              السطر {r.line}: {r.errors.join("، ")}
            </T>
          ))}
        </View>
      ) : null}
      <ErrorBox message={error} />
      <Button
        title={valid.length ? `استيراد ${valid.length} مهمة` : "استيراد"}
        icon="check"
        disabled={!valid.length}
        loading={importTasks.isPending}
        onPress={() =>
          importTasks.mutate(
            valid.map((r) => ({ input: r.input, assignees: r.assignees })),
            {
              onSuccess: (n) => {
                toast.show(`استُوردت ${n} مهمة`);
                setText("");
              },
              onError: (e) => setError(errorMessage(e)),
            },
          )
        }
      />
    </Card>
  );
}

function AboutCard() {
  return (
    <Card style={{ gap: 6 }}>
      <SectionLabel>حول مدار</SectionLabel>
      <T className="text-[13px] text-muted" style={{ lineHeight: 22 }}>
        مدار لإدارة الموظفين والمهام ووقت العمل الفعلي. البيانات محفوظة في قاعدة بيانات Supabase ومحمية بصلاحيات على مستوى الصفوف لكل دور.
      </T>
      <T className="text-[12px] text-muted">الإصدار {Constants.expoConfig?.version ?? "1.0.0"}</T>
    </Card>
  );
}
