// Client-side mirror of the database rules. The database (RLS + triggers) remains the source of
// truth; these helpers only decide which actions to show.
import type { Profile, Project, Role, Task } from "./types";

const LEADS: Role[] = ["manager", "supervisor"];

export const isAdmin = (me: Profile | null | undefined) => me?.role === "admin";
export const isViewer = (me: Profile | null | undefined) => me?.role === "viewer";
export const isLead = (me: Profile | null | undefined) => !!me && (me.role === "admin" || LEADS.includes(me.role));

export function isAssignee(me: Profile | null | undefined, task: Task) {
  return !!me && !!task.task_assignees?.some((a) => a.user_id === me.id);
}

export function canManageTask(me: Profile | null | undefined, task: Task) {
  if (!me || me.status !== "active") return false;
  if (me.role === "admin") return true;
  if (!LEADS.includes(me.role)) return false;
  return (
    (!!me.department_id && task.department_id === me.department_id) ||
    task.created_by === me.id ||
    task.reviewer_id === me.id
  );
}

export function canWorkOnTask(me: Profile | null | undefined, task: Task) {
  if (!me || me.status !== "active" || me.role === "viewer") return false;
  return (
    me.role === "admin" ||
    task.created_by === me.id ||
    task.reviewer_id === me.id ||
    isAssignee(me, task) ||
    (LEADS.includes(me.role) && !!me.department_id && task.department_id === me.department_id)
  );
}

export function canEditTaskDetails(me: Profile | null | undefined, task: Task) {
  return canManageTask(me, task) || (!!me && me.role !== "viewer" && task.created_by === me.id);
}

export function canDeleteTask(me: Profile | null | undefined, task: Task) {
  if (!me || me.role === "viewer") return false;
  return (
    me.role === "admin" ||
    (LEADS.includes(me.role) && !!me.department_id && task.department_id === me.department_id) ||
    task.created_by === me.id
  );
}

/** Self-owned tasks (created by me, no reviewer) can be closed without review. */
export function isSelfOwned(me: Profile | null | undefined, task: Task) {
  return !!me && task.created_by === me.id && !task.reviewer_id;
}

export function canCreateTask(me: Profile | null | undefined) {
  return !!me && me.status === "active" && me.role !== "viewer";
}

export function canCreateProject(me: Profile | null | undefined) {
  return !!me && (me.role === "admin" || me.role === "manager");
}

export function canEditProject(me: Profile | null | undefined, project: Project) {
  if (!me) return false;
  if (me.role === "admin") return true;
  if (me.role === "manager" && project.department_id === me.department_id) return true;
  return project.owner_id === me.id && me.role !== "viewer";
}

export function canDeleteProject(me: Profile | null | undefined, project: Project) {
  if (!me) return false;
  return me.role === "admin" || (me.role === "manager" && project.department_id === me.department_id);
}

export function canManageMembers(me: Profile | null | undefined) {
  return !!me && (me.role === "admin" || me.role === "manager");
}

export function canEditMember(me: Profile | null | undefined, member: Profile) {
  if (!me) return false;
  if (me.role === "admin") return true;
  return me.role === "manager" && !!me.department_id && member.department_id === me.department_id && member.id !== me.id;
}

/** Roles a member manager may assign when adding people. */
export function assignableRoles(me: Profile | null | undefined): Role[] {
  if (me?.role === "admin") return ["admin", "manager", "supervisor", "employee", "viewer"];
  if (me?.role === "manager") return ["supervisor", "employee", "viewer"];
  return [];
}

/** Mirrors start_timer / add_time_entry: assignees, task managers and the creator, never on approved tasks. */
export function canTrackTime(me: Profile | null | undefined, task: Task) {
  if (!me || me.status !== "active" || me.role === "viewer" || task.status === "done") return false;
  return isAssignee(me, task) || canManageTask(me, task) || task.created_by === me.id;
}
