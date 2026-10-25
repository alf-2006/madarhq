-- Madar: core schema (departments, people, projects, tasks, time, notifications)

create type public.app_role as enum ('admin', 'manager', 'supervisor', 'employee', 'viewer');
create type public.member_status as enum ('pending', 'active', 'disabled');
create type public.task_status as enum ('todo', 'in_progress', 'review', 'done', 'blocked');
create type public.task_priority as enum ('low', 'medium', 'high', 'urgent');
create type public.project_status as enum ('planning', 'active', 'on_hold', 'completed', 'archived');

create table public.company_settings (
  id int primary key default 1 check (id = 1),
  company_name text not null default 'شركتي',
  timezone text not null default 'Africa/Cairo',
  updated_at timestamptz not null default now()
);
insert into public.company_settings (id) values (1);

create table public.departments (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (length(trim(name)) > 0),
  description text,
  color text not null default '#176B52',
  manager_id uuid,
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text not null default '',
  job_title text,
  phone text,
  role public.app_role not null default 'employee',
  status public.member_status not null default 'pending',
  department_id uuid references public.departments (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index profiles_department_idx on public.profiles (department_id);

alter table public.departments
  add constraint departments_manager_fk foreign key (manager_id) references public.profiles (id) on delete set null;
create index departments_manager_idx on public.departments (manager_id);

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  email text not null unique check (email = lower(email)),
  full_name text,
  role public.app_role not null default 'employee',
  department_id uuid references public.departments (id) on delete set null,
  job_title text,
  invited_by uuid references public.profiles (id) on delete set null,
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);
create index invitations_department_idx on public.invitations (department_id);
create index invitations_invited_by_idx on public.invitations (invited_by);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  description text,
  department_id uuid references public.departments (id) on delete set null,
  owner_id uuid references public.profiles (id) on delete set null,
  status public.project_status not null default 'active',
  color text not null default '#176B52',
  start_date date,
  due_date date,
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (due_date is null or start_date is null or due_date >= start_date)
);
create index projects_department_idx on public.projects (department_id);
create index projects_owner_idx on public.projects (owner_id);
create index projects_created_by_idx on public.projects (created_by);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  number bigint generated always as identity unique,
  title text not null check (length(trim(title)) > 0),
  description text,
  project_id uuid references public.projects (id) on delete set null,
  department_id uuid references public.departments (id) on delete set null,
  status public.task_status not null default 'todo',
  priority public.task_priority not null default 'medium',
  start_date date,
  due_date date,
  estimate_minutes int check (estimate_minutes is null or estimate_minutes >= 0),
  reviewer_id uuid references public.profiles (id) on delete set null,
  review_note text,
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  submitted_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (due_date is null or start_date is null or due_date >= start_date)
);
create index tasks_project_idx on public.tasks (project_id);
create index tasks_department_idx on public.tasks (department_id);
create index tasks_reviewer_idx on public.tasks (reviewer_id);
create index tasks_created_by_idx on public.tasks (created_by);
create index tasks_status_idx on public.tasks (status);
create index tasks_due_idx on public.tasks (due_date);

create table public.task_assignees (
  task_id uuid not null references public.tasks (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  assigned_by uuid references public.profiles (id) on delete set null default auth.uid(),
  assigned_at timestamptz not null default now(),
  primary key (task_id, user_id)
);
create index task_assignees_user_idx on public.task_assignees (user_id);
create index task_assignees_assigned_by_idx on public.task_assignees (assigned_by);

create table public.subtasks (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  title text not null check (length(trim(title)) > 0),
  done boolean not null default false,
  position int not null default 0,
  created_at timestamptz not null default now()
);
create index subtasks_task_idx on public.subtasks (task_id);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  author_id uuid references public.profiles (id) on delete set null default auth.uid(),
  body text not null check (length(trim(body)) > 0),
  created_at timestamptz not null default now()
);
create index comments_task_idx on public.comments (task_id, created_at);
create index comments_author_idx on public.comments (author_id);

create table public.attachments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  uploader_id uuid references public.profiles (id) on delete set null default auth.uid(),
  file_name text not null,
  storage_path text not null unique,
  size_bytes bigint,
  mime_type text,
  created_at timestamptz not null default now()
);
create index attachments_task_idx on public.attachments (task_id);
create index attachments_uploader_idx on public.attachments (uploader_id);

create table public.time_sessions (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  note text,
  is_manual boolean not null default false,
  created_at timestamptz not null default now(),
  check (ended_at is null or ended_at >= started_at)
);
create unique index time_sessions_one_open_per_user on public.time_sessions (user_id) where ended_at is null;
create index time_sessions_task_idx on public.time_sessions (task_id);
create index time_sessions_user_started_idx on public.time_sessions (user_id, started_at);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null,
  title text not null,
  body text,
  task_id uuid references public.tasks (id) on delete cascade,
  actor_id uuid references public.profiles (id) on delete set null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);
create index notifications_task_idx on public.notifications (task_id);
create index notifications_actor_idx on public.notifications (actor_id);

create table public.activities (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles (id) on delete set null,
  task_id uuid references public.tasks (id) on delete cascade,
  project_id uuid references public.projects (id) on delete cascade,
  action text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index activities_task_idx on public.activities (task_id, created_at desc);
create index activities_project_idx on public.activities (project_id);
create index activities_actor_idx on public.activities (actor_id);
create index activities_created_idx on public.activities (created_at desc);

-- Actual work per task, summed from separate sessions (open sessions count up to now).
create view public.task_time_totals with (security_invoker = on) as
select
  task_id,
  (sum(extract(epoch from (coalesce(ended_at, now()) - started_at))) / 60)::int as minutes,
  count(*)::int as sessions
from public.time_sessions
group by task_id;
