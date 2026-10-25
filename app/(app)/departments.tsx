import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { Page } from "@/components/madar/shell";
import { AvatarStack, Button, C, ColorPicker, EmptyState, ErrorBox, Field, IconButton, Input, Loading, Select, Sheet, T, Tap, confirmAction, useIsWide, useToast } from "@/components/madar/ui";
import { isOverdue } from "@/lib/madar/format";
import { PALETTE } from "@/lib/madar/labels";
import { isAdmin } from "@/lib/madar/permissions";
import { useDeleteDepartment, useDepartments, useLookups, useSaveDepartment, useTasks } from "@/lib/madar/queries";
import { useMe } from "@/lib/madar/session";
import type { Department } from "@/lib/madar/types";
import { errorMessage } from "@/lib/supabase";

export default function DepartmentsScreen() {
  const me = useMe();
  const router = useRouter();
  const admin = isAdmin(me);
  const departments = useDepartments();
  const { profiles, projects, profileMap } = useLookups();
  const tasks = useTasks();
  const wide = useIsWide(760);
  const [editing, setEditing] = useState<Department | "new" | null>(null);

  const list = departments.data ?? [];
  const unassigned = profiles.filter((p) => p.status === "active" && !p.department_id).length;

  return (
    <Page
      title="الأقسام"
      subtitle={`${list.length} قسم`}
      actions={admin ? <Button title="قسم جديد" icon="plus" onPress={() => setEditing("new")} /> : null}
    >
      {departments.isLoading ? (
        <Loading />
      ) : list.length === 0 ? (
        <EmptyState
          icon="layers"
          title="لا توجد أقسام بعد"
          hint={admin ? "قسّم فريقك إلى أقسام لتحديد صلاحيات المديرين والمشرفين." : "يضيف مدير النظام الأقسام."}
          action={admin ? <Button title="قسم جديد" icon="plus" onPress={() => setEditing("new")} /> : null}
        />
      ) : (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 14 }}>
          {list.map((d) => {
            const members = profiles.filter((p) => p.department_id === d.id && p.status === "active");
            const deptTasks = (tasks.data ?? []).filter((t) => t.department_id === d.id);
            const open = deptTasks.filter((t) => t.status !== "done");
            const late = open.filter((t) => isOverdue(t)).length;
            const review = open.filter((t) => t.status === "review").length;
            const manager = d.manager_id ? profileMap.get(d.manager_id) : null;
            const deptProjects = projects.filter((p) => p.department_id === d.id && p.status !== "archived").length;
            return (
              <View
                key={d.id}
                style={{ flexBasis: wide ? 340 : "100%", flexGrow: 1, maxWidth: wide ? 560 : undefined, backgroundColor: C.surface, borderRadius: 18, borderWidth: 1, borderColor: C.border, padding: 16, gap: 12 }}
              >
                <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10 }}>
                  <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: d.color + "22", alignItems: "center", justifyContent: "center" }}>
                    <View style={{ width: 14, height: 14, borderRadius: 4, backgroundColor: d.color }} />
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <T weight="bold" className="text-[16px]">
                      {d.name}
                    </T>
                    <T className="text-[12px] text-muted">{manager ? `المدير: ${manager.full_name}` : "بدون مدير محدد"}</T>
                  </View>
                  {admin ? <IconButton icon="edit-2" color={C.muted} label="تعديل" onPress={() => setEditing(d)} /> : null}
                </View>
                {d.description ? (
                  <T className="text-[13px] text-muted" numberOfLines={2}>
                    {d.description}
                  </T>
                ) : null}
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <Mini label="أعضاء" value={members.length} />
                  <Mini label="مهام مفتوحة" value={open.length} />
                  <Mini label="للمراجعة" value={review} />
                  <Mini label="متأخرة" value={late} color={late ? C.error : undefined} />
                </View>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <AvatarStack people={members.map((m) => ({ id: m.id, full_name: m.full_name }))} max={5} size={26} />
                  <View style={{ flex: 1 }} />
                  <T className="text-[12px] text-muted">{deptProjects} مشروع</T>
                </View>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <Tap onPress={() => router.push("/team" as any)}>
                    <T weight="semibold" className="text-[12.5px]" style={{ color: C.primary }}>
                      الأعضاء
                    </T>
                  </Tap>
                  <T className="text-muted">·</T>
                  <Tap onPress={() => router.push("/tasks?scope=all" as any)}>
                    <T weight="semibold" className="text-[12.5px]" style={{ color: C.primary }}>
                      المهام
                    </T>
                  </Tap>
                </View>
              </View>
            );
          })}
        </View>
      )}
      {admin && unassigned ? <T className="mt-4 text-[12.5px] text-muted">{unassigned} عضو نشط بدون قسم — عيّن أقسامهم من صفحة الفريق.</T> : null}
      <DepartmentForm visible={!!editing} onClose={() => setEditing(null)} department={editing === "new" ? null : editing} />
    </Page>
  );
}

