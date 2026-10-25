import type { Session } from "@supabase/supabase-js";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { setCompanyTimezone } from "./format";
import type { CompanySettings, Profile } from "./types";

type SessionValue = {
  ready: boolean;
  session: Session | null;
  userId: string | null;
  profile: Profile | null;
  profileLoading: boolean;
  settings: CompanySettings | null;
  refreshProfile: () => Promise<unknown>;
  signOut: () => Promise<void>;
};

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, next) => {
      setSession(next);
      setReady(true);
      if (event === "SIGNED_OUT") queryClient.clear();
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [queryClient]);

  const userId = session?.user.id ?? null;

  const profileQuery = useQuery({
    queryKey: ["me", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*").eq("id", userId!).maybeSingle();
      if (error) throw error;
      return (data as Profile | null) ?? null;
    },
    refetchInterval: (q) => (q.state.data?.status === "pending" ? 15000 : false),
  });

  const profile = profileQuery.data ?? null;

  const settingsQuery = useQuery({
    queryKey: ["settings"],
    enabled: profile?.status === "active",
    queryFn: async () => {
      const { data, error } = await supabase.from("company_settings").select("*").eq("id", 1).maybeSingle();
      if (error) throw error;
      return data as CompanySettings | null;
    },
  });

  const settings = settingsQuery.data ?? null;
  // Keep formatters in sync with the company timezone before children render.
  if (settings?.timezone) setCompanyTimezone(settings.timezone);

  const value = useMemo<SessionValue>(
    () => ({
      ready,
      session,
      userId,
      profile,
      profileLoading: !!userId && profileQuery.isLoading,
      settings,
      refreshProfile: () => profileQuery.refetch(),
      signOut: async () => {
        await supabase.auth.signOut();
        queryClient.clear();
      },
    }),
    [ready, session, userId, profile, profileQuery, settings, queryClient],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used inside SessionProvider");
  return ctx;
}

/** The signed-in active member. Only call inside the authenticated area. */
export function useMe(): Profile {
  const { profile } = useSession();
  return profile as Profile;
}
