-- Madar: authorization helpers, workflow triggers, notifications and timer RPCs

create or replace function public.my_role() returns public.app_role
language sql stable security definer set search_path = ''
as $$ select p.role from public.profiles p where p.id = auth.uid() and p.status = 'active' $$;

create or replace function public.my_department() returns uuid
language sql stable security definer set search_path = ''
as $$ select p.department_id from public.profiles p where p.id = auth.uid() and p.status = 'active' $$;

create or replace function public.is_active_member() returns boolean
language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.profiles p where p.id = auth.uid() and p.status = 'active') $$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.profiles p where p.id = auth.uid() and p.status = 'active' and p.role = 'admin') $$;

create or replace function public.is_task_assignee(p_task uuid) returns boolean
language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.task_assignees a where a.task_id = p_task and a.user_id = auth.uid()) $$;

create or replace function public.can_view_task(p_task uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.tasks t
    join public.profiles me on me.id = auth.uid() and me.status = 'active'
    where t.id = p_task
      and (
        me.role in ('admin', 'viewer')
        or t.created_by = me.id
        or t.reviewer_id = me.id
        or exists (select 1 from public.task_assignees a where a.task_id = t.id and a.user_id = me.id)
        or (me.role in ('manager', 'supervisor') and me.department_id is not null and t.department_id = me.department_id)
      )
  )
$$;

create or replace function public.can_manage_task(p_task uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.tasks t
    join public.profiles me on me.id = auth.uid() and me.status = 'active'
    where t.id = p_task
      and (
        me.role = 'admin'
        or (
          me.role in ('manager', 'supervisor')
          and (
            (me.department_id is not null and t.department_id = me.department_id)
            or t.created_by = me.id
            or t.reviewer_id = me.id
          )
        )
      )
  )
$$;

create or replace function public.task_id_from_path(p_name text) returns uuid
language plpgsql immutable set search_path = ''
as $$
begin
  return split_part(p_name, '/', 1)::uuid;
exception when others then
  return null;
end $$;

create or replace function public.workspace_status() returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'has_admin', exists (select 1 from public.profiles where role = 'admin' and status = 'active'),
    'company_name', (select company_name from public.company_settings where id = 1)
  )
$$;

create or replace function public.notify_user(
  p_user uuid, p_kind text, p_title text, p_body text, p_task uuid
) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if p_user is null or p_user = auth.uid() then
    return;
  end if;
  if not exists (select 1 from public.profiles where id = p_user and status = 'active') then
    return;
  end if;
  insert into public.notifications (user_id, kind, title, body, task_id, actor_id)
  values (p_user, p_kind, p_title, p_body, p_task, auth.uid());
end $$;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_inv public.invitations;
  v_name text := nullif(trim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), '');
  v_admin record;
begin
  perform pg_advisory_xact_lock(hashtext('madar_new_user'));

  if not exists (select 1 from public.profiles) then
    insert into public.profiles (id, email, full_name, role, status)
    values (new.id, lower(new.email), coalesce(v_name, split_part(new.email, '@', 1)), 'admin', 'active');
    return new;
  end if;

  select * into v_inv from public.invitations
  where email = lower(new.email) and accepted_at is null
  limit 1;

  if v_inv.id is not null then
    insert into public.profiles (id, email, full_name, role, status, department_id, job_title)
    values (
      new.id, lower(new.email),
      coalesce(nullif(trim(coalesce(v_inv.full_name, '')), ''), v_name, split_part(new.email, '@', 1)),
      v_inv.role, 'active', v_inv.department_id, v_inv.job_title
    );
    update public.invitations set accepted_at = now() where id = v_inv.id;
  else
    insert into public.profiles (id, email, full_name, role, status)
    values (new.id, lower(new.email), coalesce(v_name, split_part(new.email, '@', 1)), 'employee', 'pending');

    for v_admin in select id from public.profiles where role = 'admin' and status = 'active' loop
      insert into public.notifications (user_id, kind, title, body)
      values (v_admin.id, 'member_pending', 'طلب انضمام جديد',
              coalesce(v_name, lower(new.email)) || ' ينتظر الموافقة على حسابه');
    end loop;
  end if;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.profiles_before_update() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_role public.app_role;
  v_dept uuid;
