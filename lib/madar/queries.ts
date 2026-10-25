import { useMutation, useQuery, useQueryClient, type QueryKey } from "@tanstack/react-query";
import { useMemo } from "react";
import { callAccounts, supabase } from "@/lib/supabase";
import { useSession } from "./session";
import type {
  Activity,
  Attachment,
  Comment,
  CompanySettings,
  Department,
  Invitation,
  NotificationItem,
  Profile,
  Project,
  Role,
  Subtask,
  Task,
  TaskInput,
  TaskStatus,
  TaskTimeTotal,
  TimeSession,
} from "./types";

async function run<T>(promise: PromiseLike<{ data: T | null; error: unknown }>): Promise<T> {
  const { data, error } = await promise;
  if (error) throw error;
  return data as T;
}

// ---------------------------------------------------------------- reads

export function useProfiles() {
  return useQuery({
    queryKey: ["profiles"],
    queryFn: () =>
      run<Profile[]>(supabase.from("profiles").select("*").order("full_name", { ascending: true }).limit(2000)),
    staleTime: 60_000,
  });
}

export function useDepartments() {
  return useQuery({
    queryKey: ["departments"],
    queryFn: () =>
      run<Department[]>(supabase.from("departments").select("*").order("name", { ascending: true }).limit(500)),
    staleTime: 60_000,
  });
}

export function useProjects() {
  return useQuery({
    queryKey: ["projects"],
    queryFn: () =>
      run<Project[]>(supabase.from("projects").select("*").order("created_at", { ascending: false }).limit(1000)),
    staleTime: 30_000,
  });
}

export function useTasks() {
  return useQuery({
    queryKey: ["tasks"],
    queryFn: () =>
      run<Task[]>(
        supabase
          .from("tasks")
          .select("*, task_assignees(user_id)")
          .order("created_at", { ascending: false })
          .limit(3000),
      ),
    staleTime: 15_000,
    refetchInterval: 60_000,
  });
}

export function useTask(id: string | undefined) {
  return useQuery({
    queryKey: ["task", id],
    enabled: !!id,
    queryFn: () =>
      run<Task | null>(supabase.from("tasks").select("*, task_assignees(user_id)").eq("id", id!).maybeSingle()),
  });
}

export function useTimeTotals() {
  return useQuery({
    queryKey: ["time-totals"],
    queryFn: () => run<TaskTimeTotal[]>(supabase.from("task_time_totals").select("*").limit(5000)),
    staleTime: 30_000,
  });
}

export function useSubtasks(taskId: string | undefined) {
  return useQuery({
    queryKey: ["subtasks", taskId],
    enabled: !!taskId,
    queryFn: () =>
      run<Subtask[]>(
        supabase
          .from("subtasks")
          .select("*")
          .eq("task_id", taskId!)
          .order("position", { ascending: true })
          .order("created_at", { ascending: true })
          .limit(500),
      ),
  });
}

export function useComments(taskId: string | undefined) {
  return useQuery({
    queryKey: ["comments", taskId],
    enabled: !!taskId,
    queryFn: () =>
      run<Comment[]>(
        supabase.from("comments").select("*").eq("task_id", taskId!).order("created_at", { ascending: true }).limit(500),
      ),
    refetchInterval: 30_000,
  });
}

export function useAttachments(taskId: string | undefined) {
  return useQuery({
    queryKey: ["attachments", taskId],
    enabled: !!taskId,
    queryFn: () =>
      run<Attachment[]>(
        supabase
          .from("attachments")
          .select("*")
          .eq("task_id", taskId!)
          .order("created_at", { ascending: false })
          .limit(200),
      ),
  });
}

export function useTaskSessions(taskId: string | undefined) {
  return useQuery({
    queryKey: ["task-sessions", taskId],
    enabled: !!taskId,
    queryFn: () =>
      run<TimeSession[]>(
        supabase
          .from("time_sessions")
          .select("*")
          .eq("task_id", taskId!)
          .order("started_at", { ascending: false })
          .limit(500),
      ),
  });
}

