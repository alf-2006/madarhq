-- Tighten EXECUTE grants on SECURITY DEFINER functions.
-- Postgres grants EXECUTE to PUBLIC by default; anonymous visitors only need workspace_status()
-- (used by the login screen before sign-in). Everything else is for signed-in members, and each
-- function re-checks the caller's active profile internally.

revoke execute on function public.is_admin() from public, anon;
revoke execute on function public.is_active_member() from public, anon;
revoke execute on function public.my_role() from public, anon;
revoke execute on function public.my_department() from public, anon;
revoke execute on function public.can_view_task(uuid) from public, anon;
revoke execute on function public.can_manage_task(uuid) from public, anon;
revoke execute on function public.can_work_on_task(uuid) from public, anon;
revoke execute on function public.is_task_assignee(uuid) from public, anon;
revoke execute on function public.start_timer(uuid) from public, anon;
revoke execute on function public.stop_timer(text) from public, anon;
revoke execute on function public.add_time_entry(uuid, timestamptz, timestamptz, text) from public, anon;
revoke execute on function public.mark_all_notifications_read() from public, anon;

grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_active_member() to authenticated;
grant execute on function public.my_role() to authenticated;
grant execute on function public.my_department() to authenticated;
grant execute on function public.can_view_task(uuid) to authenticated;
grant execute on function public.can_manage_task(uuid) to authenticated;
grant execute on function public.can_work_on_task(uuid) to authenticated;
grant execute on function public.is_task_assignee(uuid) to authenticated;
grant execute on function public.start_timer(uuid) to authenticated;
grant execute on function public.stop_timer(text) to authenticated;
grant execute on function public.add_time_entry(uuid, timestamptz, timestamptz, text) to authenticated;
grant execute on function public.mark_all_notifications_read() to authenticated;

-- The login screen must be able to tell whether the workspace has been set up.
grant execute on function public.workspace_status() to anon, authenticated;
