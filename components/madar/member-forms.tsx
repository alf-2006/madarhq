import { useEffect, useState } from "react";
import { View } from "react-native";
import { MEMBER_STATUS_LABELS, ROLE_HINTS, ROLE_LABELS } from "@/lib/madar/labels";
import { assignableRoles, isAdmin } from "@/lib/madar/permissions";
import { useCreateMember, useInvitationActions, useLookups, useResetPassword, useUpdateProfile } from "@/lib/madar/queries";
import { useMe } from "@/lib/madar/session";
import type { MemberStatus, Profile, Role } from "@/lib/madar/types";
import { errorMessage } from "@/lib/supabase";
import { Button, ErrorBox, Field, InfoBox, Input, Segmented, Select, Sheet, T, useToast } from "./ui";

function generatePassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  let out = "";
  for (let i = 0; i < 10; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

export function AddMemberSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const me = useMe();
  const admin = isAdmin(me);
  const { departments } = useLookups();
  const create = useCreateMember();
  const { add: invite } = useInvitationActions();
  const toast = useToast();
  const roles = assignableRoles(me);
  const [mode, setMode] = useState<"account" | "invite">("account");
  const blank = () => ({
    full_name: "",
    email: "",
    password: generatePassword(),
    job_title: "",
    role: "employee" as Role,
    department_id: admin ? null : me.department_id,
  });
  const [form, setForm] = useState(blank);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ email: string; password: string } | null>(null);
  useEffect(() => {
    if (visible) {
      setForm(blank());
      setError(null);
      setCreated(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);
  const set = <K extends keyof ReturnType<typeof blank>>(k: K, v: ReturnType<typeof blank>[K]) => setForm((f) => ({ ...f, [k]: v }));

  const submit = () => {
    setError(null);
    const email = form.email.trim().toLowerCase();
    if (!form.full_name.trim()) return setError("اكتب اسم الموظف");
    if (!/^\S+@\S+\.\S+$/.test(email)) return setError("البريد الإلكتروني غير صحيح");
    if (mode === "account" && form.password.length < 8) return setError("كلمة المرور 8 أحرف على الأقل");
    if (mode === "account") {
      create.mutate(
        {
          email,
          password: form.password,
          full_name: form.full_name.trim(),
          role: form.role,
          department_id: form.department_id,
          job_title: form.job_title.trim() || null,
        },
        {
          onSuccess: () => {
            toast.show("أُضيف الموظف وفُعّل حسابه");
            setCreated({ email, password: form.password });
          },
          onError: (e) => setError(errorMessage(e)),
        },
      );
    } else {
      invite.mutate(
        {
          email,
          full_name: form.full_name.trim(),
          role: form.role,
          department_id: form.department_id,
          job_title: form.job_title.trim() || null,
        },
        {
          onSuccess: () => {
            toast.show("حُفظ التصريح، يمكنه الآن التسجيل بنفسه");
            onClose();
          },
          onError: (e) => setError(errorMessage(e)),
        },
      );
    }
  };

  if (created) {
    return (
      <Sheet visible={visible} onClose={onClose} title="تم إنشاء الحساب" width={480} footer={<Button title="تم" onPress={onClose} />}>
        <InfoBox tone="success" icon="check-circle">
          شارك بيانات الدخول مع الموظف بطريقة آمنة. يمكنه تغيير كلمة المرور لاحقًا من الإعدادات.
        </InfoBox>
        <Field label="البريد الإلكتروني">
          <Input value={created.email} editable={false} selectTextOnFocus style={{ textAlign: "left", writingDirection: "ltr" }} />
        </Field>
        <Field label="كلمة المرور المؤقتة">
          <Input value={created.password} editable={false} selectTextOnFocus style={{ textAlign: "left", writingDirection: "ltr" }} />
        </Field>
      </Sheet>
    );
  }

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="إضافة موظف"
      subtitle="أنشئ حسابًا جاهزًا أو صرّح لبريده بالتسجيل الذاتي"
      width={600}
      footer={
        <>
          <Button title={mode === "account" ? "إنشاء الحساب" : "حفظ التصريح"} icon="user-plus" onPress={submit} loading={create.isPending || invite.isPending} />
          <Button title="إلغاء" variant="secondary" onPress={onClose} />
        </>
      }
    >
      <Segmented
        value={mode}
        onChange={setMode}
        options={[
          { value: "account", label: "حساب بكلمة مرور", icon: "key" },
          { value: "invite", label: "تصريح بالتسجيل", icon: "mail" },
        ]}
      />
      <T className="text-[12.5px] text-muted">
        {mode === "account"
          ? "يُنشأ الحساب مفعّلًا فورًا بكلمة مرور مؤقتة تسلّمها للموظف."
          : "يسجّل الموظف بنفسه من صفحة «اطلب الانضمام» بهذا البريد، ويُفعّل تلقائيًا بالدور والقسم المحددين."}
      </T>
      <View style={{ flexDirection: "row", gap: 12, flexWrap: "wrap" }}>
        <View style={{ flex: 1, minWidth: 220 }}>
          <Field label="الاسم الكامل" required>
            <Input value={form.full_name} onChangeText={(v) => set("full_name", v)} placeholder="مثال: محمد علي" />
          </Field>
        </View>
        <View style={{ flex: 1, minWidth: 220 }}>
          <Field label="المسمى الوظيفي">
            <Input value={form.job_title} onChangeText={(v) => set("job_title", v)} placeholder="مثال: محاسب" />
          </Field>
        </View>
      </View>
      <Field label="البريد الإلكتروني" required>
        <Input value={form.email} onChangeText={(v) => set("email", v)} placeholder="name@company.com" autoCapitalize="none" keyboardType="email-address" style={{ textAlign: "left", writingDirection: "ltr" }} />
      </Field>
      {mode === "account" ? (
        <Field label="كلمة المرور المؤقتة" hint="أنشأناها عشوائيًا ويمكنك تغييرها">
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Input testID="member-password" value={form.password} onChangeText={(v) => set("password", v)} autoCapitalize="none" style={{ flex: 1, textAlign: "left", writingDirection: "ltr" }} />
            <Button icon="refresh-cw" label="توليد كلمة مرور" variant="secondary" onPress={() => set("password", generatePassword())} />
          </View>
        </Field>
      ) : null}
      <View style={{ flexDirection: "row", gap: 12, flexWrap: "wrap" }}>
        <View style={{ flex: 1, minWidth: 220 }}>
          <Field label="الدور" hint={ROLE_HINTS[form.role]}>
            <Select value={form.role} onChange={(v) => set("role", (v ?? "employee") as Role)} options={roles.map((r) => ({ value: r, label: ROLE_LABELS[r], hint: ROLE_HINTS[r] }))} title="الدور" />
          </Field>
        </View>
        <View style={{ flex: 1, minWidth: 220 }}>
          <Field label="القسم">
            <Select
              value={form.department_id}
              onChange={(v) => set("department_id", v)}
              options={departments.map((d) => ({ value: d.id, label: d.name, color: d.color }))}
              noneLabel="بدون قسم"
              placeholder="بدون قسم"
              disabled={!admin}
            />
          </Field>
        </View>
      </View>
      <ErrorBox message={error} />
    </Sheet>
  );
}

export function EditMemberSheet({ visible, onClose, member }: { visible: boolean; onClose: () => void; member: Profile }) {
  const me = useMe();
  const admin = isAdmin(me);
  const { departments } = useLookups();
  const update = useUpdateProfile();
  const toast = useToast();
  const blank = () => ({
    full_name: member.full_name,
    job_title: member.job_title ?? "",
    phone: member.phone ?? "",
    role: member.role,
    department_id: member.department_id,
    status: member.status,
  });
  const [form, setForm] = useState(blank);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (visible) {
      setForm(blank());
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, member.id]);
  const set = <K extends keyof ReturnType<typeof blank>>(k: K, v: ReturnType<typeof blank>[K]) => setForm((f) => ({ ...f, [k]: v }));
  const self = member.id === me.id;

  const submit = () => {
    setError(null);
    if (!form.full_name.trim()) return setError("الاسم مطلوب");
    const patch: Partial<Profile> = {
      full_name: form.full_name.trim(),
      job_title: form.job_title.trim() || null,
      phone: form.phone.trim() || null,
    };
    if (admin) {
      patch.role = form.role;
      patch.department_id = form.department_id;
      patch.status = form.status;
    }
    update.mutate(
      { id: member.id, patch },
      {
        onSuccess: () => {
          toast.show("حُفظت البيانات");
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
      title={self ? "تعديل ملفي" : "تعديل بيانات العضو"}
      subtitle={member.email}
      width={560}
      footer={
        <>
          <Button title="حفظ" icon="check" onPress={submit} loading={update.isPending} />
          <Button title="إلغاء" variant="secondary" onPress={onClose} />
        </>
      }
    >
      <Field label="الاسم الكامل" required>
        <Input value={form.full_name} onChangeText={(v) => set("full_name", v)} />
      </Field>
      <View style={{ flexDirection: "row", gap: 12, flexWrap: "wrap" }}>
        <View style={{ flex: 1, minWidth: 200 }}>
          <Field label="المسمى الوظيفي">
            <Input value={form.job_title} onChangeText={(v) => set("job_title", v)} />
          </Field>
        </View>
        <View style={{ flex: 1, minWidth: 200 }}>
          <Field label="الهاتف">
            <Input value={form.phone} onChangeText={(v) => set("phone", v)} keyboardType="phone-pad" style={{ textAlign: "left", writingDirection: "ltr" }} />
          </Field>
        </View>
      </View>
      {admin ? (
        <>
          <View style={{ flexDirection: "row", gap: 12, flexWrap: "wrap" }}>
            <View style={{ flex: 1, minWidth: 200 }}>
              <Field label="الدور" hint={ROLE_HINTS[form.role]}>
                <Select value={form.role} onChange={(v) => set("role", (v ?? member.role) as Role)} options={assignableRoles(me).map((r) => ({ value: r, label: ROLE_LABELS[r], hint: ROLE_HINTS[r] }))} title="الدور" />
              </Field>
            </View>
            <View style={{ flex: 1, minWidth: 200 }}>
              <Field label="القسم">
                <Select value={form.department_id} onChange={(v) => set("department_id", v)} options={departments.map((d) => ({ value: d.id, label: d.name, color: d.color }))} noneLabel="بدون قسم" placeholder="بدون قسم" />
              </Field>
            </View>
          </View>
          <Field label="حالة الحساب">
            <Segmented
              size="sm"
              value={form.status}
              onChange={(v) => set("status", v as MemberStatus)}
              options={(["active", "pending", "disabled"] as MemberStatus[]).map((s) => ({ value: s, label: MEMBER_STATUS_LABELS[s] }))}
            />
          </Field>
        </>
      ) : !self ? (
        <InfoBox>تغيير الدور أو القسم أو حالة الحساب من صلاحيات مدير النظام.</InfoBox>
      ) : null}
      <ErrorBox message={error} />
    </Sheet>
  );
}

export function ApproveSheet({ visible, onClose, member }: { visible: boolean; onClose: () => void; member: Profile | null }) {
  const { departments } = useLookups();
  const update = useUpdateProfile();
  const toast = useToast();
  const [role, setRole] = useState<Role>("employee");
  const [dept, setDept] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (visible && member) {
      setRole(member.role === "admin" ? "employee" : member.role);
      setDept(member.department_id);
      setError(null);
    }
  }, [visible, member]);
  if (!member) return null;
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="الموافقة على الانضمام"
      subtitle={`${member.full_name} · ${member.email}`}
      width={500}
      footer={
        <>
          <Button
            title="تفعيل الحساب"
            icon="check"
            loading={update.isPending}
            onPress={() =>
              update.mutate(
                { id: member.id, patch: { status: "active", role, department_id: dept } },
                {
                  onSuccess: () => {
                    toast.show(`فُعّل حساب ${member.full_name}`);
                    onClose();
                  },
                  onError: (e) => setError(errorMessage(e)),
                },
              )
            }
          />
          <Button title="إلغاء" variant="secondary" onPress={onClose} />
        </>
      }
    >
      <Field label="الدور" hint={ROLE_HINTS[role]}>
        <Select value={role} onChange={(v) => setRole((v ?? "employee") as Role)} options={(["manager", "supervisor", "employee", "viewer", "admin"] as Role[]).map((r) => ({ value: r, label: ROLE_LABELS[r], hint: ROLE_HINTS[r] }))} title="الدور" />
      </Field>
      <Field label="القسم">
        <Select value={dept} onChange={setDept} options={departments.map((d) => ({ value: d.id, label: d.name, color: d.color }))} noneLabel="بدون قسم" placeholder="بدون قسم" />
      </Field>
      <ErrorBox message={error} />
    </Sheet>
  );
}