export function useTaskActivity(taskId: string | undefined) {
  return useQuery({
    queryKey: ["task-activity", taskId],
    enabled: !!taskId,
    queryFn: () =>
      run<Activity[]>(
        supabase
          .from("activities")
          .select("*")
          .eq("task_id", taskId!)
          .order("created_at", { ascending: false })
          .limit(100),
      ),
  });
}

export function useRecentActivity(limit = 12) {
  return useQuery({
    queryKey: ["activity", limit],
    queryFn: () =>
      run<Activity[]>(supabase.from("activities").select("*").order("created_at", { ascending: false }).limit(limit)),
    refetchInterval: 60_000,
  });
}

export function useOpenSession() {
  const { userId } = useSession();
  return useQuery({
    queryKey: ["open-session", userId],
    enabled: !!userId,
    queryFn: () =>
      run<TimeSession | null>(
        supabase
          .from("time_sessions")
          .select("*")
          .eq("user_id", userId!)
          .is("ended_at", null)
          .limit(1)
          .maybeSingle(),
      ),
    refetchInterval: 60_000,
  });
}

export function useSessionsBetween(fromUtc: string, toUtc: string, enabled = true) {
  return useQuery({
    queryKey: ["sessions", fromUtc, toUtc],
    enabled,
    queryFn: () =>
      run<TimeSession[]>(
        supabase
          .from("time_sessions")
          .select("*")
          .gte("started_at", fromUtc)
          .lt("started_at", toUtc)
          .order("started_at", { ascending: true })
          .limit(10000),
      ),
  });
}

export function useNotifications() {
  const { userId } = useSession();
  return useQuery({
    queryKey: ["notifications", userId],
    enabled: !!userId,
    queryFn: () =>
      run<NotificationItem[]>(
        supabase
          .from("notifications")
          .select("*")
          .eq("user_id", userId!)
          .order("created_at", { ascending: false })
          .limit(150),
      ),
    refetchInterval: 30_000,
  });
}

export function useInvitations(enabled: boolean) {
  return useQuery({
    queryKey: ["invitations"],
    enabled,
    queryFn: () =>
      run<Invitation[]>(supabase.from("invitations").select("*").order("created_at", { ascending: false }).limit(500)),
  });
}

/** Id → record maps used across screens. */
export function useLookups() {
  const profiles = useProfiles();
  const departments = useDepartments();
  const projects = useProjects();
  return useMemo(() => {
    const profileMap = new Map((profiles.data ?? []).map((p) => [p.id, p]));
    const departmentMap = new Map((departments.data ?? []).map((d) => [d.id, d]));
    const projectMap = new Map((projects.data ?? []).map((p) => [p.id, p]));
    return {
      profiles: profiles.data ?? [],
      departments: departments.data ?? [],
      projects: projects.data ?? [],
      profileMap,
      departmentMap,
      projectMap,
      loading: profiles.isLoading || departments.isLoading || projects.isLoading,
    };
  }, [profiles.data, departments.data, projects.data, profiles.isLoading, departments.isLoading, projects.isLoading]);
}

// ---------------------------------------------------------------- writes

function useAction<TVars, TResult = unknown>(fn: (vars: TVars) => Promise<TResult>, invalidate: QueryKey[]) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSettled: () => {
      invalidate.forEach((key) => qc.invalidateQueries({ queryKey: key }));
    },
  });
}

const TASK_KEYS: QueryKey[] = [["tasks"], ["task"], ["activity"], ["task-activity"], ["notifications"]];

export function useSaveTask() {
  return useAction(
    async (vars: { id?: string; input: Partial<TaskInput>; assignees?: string[]; previousAssignees?: string[] }) => {
      let taskId = vars.id;
      if (taskId) {
        if (Object.keys(vars.input).length > 0) {
          await run(supabase.from("tasks").update(vars.input).eq("id", taskId).select("id").single());
        }
      } else {
        const created = await run<{ id: string }>(supabase.from("tasks").insert(vars.input).select("id").single());
        taskId = created.id;
      }
      if (vars.assignees) {
        const before = new Set(vars.previousAssignees ?? []);
        const after = new Set(vars.assignees);
        const toAdd = [...after].filter((u) => !before.has(u));
        const toRemove = [...before].filter((u) => !after.has(u));
        if (toRemove.length) {
          await run(supabase.from("task_assignees").delete().eq("task_id", taskId!).in("user_id", toRemove));
        }
        if (toAdd.length) {
          await run(supabase.from("task_assignees").insert([...new Set(toAdd)].map((user_id) => ({ task_id: taskId!, user_id }))));
        }
      }
      return taskId!;
    },
    TASK_KEYS,
  );
}