begin
  new.updated_at := now();
  new.id := old.id;
  new.email := old.email;
  new.created_at := old.created_at;
  if v_uid is null then
    return new;
  end if;

  select role, department_id into v_role, v_dept
  from public.profiles where id = v_uid and status = 'active';

  if v_role = 'admin' then
    if (new.role <> 'admin' or new.status <> 'active') and old.role = 'admin' and old.status = 'active'
       and not exists (
         select 1 from public.profiles
         where role = 'admin' and status = 'active' and id <> old.id
       ) then
      raise exception 'لا يمكن إزالة صلاحية آخر مدير نظام' using errcode = '42501';
    end if;
    if old.status = 'pending' and new.status = 'active' then
      insert into public.notifications (user_id, kind, title, body, actor_id)
      values (old.id, 'member_approved', 'تم تفعيل حسابك', 'مرحبًا بك في مساحة العمل', v_uid);
    end if;
    return new;
  end if;

  if old.id = v_uid then
    if new.role is distinct from old.role or new.status is distinct from old.status
       or new.department_id is distinct from old.department_id then
      raise exception 'لا يمكنك تغيير الدور أو القسم أو حالة الحساب' using errcode = '42501';
    end if;
    return new;
  end if;

  if v_role = 'manager' and v_dept is not null and old.department_id = v_dept then
    if new.role is distinct from old.role or new.status is distinct from old.status
       or new.department_id is distinct from old.department_id then
      raise exception 'تغيير الدور أو القسم أو الحالة من صلاحيات مدير النظام' using errcode = '42501';
    end if;
    return new;
  end if;

  raise exception 'غير مصرح لك بتعديل هذا الحساب' using errcode = '42501';
end $$;

create trigger profiles_guard
  before update on public.profiles
  for each row execute function public.profiles_before_update();

create or replace function public.touch_updated_at() returns trigger
language plpgsql set search_path = ''
as $$ begin new.updated_at := now(); return new; end $$;

create trigger projects_touch before update on public.projects
  for each row execute function public.touch_updated_at();
create trigger settings_touch before update on public.company_settings
  for each row execute function public.touch_updated_at();

create or replace function public.projects_before_write() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_role public.app_role := public.my_role();
  v_dept uuid := public.my_department();
begin
  if auth.uid() is null then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.created_by := auth.uid();
    if v_role = 'manager' then
      new.department_id := coalesce(new.department_id, v_dept);
    end if;
  else
    new.created_by := old.created_by;
  end if;
  if v_role = 'manager' and new.department_id is distinct from v_dept then
    raise exception 'يمكنك إدارة مشاريع قسمك فقط' using errcode = '42501';
  end if;
  return new;
end $$;

create trigger projects_guard before insert or update on public.projects
  for each row execute function public.projects_before_write();

create or replace function public.tasks_before_write() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_role public.app_role;
  v_dept uuid;
  v_manage boolean;
  v_self_owned boolean;
