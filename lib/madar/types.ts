export type Role = "admin" | "manager" | "supervisor" | "employee" | "viewer";
export type MemberStatus = "pending" | "active" | "disabled";
export type TaskStatus = "todo" | "in_progress" | "review" | "done" | "blocked";
export type Priority = "low" | "medium" | "high" | "urgent";
export type ProjectStatus = "planning" | "active" | "on_hold" | "completed" | "archived";

export interface CompanySettings {
  id: number;
  company_name: string;
  timezone: string;
  updated_at: string;
}

export interface Department {
  id: string;
  name: string;
  description: string | null;
  color: string;
  manager_id: string | null;
  created_at: string;
}

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  job_title: string | null;
  phone: string | null;
  role: Role;
  status: MemberStatus;
  department_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Invitation {
  id: string;
  email: string;
  full_name: string | null;
  role: Role;
  department_id: string | null;
  job_title: string | null;
  invited_by: string | null;
  accepted_at: string | null;
  created_at: string;
}

export interface Project {
  id: string;
  name: string;
  description: string | null;
  department_id: string | null;
  owner_id: string | null;
  status: ProjectStatus;
  color: string;
  start_date: string | null;
  due_date: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Task {
  id: string;
  number: number;
  title: string;
  description: string | null;
  project_id: string | null;
  department_id: string | null;
  status: TaskStatus;
  priority: Priority;
  start_date: string | null;
  due_date: string | null;
  estimate_minutes: number | null;
  reviewer_id: string | null;
  review_note: string | null;
  created_by: string | null;
  submitted_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  task_assignees?: { user_id: string }[];
}

export interface Subtask {
  id: string;
  task_id: string;
  title: string;
  done: boolean;
  position: number;
  created_at: string;
}

export interface Comment {
  id: string;
  task_id: string;
  author_id: string | null;
  body: string;
  created_at: string;
}

export interface Attachment {
  id: string;
  task_id: string;
  uploader_id: string | null;
  file_name: string;
  storage_path: string;
  size_bytes: number | null;
  mime_type: string | null;
  created_at: string;
}

export interface TimeSession {
  id: string;
  task_id: string;
  user_id: string;
  started_at: string;
  ended_at: string | null;
  note: string | null;
  is_manual: boolean;
  created_at: string;
}

export interface NotificationItem {
  id: string;
  user_id: string;
  kind: string;
  title: string;
  body: string | null;
  task_id: string | null;
  actor_id: string | null;
  read_at: string | null;
  created_at: string;
}

export interface Activity {
  id: number;
  actor_id: string | null;
  task_id: string | null;
  project_id: string | null;
  action: string;
  details: Record<string, unknown>;
  created_at: string;
}

export interface TaskTimeTotal {
  task_id: string;
  minutes: number;
  sessions: number;
}

export type TaskInput = {
  title: string;
  description: string | null;
  project_id: string | null;
  department_id: string | null;
  status: TaskStatus;
  priority: Priority;
  start_date: string | null;
  due_date: string | null;
  estimate_minutes: number | null;
  reviewer_id: string | null;
};