export function useSetTaskStatus() {
  return useAction(
    async (vars: { id: string; status: TaskStatus; review_note?: string | null }) => {
      const patch: Record<string, unknown> = { status: vars.status };
      if (vars.review_note !== undefined) patch.review_note = vars.review_note;
      await run(supabase.from("tasks").update(patch).eq("id", vars.id).select("id").single());
    },
    TASK_KEYS,
  );
}

export function useDeleteTask() {
  return useAction(async (id: string) => {
    await run(supabase.from("tasks").delete().eq("id", id));
  }, [["tasks"], ["activity"], ["time-totals"]]);
}

export function useImportTasks() {
  return useAction(
    async (rows: { input: Partial<TaskInput>; assignees: string[] }[]) => {
      let created = 0;
      for (const row of rows) {
        const task = await run<{ id: string }>(supabase.from("tasks").insert(row.input).select("id").single());
        const unique = [...new Set(row.assignees)];
        if (unique.length) {
          await run(supabase.from("task_assignees").insert(unique.map((user_id) => ({ task_id: task.id, user_id }))));
        }
        created += 1;
      }
      return created;
    },
    TASK_KEYS,
  );
}

const TIME_KEYS: QueryKey[] = [["open-session"], ["time-totals"], ["task-sessions"], ["sessions"], ["tasks"], ["task"]];

export function useStartTimer() {
  return useAction(async (taskId: string) => {
    await run(supabase.rpc("start_timer", { p_task: taskId }));
  }, TIME_KEYS);
}

export function useStopTimer() {
  return useAction(async (note: string | null) => {
    await run(supabase.rpc("stop_timer", { p_note: note }));
  }, TIME_KEYS);
}

export function useAddTimeEntry() {
  return useAction(
    async (vars: { taskId: string; started: string; ended: string; note: string | null }) => {
      await run(
        supabase.rpc("add_time_entry", {
          p_task: vars.taskId,
          p_started: vars.started,
          p_ended: vars.ended,
          p_note: vars.note,
        }),
      );
    },
    TIME_KEYS,
  );
}

export function useDeleteTimeSession() {
  return useAction(async (id: string) => {
    await run(supabase.from("time_sessions").delete().eq("id", id));
  }, TIME_KEYS);
}

export function useSubtaskActions(taskId: string) {
  const keys: QueryKey[] = [["subtasks", taskId]];
  const add = useAction(async (title: string) => {
    await run(supabase.from("subtasks").insert({ task_id: taskId, title, position: Date.now() % 2147483647 }));
  }, keys);
  const toggle = useAction(async (vars: { id: string; done: boolean }) => {
    await run(supabase.from("subtasks").update({ done: vars.done }).eq("id", vars.id));
  }, keys);
  const remove = useAction(async (id: string) => {
    await run(supabase.from("subtasks").delete().eq("id", id));
  }, keys);
  return { add, toggle, remove };
}

export function useCommentActions(taskId: string) {
  const keys: QueryKey[] = [["comments", taskId], ["task-activity", taskId], ["activity"]];
  const add = useAction(async (body: string) => {
    await run(supabase.from("comments").insert({ task_id: taskId, body }));
  }, keys);
  const remove = useAction(async (id: string) => {
    await run(supabase.from("comments").delete().eq("id", id));
  }, keys);
  return { add, remove };
}

export type UploadableFile = { name: string; size: number | null; type: string | null; body: Blob | ArrayBuffer };