begin
  if v_uid is not null then
    select role, department_id into v_role, v_dept
    from public.profiles where id = v_uid and status = 'active';
  end if;

  if tg_op = 'INSERT' then
    if v_uid is not null then
      new.created_by := v_uid;
      if new.department_id is null and new.project_id is not null then
        select department_id into new.department_id from public.projects where id = new.project_id;
      end if;
      if new.department_id is null then
        new.department_id := v_dept;
      end if;
      if v_role is distinct from 'admin' and new.department_id is distinct from v_dept then
        raise exception 'لا يمكنك إنشاء مهام خارج قسمك' using errcode = '42501';
      end if;
      if v_role = 'employee' then
        new.status := case when new.status = 'done' and new.reviewer_id is not null then 'todo' else new.status end;
      end if;
    end if;
    if new.status = 'review' then new.submitted_at := now(); end if;
    if new.status = 'done' then new.completed_at := now(); end if;
    new.created_at := now();
    new.updated_at := now();
    return new;
  end if;

  new.created_by := old.created_by;
  new.created_at := old.created_at;

  if v_uid is not null and v_role is distinct from 'admin' then
    v_manage := public.can_manage_task(old.id);
    v_self_owned := old.created_by = v_uid and old.reviewer_id is null;

    if v_manage and v_role in ('manager', 'supervisor')
       and new.department_id is distinct from old.department_id
       and new.department_id is distinct from v_dept then
      raise exception 'لا يمكنك نقل المهمة إلى قسم آخر' using errcode = '42501';
    end if;

    if not v_manage then
      if old.created_by is distinct from v_uid then
        if row(new.title, new.description, new.project_id, new.department_id, new.priority,
               new.start_date, new.due_date, new.estimate_minutes, new.reviewer_id)
           is distinct from
           row(old.title, old.description, old.project_id, old.department_id, old.priority,
               old.start_date, old.due_date, old.estimate_minutes, old.reviewer_id) then
          raise exception 'يمكنك تغيير حالة المهمة فقط' using errcode = '42501';
        end if;
      elsif new.department_id is distinct from old.department_id then
        raise exception 'لا يمكنك نقل المهمة إلى قسم آخر' using errcode = '42501';
      end if;

      if new.status is distinct from old.status then
        if new.status = 'done' and not v_self_owned then
          raise exception 'المهمة تحتاج اعتماد المراجع قبل إغلاقها — أرسلها للمراجعة' using errcode = '42501';
        end if;
        if old.status = 'done' and not v_self_owned then
          raise exception 'لا يمكن إعادة فتح مهمة معتمدة' using errcode = '42501';
        end if;
      end if;
      new.review_note := old.review_note;
    end if;
  end if;

  if new.status is distinct from old.status then
    if new.status = 'review' then
      new.submitted_at := now();
    end if;
    if new.status = 'done' then
      new.completed_at := now();
    else
      new.completed_at := null;
    end if;
  else
    new.completed_at := old.completed_at;
    new.submitted_at := old.submitted_at;
  end if;
  new.updated_at := now();
  return new;
end $$;

create trigger tasks_guard before insert or update on public.tasks
  for each row execute function public.tasks_before_write();

create or replace function public.tasks_after_write() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  r record;
begin
  if tg_op = 'INSERT' then
    insert into public.activities (actor_id, task_id, project_id, action, details)
    values (v_uid, new.id, new.project_id, 'task_created', jsonb_build_object('title', new.title));
    return null;
  end if;

  if new.status is distinct from old.status then
    insert into public.activities (actor_id, task_id, project_id, action, details)
    values (v_uid, new.id, new.project_id, 'status_changed',
            jsonb_build_object('from', old.status, 'to', new.status, 'note', new.review_note));

    if new.status = 'review' then
      for r in
        select distinct s.uid from (
          select new.reviewer_id as uid where new.reviewer_id is not null
          union all
          select p.id from public.profiles p
          where new.reviewer_id is null and p.status = 'active'
            and p.role in ('manager', 'supervisor') and p.department_id = new.department_id
          union all
          select new.created_by where new.reviewer_id is null
        ) s
        where s.uid is not null
      loop
        perform public.notify_user(r.uid, 'review_requested', 'مهمة بانتظار مراجعتك', new.title, new.id);
      end loop;
    elsif old.status = 'review' and new.status = 'done' then
      for r in select user_id from public.task_assignees where task_id = new.id loop
        perform public.notify_user(r.user_id, 'task_approved', 'تم اعتماد مهمتك', new.title, new.id);
      end loop;
    elsif old.status = 'review' and new.status in ('todo', 'in_progress', 'blocked') then
      for r in select user_id from public.task_assignees where task_id = new.id loop
        perform public.notify_user(r.user_id, 'task_returned', 'أُعيدت مهمة إليك للتعديل',
                                   coalesce(nullif(new.review_note, ''), new.title), new.id);
      end loop;
    end if;
  end if;

  if new.due_date is distinct from old.due_date then
    insert into public.activities (actor_id, task_id, project_id, action, details)
    values (v_uid, new.id, new.project_id, 'due_changed',
            jsonb_build_object('from', old.due_date, 'to', new.due_date));
  end if;
  if new.priority is distinct from old.priority then
    insert into public.activities (actor_id, task_id, project_id, action, details)
    values (v_uid, new.id, new.project_id, 'priority_changed',
            jsonb_build_object('from', old.priority, 'to', new.priority));
  end if;
  return null;