export function ResetPasswordSheet({ visible, onClose, member }: { visible: boolean; onClose: () => void; member: Profile }) {
  const reset = useResetPassword();
  const toast = useToast();
  const [password, setPassword] = useState(generatePassword());
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (visible) {
      setPassword(generatePassword());
      setError(null);
      setDone(false);
    }
  }, [visible]);
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="تعيين كلمة مرور جديدة"
      subtitle={member.full_name}
      width={480}
      footer={
        done ? (
          <Button title="تم" onPress={onClose} />
        ) : (
          <>
            <Button
              title="تعيين"
              icon="key"
              loading={reset.isPending}
              onPress={() => {
                setError(null);
                if (password.length < 8) return setError("كلمة المرور 8 أحرف على الأقل");
                reset.mutate(
                  { user_id: member.id, password },
                  {
                    onSuccess: () => {
                      setDone(true);
                      toast.show("عُيّنت كلمة المرور الجديدة");
                    },
                    onError: (e) => setError(errorMessage(e)),
                  },
                );
              }}
            />
            <Button title="إلغاء" variant="secondary" onPress={onClose} />
          </>
        )
      }
    >
      {done ? <InfoBox tone="success" icon="check-circle">سلّم كلمة المرور الجديدة للموظف بطريقة آمنة.</InfoBox> : null}
      <Field label="كلمة المرور الجديدة">
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Input value={password} onChangeText={setPassword} editable={!done} autoCapitalize="none" selectTextOnFocus style={{ flex: 1, textAlign: "left", writingDirection: "ltr" }} />
          {!done ? <Button icon="refresh-cw" label="توليد كلمة مرور" variant="secondary" onPress={() => setPassword(generatePassword())} /> : null}
        </View>
      </Field>
      <ErrorBox message={error} />
    </Sheet>
  );
}
