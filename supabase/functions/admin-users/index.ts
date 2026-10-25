// Madar account management: workspace setup, access requests, member creation and password resets.
// Runs with the service role; every privileged action re-checks the caller's active profile.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ROLES = ["admin", "manager", "supervisor", "employee", "viewer"] as const;
type Role = (typeof ROLES)[number];

function reply(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

function fail(message: string, status = 400) {
  return reply(status, { error: message });
}

const emailOk = (v: unknown): v is string =>
  typeof v === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()) && v.length <= 254;

const passwordOk = (v: unknown): v is string => typeof v === "string" && v.length >= 8 && v.length <= 72;

const text = (v: unknown, max = 200) => (typeof v === "string" ? v.trim().slice(0, max) : "");

function friendlyAuthError(message: string) {
  const m = message.toLowerCase();
  if (m.includes("already") && (m.includes("registered") || m.includes("exists"))) {
    return "هذا البريد مسجّل بالفعل";
  }
  if (m.includes("password")) return "كلمة المرور غير مقبولة، استخدم 8 أحرف على الأقل";
  return "تعذّر إنشاء الحساب، حاول مرة أخرى";
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return fail("Method not allowed", 405);

  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return fail("طلب غير صالح");
  }
  const action = body.action;

  // ---------- public actions ----------
  if (action === "setup") {
    const { count, error: countError } = await admin
      .from("profiles")
      .select("id", { count: "exact", head: true });
    if (countError) return fail("تعذّر التحقق من حالة مساحة العمل", 500);
    if ((count ?? 0) > 0) return fail("تم إعداد مساحة العمل مسبقًا، سجّل الدخول", 409);
    if (!emailOk(body.email)) return fail("أدخل بريدًا إلكترونيًا صحيحًا");
    if (!passwordOk(body.password)) return fail("كلمة المرور يجب أن تكون 8 أحرف على الأقل");
    const fullName = text(body.full_name, 120);
    if (!fullName) return fail("أدخل اسمك");
    const companyName = text(body.company_name, 120);

    const { data, error } = await admin.auth.admin.createUser({
      email: body.email.trim().toLowerCase(),
      password: body.password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });
    if (error || !data.user) return fail(friendlyAuthError(error?.message ?? ""));
    if (companyName) {
      await admin.from("company_settings").update({ company_name: companyName }).eq("id", 1);
    }
    return reply(200, { ok: true });
  }

  if (action === "register") {
    if (!emailOk(body.email)) return fail("أدخل بريدًا إلكترونيًا صحيحًا");
    if (!passwordOk(body.password)) return fail("كلمة المرور يجب أن تكون 8 أحرف على الأقل");
    const fullName = text(body.full_name, 120);
    if (!fullName) return fail("أدخل اسمك");
    const { count } = await admin.from("profiles").select("id", { count: "exact", head: true });
    if ((count ?? 0) === 0) return fail("مساحة العمل لم تُجهّز بعد، ابدأ بإعداد حساب المدير", 409);

    const { data, error } = await admin.auth.admin.createUser({
      email: body.email.trim().toLowerCase(),
      password: body.password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });
    if (error || !data.user) return fail(friendlyAuthError(error?.message ?? ""));
    const { data: profile } = await admin
      .from("profiles")
      .select("status")
      .eq("id", data.user.id)
      .single();
    return reply(200, { ok: true, status: profile?.status ?? "pending" });
  }

  // ---------- authenticated actions ----------
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return fail("سجّل الدخول أولًا", 401);
  const { data: authData, error: authError } = await admin.auth.getUser(token);
  if (authError || !authData.user) return fail("انتهت الجلسة، سجّل الدخول مجددًا", 401);

  const { data: me } = await admin
    .from("profiles")
    .select("id, role, status, department_id")
    .eq("id", authData.user.id)
    .single();
  if (!me || me.status !== "active") return fail("حسابك غير مفعّل", 403);
  const myRole = me.role as Role;

  if (action === "create_member") {
    if (!emailOk(body.email)) return fail("أدخل بريدًا إلكترونيًا صحيحًا");
    if (!passwordOk(body.password)) return fail("كلمة المرور يجب أن تكون 8 أحرف على الأقل");
    const role = (ROLES as readonly string[]).includes(body.role as string) ? (body.role as Role) : "employee";
    let departmentId = typeof body.department_id === "string" && body.department_id ? body.department_id : null;
    const fullName = text(body.full_name, 120);
    const jobTitle = text(body.job_title, 120) || null;
    if (!fullName) return fail("أدخل اسم الموظف");

    if (myRole === "manager") {
      if (!["supervisor", "employee", "viewer"].includes(role)) {
        return fail("مدير القسم يضيف مشرفين وموظفين ومشاهدين فقط", 403);
      }
      departmentId = me.department_id;
    } else if (myRole !== "admin") {
      return fail("إضافة الموظفين من صلاحيات مدير النظام ومدير القسم", 403);
    }

    const email = body.email.trim().toLowerCase();
    const { error: invError } = await admin.from("invitations").upsert(
      {
        email,
        full_name: fullName,
        role,
        department_id: departmentId,
        job_title: jobTitle,
        invited_by: me.id,
        accepted_at: null,
      },
      { onConflict: "email" },
    );
    if (invError) return fail("تعذّر تجهيز بيانات الموظف", 500);

    const { data, error } = await admin.auth.admin.createUser({
      email,
      password: body.password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });
    if (error || !data.user) {
      await admin.from("invitations").delete().eq("email", email).is("accepted_at", null);
      return fail(friendlyAuthError(error?.message ?? ""));
    }
    return reply(200, { ok: true, user_id: data.user.id });
  }

  if (action === "reset_password") {
    const userId = typeof body.user_id === "string" ? body.user_id : "";
    if (!userId) return fail("حدّد الموظف");
    if (!passwordOk(body.password)) return fail("كلمة المرور يجب أن تكون 8 أحرف على الأقل");
    const { data: target } = await admin
      .from("profiles")
      .select("id, role, department_id")
      .eq("id", userId)
      .single();
    if (!target) return fail("الموظف غير موجود", 404);
    const allowed =
      myRole === "admin" ||
      target.id === me.id ||
      (myRole === "manager" &&
        me.department_id &&
        target.department_id === me.department_id &&
        ["supervisor", "employee", "viewer"].includes(target.role));
    if (!allowed) return fail("غير مصرح لك بتغيير كلمة مرور هذا الحساب", 403);
    const { error } = await admin.auth.admin.updateUserById(userId, { password: body.password });
    if (error) return fail(friendlyAuthError(error.message));
    return reply(200, { ok: true });
  }

  return fail("إجراء غير معروف");
});
