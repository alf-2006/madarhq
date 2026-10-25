-- Madar: row level security policies and private attachments storage

create or replace function public.can_work_on_task(p_task uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.tasks t
    join public.profiles me on me.id = auth.uid() and me.status = 'active' and me.role <> 'viewer'
    where t.id = p_task
      and (
        me.role = 'admin'
        or t.created_by = me.id
        or t.reviewer_id = me.id
        or exists (select 1 from public.task_assignees a where a.task_id = t.id and a.user_id = me.id)
        or (me.role in ('manager', 'supervisor') and me.department_id is not null and t.department_id = me.department_id)
      )
  )
$$;

revoke execute on function public.can_work_on_task(uuid) from public, anon;
grant execute on function public.can_work_on_task(uuid) to authenticated;

alter table public.company_settings enable row level security;
alter table public.departments enable row level security;
alter table public.profiles enable row level security;
alter table public.invitations enable row level security;
alter table public.projects enable row level security;
alter table public.tasks enable row level security;
alter table public.task_assignees enable row level security;
alter table public.subtasks enable row level security;
alter table public.comments enable row level security;
alter table public.attachments enable row level security;
alter table public.time_sessions enable row level security;
alter table public.notifications enable row level security;
alter table public.activities enable row level security;

-- company settings
create policy settings_select on public.company_settings for select to authenticated
  using (public.is_active_member());
create policy settings_update on public.company_settings for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- departments
create policy departments_select on public.departments for select to authenticated
  using (public.is_active_member());
create policy departments_insert on public.departments for insert to authenticated
  with check (public.is_admin());
create policy departments_update on public.departments for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy departments_delete on public.departments for delete to authenticated
  using (public.is_admin());

-- profiles (field-level rules are enforced by the profiles_guard trigger)
create policy profiles_select on public.profiles for select to authenticated
  using (id = (select auth.uid()) or public.is_active_member());
create policy profiles_update on public.profiles for update to authenticated
  using (
    id = (select auth.uid())
    or public.is_admin()
    or (public.my_role() = 'manager' and department_id is not null and department_id = public.my_department())
  )
  with check (true);
create policy profiles_delete on public.profiles for delete to authenticated
  using (public.is_admin() and id <> (select auth.uid()));

-- invitations
create policy invitations_select on public.invitations for select to authenticated
  using (
    public.is_admin()
    or (public.my_role() = 'manager' and department_id is not null and department_id = public.my_department())
  );
create policy invitations_insert on public.invitations for insert to authenticated
  with check (
    public.is_admin()
    or (public.my_role() = 'manager' and department_id = public.my_department()
        and role in ('supervisor', 'employee', 'viewer'))
  );
create policy invitations_update on public.invitations for update to authenticated
  using (
    public.is_admin()
    or (public.my_role() = 'manager' and department_id = public.my_department())
  )
  with check (
    public.is_admin()
    or (public.my_role() = 'manager' and department_id = public.my_department()
        and role in ('supervisor', 'employee', 'viewer'))
  );
create policy invitations_delete on public.invitations for delete to authenticated
  using (
    public.is_admin()
    or (public.my_role() = 'manager' and department_id = public.my_department())
  );

-- projects
create policy projects_select on public.projects for select to authenticated
  using (public.is_active_member());
create policy projects_insert on public.projects for insert to authenticated
  with check (public.my_role() in ('admin', 'manager'));
create policy projects_update on public.projects for update to authenticated
  using (
    public.is_admin()
    or (public.my_role() = 'manager' and department_id is not distinct from public.my_department())
    or (owner_id = (select auth.uid()) and public.my_role() <> 'viewer')
  )
  with check (public.my_role() in ('admin', 'manager', 'supervisor', 'employee'));
create policy projects_delete on public.projects for delete to authenticated
  using (
    public.is_admin()
    or (public.my_role() = 'manager' and department_id is not distinct from public.my_department())
  );

-- tasks (column-level workflow rules are enforced by the tasks_guard trigger)
create policy tasks_select on public.tasks for select to authenticated
  using (
    public.is_active_member()
    and (
      public.my_role() in ('admin', 'viewer')
      or created_by = (select auth.uid())
      or reviewer_id = (select auth.uid())
      or public.is_task_assignee(id)
      or (public.my_role() in ('manager', 'supervisor') and department_id is not null
          and department_id = public.my_department())
    )
  );
