import type { Priority, ProjectStatus, Role, MemberStatus, TaskStatus } from "./types";

export const ROLE_LABELS: Record<Role, string> = {
  admin: "مدير النظام",
  manager: "مدير قسم",
  supervisor: "مشرف",
  employee: "موظف",
  viewer: "مشاهد",
};

export const ROLE_HINTS: Record<Role, string> = {
  admin: "صلاحيات كاملة على الشركة والإعدادات",
  manager: "يدير قسمه ومهامه ومشاريعه وموظفيه",
  supervisor: "يتابع ويراجع مهام قسمه",
  employee: "يعمل على المهام المسندة إليه",
  viewer: "يطّلع على البيانات دون تعديل",
};

export const ROLE_ORDER: Role[] = ["admin", "manager", "supervisor", "employee", "viewer"];

export const MEMBER_STATUS_LABELS: Record<MemberStatus, string> = {
  pending: "بانتظار الموافقة",
  active: "نشط",
  disabled: "موقوف",
};

export const STATUS_LABELS: Record<TaskStatus, string> = {
  todo: "جديدة",
  in_progress: "قيد التنفيذ",
  review: "بانتظار المراجعة",
  done: "مكتملة",
  blocked: "معلّقة",
};

export const STATUS_ORDER: TaskStatus[] = ["todo", "in_progress", "review", "blocked", "done"];

export type Tone = "neutral" | "primary" | "warning" | "error" | "info" | "success";

export const STATUS_TONE: Record<TaskStatus, Tone> = {
  todo: "neutral",
  in_progress: "info",
  review: "warning",
  done: "primary",
  blocked: "error",
};

export const PRIORITY_LABELS: Record<Priority, string> = {
  low: "منخفضة",
  medium: "متوسطة",
  high: "عالية",
  urgent: "عاجلة",
};

export const PRIORITY_ORDER: Priority[] = ["urgent", "high", "medium", "low"];

export const PRIORITY_TONE: Record<Priority, Tone> = {
  low: "neutral",
  medium: "info",
  high: "warning",
  urgent: "error",
};

export const PRIORITY_RANK: Record<Priority, number> = { urgent: 0, high: 1, medium: 2, low: 3 };

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  planning: "تخطيط",
  active: "نشط",
  on_hold: "متوقف مؤقتًا",
  completed: "مكتمل",
  archived: "مؤرشف",
};

export const PROJECT_STATUS_TONE: Record<ProjectStatus, Tone> = {
  planning: "neutral",
  active: "primary",
  on_hold: "warning",
  completed: "success",
  archived: "neutral",
};

export const PROJECT_STATUS_ORDER: ProjectStatus[] = ["planning", "active", "on_hold", "completed", "archived"];

export const PALETTE = ["#176B52", "#2F6FA3", "#B7791F", "#8E4B9B", "#C2412D", "#3E7C8C", "#6B7F2A", "#5A5F73"];

export const TIMEZONES: { value: string; label: string }[] = [
  { value: "Africa/Cairo", label: "القاهرة" },
  { value: "Asia/Riyadh", label: "الرياض" },
  { value: "Asia/Dubai", label: "دبي" },
  { value: "Asia/Kuwait", label: "الكويت" },
  { value: "Asia/Qatar", label: "الدوحة" },
  { value: "Asia/Bahrain", label: "المنامة" },
  { value: "Asia/Muscat", label: "مسقط" },
  { value: "Asia/Amman", label: "عمّان" },
  { value: "Asia/Beirut", label: "بيروت" },
  { value: "Asia/Baghdad", label: "بغداد" },
  { value: "Africa/Tripoli", label: "طرابلس" },
  { value: "Africa/Tunis", label: "تونس" },
  { value: "Africa/Algiers", label: "الجزائر" },
  { value: "Africa/Casablanca", label: "الدار البيضاء" },
  { value: "Africa/Khartoum", label: "الخرطوم" },
  { value: "Europe/Istanbul", label: "إسطنبول" },
  { value: "Europe/London", label: "لندن" },
  { value: "UTC", label: "التوقيت العالمي UTC" },
];

export const ACTIVITY_LABELS: Record<string, string> = {
  task_created: "أنشأ المهمة",
  status_changed: "غيّر الحالة",
  due_changed: "غيّر تاريخ الاستحقاق",
  priority_changed: "غيّر الأولوية",
  assigned: "أسند المهمة",
  unassigned: "ألغى إسناد",
  commented: "علّق",
  file_attached: "أرفق ملفًا",
};