end $$;

create trigger tasks_events after insert or update on public.tasks
  for each row execute function public.tasks_after_write();

create or replace function public.assignees_after_change() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_title text;
  v_project uuid;
begin
  if tg_op = 'INSERT' then
    select title, project_id into v_title, v_project from public.tasks where id = new.task_id;
    insert into public.activities (actor_id, task_id, project_id, action, details)
    values (auth.uid(), new.task_id, v_project, 'assigned', jsonb_build_object('user_id', new.user_id));
    perform public.notify_user(new.user_id, 'task_assigned', 'تم إسناد مهمة إليك', v_title, new.task_id);
    return null;
  end if;
  select title, project_id into v_title, v_project from public.tasks where id = old.task_id;
  if v_title is not null then
    insert into public.activities (actor_id, task_id, project_id, action, details)
    values (auth.uid(), old.task_id, v_project, 'unassigned', jsonb_build_object('user_id', old.user_id));
  end if;
  return null;
end $$;

create trigger assignees_events after insert or delete on public.task_assignees
  for each row execute function public.assignees_after_change();

create or replace function public.assignees_before_insert() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is not null then
    new.assigned_by := auth.uid();
  end if;
  new.assigned_at := now();
  if not exists (select 1 from public.profiles where id = new.user_id and status = 'active') then
    raise exception 'لا يمكن إسناد مهمة لحساب غير مفعّل' using errcode = '23514';
  end if;
  return new;
end $$;

create trigger assignees_guard before insert on public.task_assignees
  for each row execute function public.assignees_before_insert();

create or replace function public.comments_after_insert() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_task public.tasks;
  r record;
begin
  select * into v_task from public.tasks where id = new.task_id;
  insert into public.activities (actor_id, task_id, project_id, action, details)
  values (new.author_id, new.task_id, v_task.project_id, 'commented',
          jsonb_build_object('excerpt', left(new.body, 140)));
  for r in
    select distinct s.uid from (
      select user_id as uid from public.task_assignees where task_id = new.task_id
      union all select v_task.created_by
      union all select v_task.reviewer_id
    ) s where s.uid is not null
  loop
    perform public.notify_user(r.uid, 'comment_added', 'تعليق جديد على: ' || v_task.title, left(new.body, 200), new.task_id);
  end loop;
  return null;
end $$;

create trigger comments_events after insert on public.comments
  for each row execute function public.comments_after_insert();

create or replace function public.content_before_insert() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is not null then
    if tg_table_name = 'comments' then
      new.author_id := auth.uid();
    elsif tg_table_name = 'attachments' then
      new.uploader_id := auth.uid();
    end if;
  end if;
  new.created_at := now();
  return new;
end $$;

create trigger comments_guard before insert on public.comments
  for each row execute function public.content_before_insert();
create trigger attachments_guard before insert on public.attachments
  for each row execute function public.content_before_insert();

create or replace function public.attachments_after_insert() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.activities (actor_id, task_id, project_id, action, details)
  select new.uploader_id, new.task_id, t.project_id, 'file_attached', jsonb_build_object('file_name', new.file_name)
  from public.tasks t where t.id = new.task_id;
  return null;
end $$;

create trigger attachments_events after insert on public.attachments
  for each row execute function public.attachments_after_insert();

create or replace function public.start_timer(p_task uuid) returns public.time_sessions
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_role public.app_role := public.my_role();
  v_row public.time_sessions;
  v_status public.task_status;