export function useAttachmentActions(taskId: string) {
  const keys: QueryKey[] = [["attachments", taskId], ["task-activity", taskId], ["activity"]];
  const upload = useAction(async (file: UploadableFile) => {
    const ext = (file.name.split(".").pop() ?? "").replace(/[^a-zA-Z0-9]/g, "").slice(0, 10);
    const key = `${taskId}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}${ext ? `.${ext}` : ""}`;
    const { error } = await supabase.storage
      .from("attachments")
      .upload(key, file.body, { contentType: file.type ?? "application/octet-stream", upsert: false });
    if (error) throw error;
    const { error: rowError } = await supabase.from("attachments").insert({
      task_id: taskId,
      file_name: file.name.slice(0, 200),
      storage_path: key,
      size_bytes: file.size,
      mime_type: file.type,
    });
    if (rowError) {
      await supabase.storage.from("attachments").remove([key]);
      throw rowError;
    }
  }, keys);
  const remove = useAction(async (att: Attachment) => {
    await run(supabase.from("attachments").delete().eq("id", att.id));
    await supabase.storage.from("attachments").remove([att.storage_path]);
  }, keys);
  return { upload, remove };
}

export async function attachmentUrl(att: Attachment) {
  const { data, error } = await supabase.storage
    .from("attachments")
    .createSignedUrl(att.storage_path, 300, { download: att.file_name });
  if (error) throw error;
  return data.signedUrl;
}

export function useSaveProject() {
  return useAction(
    async (vars: { id?: string; input: Partial<Project> }) => {
      if (vars.id) {
        await run(supabase.from("projects").update(vars.input).eq("id", vars.id).select("id").single());
        return vars.id;
      }
      const created = await run<{ id: string }>(supabase.from("projects").insert(vars.input).select("id").single());
      return created.id;
    },
    [["projects"]],
  );
}

export function useDeleteProject() {
  return useAction(async (id: string) => {
    await run(supabase.from("projects").delete().eq("id", id));
  }, [["projects"], ["tasks"]]);
}

export function useSaveDepartment() {
  return useAction(
    async (vars: { id?: string; input: Partial<Department> }) => {
      if (vars.id) {
        await run(supabase.from("departments").update(vars.input).eq("id", vars.id));
      } else {
        await run(supabase.from("departments").insert(vars.input));
      }
    },
    [["departments"]],
  );
}

export function useDeleteDepartment() {
  return useAction(async (id: string) => {
    await run(supabase.from("departments").delete().eq("id", id));
  }, [["departments"], ["profiles"], ["tasks"], ["projects"]]);
}

export function useUpdateProfile() {
  return useAction(
    async (vars: { id: string; patch: Partial<Profile> }) => {
      await run(supabase.from("profiles").update(vars.patch).eq("id", vars.id).select("id").single());
    },
    [["profiles"], ["me"]],
  );
}

export function useCreateMember() {
  return useAction(
    async (vars: {
      email: string;
      password: string;
      full_name: string;
      role: Role;
      department_id: string | null;
      job_title: string | null;
    }) => callAccounts({ action: "create_member", ...vars }),
    [["profiles"], ["invitations"]],
  );
}

export function useResetPassword() {
  return useAction(
    async (vars: { user_id: string; password: string }) => callAccounts({ action: "reset_password", ...vars }),
    [],
  );
}

export function useInvitationActions() {
  const keys: QueryKey[] = [["invitations"]];
  const add = useAction(async (input: Partial<Invitation>) => {
    await run(supabase.from("invitations").insert(input));
  }, keys);
  const remove = useAction(async (id: string) => {
    await run(supabase.from("invitations").delete().eq("id", id));
  }, keys);
  return { add, remove };
}

export function useSaveSettings() {
  return useAction(async (patch: Partial<CompanySettings>) => {
    await run(supabase.from("company_settings").update(patch).eq("id", 1).select("id").single());
  }, [["settings"]]);
}

export function useNotificationActions() {
  const keys: QueryKey[] = [["notifications"]];
  const markRead = useAction(async (id: string) => {
    await run(supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", id));
  }, keys);
  const markAll = useAction(async () => {
    await run(supabase.rpc("mark_all_notifications_read"));
  }, keys);
  const clearRead = useAction(async (userId: string) => {
    await run(supabase.from("notifications").delete().eq("user_id", userId).not("read_at", "is", null));
  }, keys);
  return { markRead, markAll, clearRead };
}