create policy tasks_insert on public.tasks for insert to authenticated
  with check (public.my_role() in ('admin', 'manager', 'supervisor', 'employee'));
create policy tasks_update on public.tasks for update to authenticated
  using (public.can_work_on_task(id))
  with check (public.my_role() in ('admin', 'manager', 'supervisor', 'employee'));
create policy tasks_delete on public.tasks for delete to authenticated
  using (
    public.is_admin()
    or (public.my_role() in ('manager', 'supervisor') and department_id is not null
        and department_id = public.my_department())
    or (created_by = (select auth.uid()) and public.my_role() <> 'viewer')
  );

-- assignees
create policy assignees_select on public.task_assignees for select to authenticated
  using (public.can_view_task(task_id));
create policy assignees_insert on public.task_assignees for insert to authenticated
  with check (
    public.can_manage_task(task_id)
    or exists (select 1 from public.tasks t where t.id = task_id and t.created_by = (select auth.uid()))
  );
create policy assignees_delete on public.task_assignees for delete to authenticated
  using (
    public.can_manage_task(task_id)
    or exists (select 1 from public.tasks t where t.id = task_id and t.created_by = (select auth.uid()))
  );

-- subtasks
create policy subtasks_select on public.subtasks for select to authenticated
  using (public.can_view_task(task_id));
create policy subtasks_insert on public.subtasks for insert to authenticated
  with check (public.can_work_on_task(task_id));
create policy subtasks_update on public.subtasks for update to authenticated
  using (public.can_work_on_task(task_id)) with check (public.can_work_on_task(task_id));
create policy subtasks_delete on public.subtasks for delete to authenticated
  using (public.can_work_on_task(task_id));

-- comments
create policy comments_select on public.comments for select to authenticated
  using (public.can_view_task(task_id));
create policy comments_insert on public.comments for insert to authenticated
  with check (public.can_view_task(task_id) and public.my_role() <> 'viewer');
create policy comments_update on public.comments for update to authenticated
  using (author_id = (select auth.uid())) with check (author_id = (select auth.uid()));
create policy comments_delete on public.comments for delete to authenticated
  using (author_id = (select auth.uid()) or public.is_admin());

-- attachments
create policy attachments_select on public.attachments for select to authenticated
  using (public.can_view_task(task_id));
create policy attachments_insert on public.attachments for insert to authenticated
  with check (public.can_work_on_task(task_id));
create policy attachments_delete on public.attachments for delete to authenticated
  using (uploader_id = (select auth.uid()) or public.can_manage_task(task_id));

-- time sessions (writes go through start_timer / stop_timer / add_time_entry)
create policy time_select on public.time_sessions for select to authenticated
  using (user_id = (select auth.uid()) or public.can_view_task(task_id));
create policy time_delete on public.time_sessions for delete to authenticated
  using (
    (user_id = (select auth.uid()) and ended_at is not null)
    or public.is_admin()
  );

-- notifications
create policy notifications_select on public.notifications for select to authenticated
  using (user_id = (select auth.uid()));
create policy notifications_update on public.notifications for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy notifications_delete on public.notifications for delete to authenticated
  using (user_id = (select auth.uid()));

-- activity log
create policy activities_select on public.activities for select to authenticated
  using (
    (task_id is not null and public.can_view_task(task_id))
    or (task_id is null and public.is_active_member())
  );

-- private storage for task attachments: <task_id>/<uuid>-<file name>
insert into storage.buckets (id, name, public, file_size_limit)
values ('attachments', 'attachments', false, 26214400)
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit;

create policy attachments_objects_select on storage.objects for select to authenticated
  using (bucket_id = 'attachments' and public.can_view_task(public.task_id_from_path(name)));
create policy attachments_objects_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'attachments' and public.can_work_on_task(public.task_id_from_path(name)));
create policy attachments_objects_delete on storage.objects for delete to authenticated
  using (
    bucket_id = 'attachments'
    and (owner_id = (select auth.uid())::text or public.can_manage_task(public.task_id_from_path(name)))
  );
