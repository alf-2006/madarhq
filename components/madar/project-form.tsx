import { useEffect, useState } from "react";
import { View } from "react-native";
import { PALETTE, PROJECT_STATUS_LABELS, PROJECT_STATUS_ORDER } from "@/lib/madar/labels";
import { isAdmin } from "@/lib/madar/permissions";
import { useLookups, useSaveProject } from "@/lib/madar/queries";
import { useMe } from "@/lib/madar/session";
import type { Project, ProjectStatus } from "@/lib/madar/types";
import { errorMessage } from "@/lib/supabase";
import { Button, ColorPicker, DateField, ErrorBox, Field, Input, Select, Sheet, useToast } from "./ui";

export function ProjectForm({ visible, onClose, project, onSaved }: { visible: boolean; onClose: () => void; project?: Project | null; onSaved?: (id: string) => void }) {
  const me = useMe();
  const admin = isAdmin(me);
  const { departments, profiles } = useLookups();
  const save = useSaveProject();
  const toast = useToast();
  const blank = () => ({
    name: project?.name ?? "",
    description: project?.description ?? "",
    department_id: project?.department_id ?? (admin ? null : me.department_id),
    owner_id: (project?.owner_id ?? me.id) as string | null,
    status: project?.status ?? ("active" as ProjectStatus),
    color: project?.color ?? PALETTE[0],
    start_date: project?.start_date ?? null,
    due_date: project?.due_date ?? null,
  });
  const [form, setForm] = useState(blank);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (visible) {
      setForm(blank());
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, project?.id]);
  const set = <K extends keyof ReturnType<typeof blank>>(k: K, v: ReturnType<typeof blank>[K]) => setForm((f) => ({ ...f, [k]: v }));

  const submit = () => {
    setError(null);
    if (!form.name.trim()) return setError("اكتب اسم المشروع");
    if (form.start_date && form.due_date && form.due_date < form.start_date) return setError("تاريخ الانتهاء يجب أن يكون بعد تاريخ البدء");
    save.mutate(
      {
        id: project?.id,
        input: {
          name: form.name.trim(),
          description: form.description.trim() || null,
          department_id: admin ? form.department_id : project?.department_id ?? me.department_id,
          owner_id: form.owner_id,
          status: form.status,
          color: form.color,
          start_date: form.start_date,
          due_date: form.due_date,
        },
      },
      {
        onSuccess: (id) => {
          toast.show(project ? "تم حفظ المشروع" : "أُنشئ المشروع");
          onClose();
          onSaved?.(id);
        },
        onError: (e) => setError(errorMessage(e)),
      },
    );
  };

  const owners = profiles
    .filter((p) => p.status === "active" && p.role !== "viewer")
    .map((p) => ({ value: p.id, label: p.full_name }));

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={project ? "تعديل المشروع" : "مشروع جديد"}
      subtitle="المشاريع تجمع المهام المرتبطة بهدف واحد"
      width={600}
      footer={
        <>
          <Button title={project ? "حفظ" : "إنشاء المشروع"} icon="check" onPress={submit} loading={save.isPending} />
          <Button title="إلغاء" variant="secondary" onPress={onClose} />
        </>
      }
    >
      <Field label="اسم المشروع" required>
        <Input value={form.name} onChangeText={(v) => set("name", v)} placeholder="مثال: إطلاق الموقع الجديد" autoFocus={!project} />
      </Field>
      <Field label="الوصف">
        <Input value={form.description} onChangeText={(v) => set("description", v)} placeholder="الهدف والنطاق" multiline />
      </Field>
      <View style={{ flexDirection: "row", gap: 12, flexWrap: "wrap" }}>
        <View style={{ flex: 1, minWidth: 200 }}>
          <Field label="القسم" hint={admin ? undefined : "يُنشأ المشروع داخل قسمك"}>
            <Select
              value={admin ? form.department_id : project?.department_id ?? me.department_id}
              onChange={(v) => set("department_id", v)}
              options={departments.map((d) => ({ value: d.id, label: d.name, color: d.color }))}
              noneLabel="مشروع عام لكل الأقسام"
              placeholder="مشروع عام"
              disabled={!admin}
            />
          </Field>
        </View>
        <View style={{ flex: 1, minWidth: 200 }}>
          <Field label="مسؤول المشروع">
            <Select value={form.owner_id} onChange={(v) => set("owner_id", v)} options={owners} noneLabel="بدون مسؤول" title="مسؤول المشروع" />
          </Field>
        </View>
      </View>
      <Field label="الحالة">
        <Select value={form.status} onChange={(v) => set("status", (v ?? "active") as ProjectStatus)} options={PROJECT_STATUS_ORDER.map((s) => ({ value: s, label: PROJECT_STATUS_LABELS[s] }))} title="حالة المشروع" />
      </Field>
      <View style={{ flexDirection: "row", gap: 12, flexWrap: "wrap" }}>
        <View style={{ flex: 1, minWidth: 180 }}>
          <Field label="تاريخ البدء">
            <DateField value={form.start_date} onChange={(v) => set("start_date", v)} />
          </Field>
        </View>
        <View style={{ flex: 1, minWidth: 180 }}>
          <Field label="تاريخ الانتهاء المستهدف">
            <DateField value={form.due_date} onChange={(v) => set("due_date", v)} />
          </Field>
        </View>
      </View>
      <Field label="اللون">
        <ColorPicker value={form.color} onChange={(v) => set("color", v)} colors={PALETTE} />
      </Field>
      <ErrorBox message={error} />
    </Sheet>
  );
}
