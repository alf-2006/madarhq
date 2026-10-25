import { describe, expect, it, vi } from "vitest";

vi.mock("react-native", () => ({ Platform: { OS: "web" }, Share: { share: vi.fn() } }));

import { parseCSV, toCSV } from "@/lib/madar/csv";
import {
  addDays,
  addMonths,
  daysBetween,
  fmtClock,
  fmtHours,
  fmtMinutes,
  isoDateInTz,
  isOverdue,
  sessionMinutes,
  setCompanyTimezone,
  startOfWeek,
  timeInTz,
  zonedToUtc,
} from "@/lib/madar/format";
import { assignableRoles, canDeleteTask, canManageTask, canTrackTime, canWorkOnTask, isSelfOwned } from "@/lib/madar/permissions";
import type { Profile, Task } from "@/lib/madar/types";

const profile = (over: Partial<Profile>): Profile =>
  ({
    id: "u1",
    email: "u1@example.com",
    full_name: "U1",
    role: "employee",
    status: "active",
    department_id: "sales",
    job_title: null,
    phone: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...over,
  }) as Profile;

const task = (over: Partial<Task>): Task =>
  ({
    id: "t1",
    number: 1,
    title: "Task",
    status: "todo",
    priority: "medium",
    department_id: "sales",
    project_id: null,
    created_by: "boss",
    reviewer_id: null,
    due_date: null,
    start_date: null,
    task_assignees: [],
    ...over,
  }) as Task;

describe("company timezone handling", () => {
  it("converts a Cairo wall-clock time to UTC and back", () => {
    setCompanyTimezone("Africa/Cairo");
    // 25 Oct 2026 Cairo is UTC+3 (summer time ends on the last Thursday of October).
    const utc = zonedToUtc("2026-10-25", "09:00");
    expect(utc.toISOString()).toBe("2026-10-25T06:00:00.000Z");
    expect(isoDateInTz(utc)).toBe("2026-10-25");
    expect(timeInTz(utc)).toBe("09:00");
  });

  it("keeps late-evening UTC timestamps on the correct local day", () => {
    setCompanyTimezone("Asia/Riyadh");
    expect(isoDateInTz(new Date("2026-03-10T22:30:00Z"))).toBe("2026-03-11");
    setCompanyTimezone("Africa/Cairo");
  });

  it("does calendar math on plain dates without drifting", () => {
    expect(addDays("2026-02-27", 2)).toBe("2026-03-01");
    expect(addMonths("2026-01-31", 1).slice(0, 7)).toBe("2026-02");
    expect(daysBetween("2026-10-01", "2026-10-31")).toBe(30);
  });

  it("starts weeks on Saturday", () => {
    expect(startOfWeek("2026-10-25")).toBe("2026-10-24"); // Sunday -> Saturday
    expect(startOfWeek("2026-10-24")).toBe("2026-10-24");
    expect(startOfWeek("2026-10-30")).toBe("2026-10-24"); // Friday
  });
});

describe("work time", () => {
  it("measures sessions from start to end, or to now for a running timer", () => {
    expect(sessionMinutes({ started_at: "2026-10-25T06:00:00Z", ended_at: "2026-10-25T08:30:00Z" })).toBe(150);
    const now = new Date("2026-10-25T06:45:00Z").getTime();
    expect(sessionMinutes({ started_at: "2026-10-25T06:00:00Z", ended_at: null }, now)).toBe(45);
    expect(sessionMinutes({ started_at: "2026-10-25T06:00:00Z", ended_at: "2026-10-25T05:00:00Z" })).toBe(0);
  });

  it("formats durations in Arabic units", () => {
    expect(fmtMinutes(150)).toBe("2س 30د");
    expect(fmtMinutes(45)).toBe("45د");
    expect(fmtMinutes(120)).toBe("2س");
    expect(fmtHours(150)).toBe("2.5");
    expect(fmtHours(720)).toBe("12");
    expect(fmtClock(3723000)).toBe("01:02:03");
  });

  it("flags open tasks past their due date only", () => {
    expect(isOverdue({ due_date: "2000-01-01", status: "in_progress" })).toBe(true);
    expect(isOverdue({ due_date: "2000-01-01", status: "done" })).toBe(false);
    expect(isOverdue({ due_date: null, status: "todo" })).toBe(false);
  });
});

describe("CSV", () => {
  it("round-trips quotes, commas and Arabic text", () => {
    const csv = toCSV(["العنوان", "الوصف"], [["عرض \"خاص\"", "سطر, ثانٍ"]]);
    expect(parseCSV(csv)).toEqual([
      ["العنوان", "الوصف"],
      ['عرض "خاص"', "سطر, ثانٍ"],
    ]);
  });

  it("ignores a BOM and blank lines and accepts CRLF", () => {
    expect(parseCSV("\uFEFFa,b\r\n\r\n1,2\r\n")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });
});

describe("permission mirrors", () => {
  const employee = profile({ id: "emp" });
  const manager = profile({ id: "mgr", role: "manager" });
  const otherManager = profile({ id: "mgr2", role: "manager", department_id: "marketing" });
  const admin = profile({ id: "adm", role: "admin", department_id: null });
  const viewer = profile({ id: "view", role: "viewer" });
  const assigned = task({ task_assignees: [{ user_id: "emp" }] });

  it("lets department leads and admins manage, but not other departments", () => {
    expect(canManageTask(admin, assigned)).toBe(true);
    expect(canManageTask(manager, assigned)).toBe(true);
    expect(canManageTask(otherManager, assigned)).toBe(false);
    expect(canManageTask(employee, assigned)).toBe(false);
  });

  it("lets assignees work on and track time for their tasks", () => {
    expect(canWorkOnTask(employee, assigned)).toBe(true);
    expect(canTrackTime(employee, assigned)).toBe(true);
    expect(canTrackTime(employee, { ...assigned, status: "done" })).toBe(false);
    expect(canWorkOnTask(profile({ id: "someone" }), assigned)).toBe(false);
  });

  it("keeps viewers and disabled accounts read-only", () => {
    expect(canWorkOnTask(viewer, assigned)).toBe(false);
    expect(canDeleteTask(viewer, assigned)).toBe(false);
    expect(canManageTask(profile({ id: "adm2", role: "admin", status: "disabled" }), assigned)).toBe(false);
  });

  it("treats creator-owned tasks without a reviewer as self-owned", () => {
    expect(isSelfOwned(employee, task({ created_by: "emp" }))).toBe(true);
    expect(isSelfOwned(employee, task({ created_by: "emp", reviewer_id: "mgr" }))).toBe(false);
  });

  it("limits the roles a manager can grant", () => {
    expect(assignableRoles(manager)).not.toContain("admin");
    expect(assignableRoles(manager)).not.toContain("manager");
    expect(assignableRoles(admin)).toContain("admin");
  });
});
