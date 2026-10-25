// Date helpers. Server timestamps are UTC; everything is displayed in the company timezone.
// Plain dates (YYYY-MM-DD) are treated as calendar days and handled in UTC math to avoid shifts.

let companyTz = "Africa/Cairo";
const LOCALE = "ar-EG-u-nu-latn";

export function setCompanyTimezone(tz: string | null | undefined) {
  if (!tz) return;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz }).format(new Date());
    companyTz = tz;
  } catch {
    companyTz = "UTC";
  }
}

export function getCompanyTimezone() {
  return companyTz;
}

function fmt(date: Date, options: Intl.DateTimeFormatOptions) {
  try {
    return new Intl.DateTimeFormat(LOCALE, { timeZone: companyTz, ...options }).format(date);
  } catch {
    return new Intl.DateTimeFormat("ar", options).format(date);
  }
}

/** Today's calendar date (YYYY-MM-DD) in the company timezone. */
export function todayISO(): string {
  return isoDateInTz(new Date());
}

export function isoDateInTz(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: companyTz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** Offset in ms between wall-clock time in the company tz and UTC at the given instant. */
function tzOffsetMs(instant: number): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: companyTz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(instant));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour") % 24, get("minute"), get("second"));
  return asUtc - Math.floor(instant / 1000) * 1000;
}

/** Converts a company-local wall time (date + "HH:MM") into a UTC Date. */
export function zonedToUtc(isoDate: string, time = "00:00"): Date {
  const [y, m, d] = isoDate.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, hh || 0, mm || 0);
  const first = guess - tzOffsetMs(guess);
  const second = guess - tzOffsetMs(first);
  return new Date(second);
}

/** Company-local time HH:MM of a timestamp. */
export function timeInTz(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: companyTz,
    hourCycle: "h23",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return `${get("hour").padStart(2, "0")}:${get("minute")}`;
}

export function parseISODate(iso: string): Date {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(y, (m || 1) - 1, d || 1));
}

export function toISODate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDays(iso: string, days: number): string {
  const d = parseISODate(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return toISODate(d);
}

export function daysBetween(a: string, b: string): number {
  return Math.round((parseISODate(b).getTime() - parseISODate(a).getTime()) / 86400000);
}

/** Saturday-based week start, matching the regional work calendar. */
export function startOfWeek(iso: string): string {
  const d = parseISODate(iso);
  const diff = (d.getUTCDay() + 1) % 7; // Saturday = 0
  return addDays(iso, -diff);
}

export function startOfMonth(iso: string): string {
  return `${iso.slice(0, 7)}-01`;
}

export function addMonths(iso: string, months: number): string {
  const d = parseISODate(startOfMonth(iso));
  d.setUTCMonth(d.getUTCMonth() + months);
  return toISODate(d);
}

export function endOfMonth(iso: string): string {
  return addDays(addMonths(iso, 1), -1);
}

const plainDate = (iso: string, options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat(LOCALE, { timeZone: "UTC", ...options }).format(parseISODate(iso));

export function fmtDay(iso: string | null | undefined): string {
  if (!iso) return "—";
  return plainDate(iso, { day: "numeric", month: "short" });
}

export function fmtDayLong(iso: string | null | undefined): string {
  if (!iso) return "—";
  return plainDate(iso, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

export function fmtDayFull(iso: string | null | undefined): string {
  if (!iso) return "—";
  return plainDate(iso, { day: "numeric", month: "long", year: "numeric" });
}

export function fmtMonth(iso: string): string {
  return plainDate(iso, { month: "long", year: "numeric" });
}

export function fmtWeekdayShort(iso: string): string {
  return plainDate(iso, { weekday: "short" });
}

export function fmtDateTime(ts: string | null | undefined): string {
  if (!ts) return "—";
  return fmt(new Date(ts), { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}

export function fmtTime(ts: string | null | undefined): string {
  if (!ts) return "—";
  return fmt(new Date(ts), { hour: "numeric", minute: "2-digit" });
}

export function fmtTodayHeading(): string {
  return fmt(new Date(), { weekday: "long", day: "numeric", month: "long" });
}

export function fmtRelative(ts: string | null | undefined): string {
  if (!ts) return "";
  const diff = Date.now() - new Date(ts).getTime();
  const min = Math.round(diff / 60000);
  if (min < 1) return "الآن";
  if (min < 60) return `منذ ${min} د`;
  const hours = Math.round(min / 60);
  if (hours < 24) return `منذ ${hours} س`;
  const days = Math.round(hours / 24);
  if (days < 7) return `منذ ${days} ${days === 1 ? "يوم" : days === 2 ? "يومين" : "أيام"}`;
  return fmtDateTime(ts);
}

/** "3س 20د" style compact duration. */
export function fmtMinutes(total: number | null | undefined): string {
  const minutes = Math.max(0, Math.round(total ?? 0));
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}د`;
  if (m === 0) return `${h}س`;
  return `${h}س ${m}د`;
}

export function fmtHours(total: number | null | undefined): string {
  const hours = (total ?? 0) / 60;
  return hours >= 10 ? hours.toFixed(0) : hours.toFixed(1).replace(/\.0$/, "");
}

/** HH:MM:SS stopwatch text. */
export function fmtClock(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

export function sessionMinutes(s: { started_at: string; ended_at: string | null }, now = Date.now()): number {
  const start = new Date(s.started_at).getTime();
  const end = s.ended_at ? new Date(s.ended_at).getTime() : now;
  return Math.max(0, (end - start) / 60000);
}

export function greeting(): string {
  const hour = Number(timeInTz(new Date()).slice(0, 2));
  if (hour < 12) return "صباح الخير";
  if (hour < 18) return "نهارك سعيد";
  return "مساء الخير";
}

export function fmtBytes(bytes: number | null | undefined): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function isOverdue(task: { due_date: string | null; status: string }): boolean {
  return !!task.due_date && task.status !== "done" && task.due_date < todayISO();
}

export function initials(name: string | null | undefined): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "؟";
  if (parts.length === 1) return parts[0].slice(0, 2);
  return `${parts[0][0]}${parts[1][0]}`;
}