begin
  if v_uid is null or v_role is null then
    raise exception 'سجّل الدخول بحساب مفعّل أولًا' using errcode = '42501';
  end if;
  if v_role = 'viewer' then
    raise exception 'حساب المشاهدة لا يسجّل وقت عمل' using errcode = '42501';
  end if;
  if not (public.is_task_assignee(p_task) or public.can_manage_task(p_task)
          or exists (select 1 from public.tasks where id = p_task and created_by = v_uid)) then
    raise exception 'يمكنك تسجيل الوقت على المهام المسندة إليك فقط' using errcode = '42501';
  end if;
  select status into v_status from public.tasks where id = p_task;
  if v_status = 'done' then
    raise exception 'لا يمكن تسجيل وقت على مهمة معتمدة' using errcode = '23514';
  end if;

  perform pg_advisory_xact_lock(hashtext('madar_timer_' || v_uid::text));
  update public.time_sessions set ended_at = now()
  where user_id = v_uid and ended_at is null;

  insert into public.time_sessions (task_id, user_id, started_at)
  values (p_task, v_uid, now())
  returning * into v_row;

  if v_status = 'todo' then
    update public.tasks set status = 'in_progress' where id = p_task;
  end if;
  return v_row;
end $$;

create or replace function public.stop_timer(p_note text default null) returns public.time_sessions
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.time_sessions;
begin
  if v_uid is null then
    raise exception 'سجّل الدخول أولًا' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(hashtext('madar_timer_' || v_uid::text));
  update public.time_sessions
  set ended_at = now(), note = coalesce(nullif(trim(p_note), ''), note)
  where user_id = v_uid and ended_at is null
  returning * into v_row;
  return v_row;
end $$;

create or replace function public.add_time_entry(
  p_task uuid, p_started timestamptz, p_ended timestamptz, p_note text default null
) returns public.time_sessions
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_role public.app_role := public.my_role();
  v_row public.time_sessions;
begin
  if v_uid is null or v_role is null or v_role = 'viewer' then
    raise exception 'غير مصرح بتسجيل وقت' using errcode = '42501';
  end if;
  if not (public.is_task_assignee(p_task) or public.can_manage_task(p_task)
          or exists (select 1 from public.tasks where id = p_task and created_by = v_uid)) then
    raise exception 'يمكنك تسجيل الوقت على المهام المسندة إليك فقط' using errcode = '42501';
  end if;
  if p_ended <= p_started then
    raise exception 'وقت الانتهاء يجب أن يكون بعد وقت البدء' using errcode = '23514';
  end if;
  if p_ended > now() + interval '5 minutes' then
    raise exception 'لا يمكن تسجيل وقت في المستقبل' using errcode = '23514';
  end if;
  if p_ended - p_started > interval '16 hours' then
    raise exception 'الجلسة الواحدة لا تتجاوز 16 ساعة' using errcode = '23514';
  end if;
  insert into public.time_sessions (task_id, user_id, started_at, ended_at, note, is_manual)
  values (p_task, v_uid, p_started, p_ended, nullif(trim(p_note), ''), true)
  returning * into v_row;
  return v_row;
end $$;

create or replace function public.mark_all_notifications_read() returns void
language sql security definer set search_path = ''
as $$ update public.notifications set read_at = now() where user_id = auth.uid() and read_at is null $$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.profiles_before_update() from public, anon, authenticated;
revoke execute on function public.projects_before_write() from public, anon, authenticated;
revoke execute on function public.tasks_before_write() from public, anon, authenticated;
revoke execute on function public.tasks_after_write() from public, anon, authenticated;
revoke execute on function public.assignees_after_change() from public, anon, authenticated;
revoke execute on function public.assignees_before_insert() from public, anon, authenticated;
revoke execute on function public.comments_after_insert() from public, anon, authenticated;
revoke execute on function public.content_before_insert() from public, anon, authenticated;
revoke execute on function public.attachments_after_insert() from public, anon, authenticated;
revoke execute on function public.notify_user(uuid, text, text, text, uuid) from public, anon, authenticated;
revoke execute on function public.start_timer(uuid) from public, anon;
revoke execute on function public.stop_timer(text) from public, anon;
revoke execute on function public.add_time_entry(uuid, timestamptz, timestamptz, text) from public, anon;
revoke execute on function public.mark_all_notifications_read() from public, anon;
grant execute on function public.start_timer(uuid) to authenticated;
grant execute on function public.stop_timer(text) to authenticated;
grant execute on function public.add_time_entry(uuid, timestamptz, timestamptz, text) to authenticated;
grant execute on function public.mark_all_notifications_read() to authenticated;
grant execute on function public.workspace_status() to anon, authenticated;
