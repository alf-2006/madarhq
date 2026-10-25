import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import Constants from "expo-constants";
import { Platform } from "react-native";

const extra = (Constants.expoConfig?.extra ?? {}) as { supabaseUrl?: string; supabaseKey?: string };

export const SUPABASE_URL =
  process.env.EXPO_PUBLIC_SUPABASE_URL || extra.supabaseUrl || "https://nuotqfpkoffuwkoqdtte.supabase.co";
export const SUPABASE_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_KEY || extra.supabaseKey || "sb_publishable_aFV-vjtaksRROqsw5sk4kQ_wZZ9y-sb";

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    storage: Platform.OS === "web" ? undefined : AsyncStorage,
    storageKey: "madar-auth",
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: Platform.OS === "web",
  },
});

/** Converts Supabase / Postgres errors into short Arabic messages for the UI. */
export function errorMessage(error: unknown): string {
  if (!error) return "حدث خطأ غير متوقع";
  const e = error as { message?: string; code?: string; context?: unknown };
  const msg = e.message ?? String(error);
  if (/[\u0600-\u06FF]/.test(msg)) return msg;
  const lower = msg.toLowerCase();
  if (lower.includes("invalid login credentials")) return "البريد الإلكتروني أو كلمة المرور غير صحيحة";
  if (lower.includes("email not confirmed")) return "البريد الإلكتروني لم يتم تأكيده بعد";
  if (lower.includes("failed to fetch") || lower.includes("network")) return "تعذّر الاتصال بالخادم، تحقّق من الإنترنت";
  if (e.code === "42501" || lower.includes("row-level security") || lower.includes("permission denied")) {
    return "ليست لديك صلاحية لتنفيذ هذا الإجراء";
  }
  if (e.code === "23505" || lower.includes("duplicate key")) return "هذه القيمة مستخدمة بالفعل";
  if (e.code === "23503") return "لا يمكن تنفيذ العملية لارتباطها ببيانات أخرى";
  if (lower.includes("password should be")) return "كلمة المرور قصيرة جدًا";
  if (lower.includes("jwt") || lower.includes("session")) return "انتهت الجلسة، سجّل الدخول مجددًا";
  return msg;
}

/** Calls the admin-users edge function and surfaces its Arabic error message. */
export async function callAccounts<T = { ok: boolean }>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("admin-users", { body });
  if (error) {
    let message = error.message;
    const ctx = (error as { context?: Response }).context;
    if (ctx && typeof ctx.json === "function") {
      try {
        const parsed = await ctx.json();
        if (parsed?.error) message = parsed.error;
      } catch {
        // keep original message
      }
    }
    throw new Error(errorMessage({ message }));
  }
  if (data && typeof data === "object" && "error" in data && data.error) {
    throw new Error(String((data as { error: string }).error));
  }
  return data as T;
}