function Mini({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <View style={{ flex: 1, backgroundColor: C.background, borderRadius: 12, paddingVertical: 8, alignItems: "center", gap: 1 }}>
      <T weight="bold" style={{ fontSize: 17, lineHeight: 24, color: color ?? C.foreground }}>
        {value}
      </T>
      <T className="text-[10.5px] text-muted">{label}</T>
    </View>
  );
}

function DepartmentForm({ visible, onClose, department }: { visible: boolean; onClose: () => void; department: Department | null }) {
  const save = useSaveDepartment();
  const del = useDeleteDepartment();
  const toast = useToast();
  const { profiles } = useLookups();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState(PALETTE[0]);
  const [managerId, setManagerId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (visible) {
      setName(department?.name ?? "");
      setDescription(department?.description ?? "");
      setColor(department?.color ?? PALETTE[Math.floor(Math.random() * PALETTE.length)]);
      setManagerId(department?.manager_id ?? null);
      setError(null);
    }
  }, [visible, department]);
  const managers = profiles.filter((p) => p.status === "active" && (p.role === "manager" || p.role === "admin" || p.role === "supervisor"));
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={department ? "تعديل القسم" : "قسم جديد"}
      width={520}
      footer={
        <>
          <Button
            title="حفظ"
            icon="check"
            loading={save.isPending}
            onPress={() => {
              setError(null);
              if (!name.trim()) return setError("اكتب اسم القسم");
              save.mutate(
                { id: department?.id, input: { name: name.trim(), description: description.trim() || null, color, manager_id: managerId } },
                {
                  onSuccess: () => {
                    toast.show(department ? "حُفظ القسم" : "أُضيف القسم");
                    onClose();
                  },
                  onError: (e) => setError(errorMessage(e)),
                },
              );
            }}
          />
          <Button title="إلغاء" variant="secondary" onPress={onClose} />
          {department ? (
            <Button
              icon="trash-2"
              label="حذف القسم"
              variant="danger"
              onPress={async () => {
                if (!(await confirmAction(`حذف قسم «${department.name}»؟ سيبقى أعضاؤه ومهامه بدون قسم.`, "حذف"))) return;
                del.mutate(department.id, {
                  onSuccess: () => {
                    toast.show("حُذف القسم");
                    onClose();
                  },
                  onError: (e) => setError(errorMessage(e)),
                });
              }}
            />
          ) : null}
        </>
      }
    >
      <Field label="اسم القسم" required>
        <Input value={name} onChangeText={setName} placeholder="مثال: المبيعات" autoFocus={!department} />
      </Field>
      <Field label="الوصف">
        <Input value={description} onChangeText={setDescription} placeholder="مسؤوليات القسم" multiline />
      </Field>
      <Field label="مدير القسم" hint="يظهر كمرجع؛ صلاحيات الإدارة تأتي من دور العضو وقسمه.">
        <Select value={managerId} onChange={setManagerId} options={managers.map((m) => ({ value: m.id, label: m.full_name }))} noneLabel="بدون مدير" placeholder="بدون مدير" title="مدير القسم" />
      </Field>
      <Field label="اللون">
        <ColorPicker value={color} onChange={setColor} colors={PALETTE} />
      </Field>
      <ErrorBox message={error} />
    </Sheet>
  );
}
