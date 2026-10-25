import { usePathname, useRouter } from "expo-router";
import { Platform, Pressable, RefreshControl, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { fmtClock } from "@/lib/madar/format";
import { ROLE_LABELS } from "@/lib/madar/labels";
import { useNotifications, useOpenSession, useStopTimer, useTask } from "@/lib/madar/queries";
import { useSession } from "@/lib/madar/session";
import { errorMessage } from "@/lib/supabase";
import { LogoMark, Wordmark } from "./logo";
import { Avatar, C, Icon, IconButton, T, useIsWide, useNow, useToast, type IconName } from "./ui";

type NavItem = { href: string; label: string; icon: IconName };

const NAV: NavItem[] = [
  { href: "/dashboard", label: "الرئيسية", icon: "home" },
  { href: "/tasks", label: "المهام", icon: "check-square" },
  { href: "/projects", label: "المشاريع", icon: "folder" },
  { href: "/team", label: "الفريق", icon: "users" },
  { href: "/departments", label: "الأقسام", icon: "layers" },
  { href: "/reports", label: "التقارير", icon: "bar-chart-2" },
  { href: "/notifications", label: "الإشعارات", icon: "bell" },
  { href: "/settings", label: "الإعدادات", icon: "settings" },
];

const DOCK: NavItem[] = [
  { href: "/dashboard", label: "الرئيسية", icon: "home" },
  { href: "/tasks", label: "المهام", icon: "check-square" },
  { href: "/projects", label: "المشاريع", icon: "folder" },
  { href: "/team", label: "الفريق", icon: "users" },
  { href: "/more", label: "المزيد", icon: "grid" },
];

const MORE_PATHS = ["/more", "/departments", "/reports", "/notifications", "/settings"];

function isActive(pathname: string, href: string) {
  if (href === "/more") return MORE_PATHS.some((p) => pathname.startsWith(p));
  return pathname === href || pathname.startsWith(href + "/");
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const wide = useIsWide();
  return wide ? <DesktopShell>{children}</DesktopShell> : <MobileShell>{children}</MobileShell>;
}

function useUnread() {
  const notifications = useNotifications();
  return (notifications.data ?? []).filter((n) => !n.read_at).length;
}

function DesktopShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { profile, settings, signOut } = useSession();
  const unread = useUnread();
  return (
    <View style={{ flex: 1, flexDirection: "row", backgroundColor: C.background }}>
      <View
        style={{
          width: 252,
          backgroundColor: C.surface,
          borderLeftWidth: 1,
          borderLeftColor: C.border,
          paddingHorizontal: 14,
          paddingTop: 22,
          paddingBottom: 16,
        }}
      >
        <View style={{ paddingHorizontal: 8, gap: 2 }}>
          <Wordmark size={22} />
          <T className="text-[12px] text-muted" numberOfLines={1}>
            {settings?.company_name ?? ""}
          </T>
        </View>
        <View style={{ marginTop: 18 }}>
          <TimerChip />
        </View>
        <View style={{ marginTop: 14, gap: 2, flex: 1 }}>
          {NAV.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Pressable
                key={item.href}
                onPress={() => router.push(item.href as any)}
                style={({ pressed }) => ({
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 12,
                  height: 42,
                  paddingHorizontal: 12,
                  borderRadius: 12,
                  backgroundColor: active ? C["primary-soft"] : pressed ? C.sand : "transparent",
                })}
              >
                <Icon name={item.icon} size={18} color={active ? C.primary : C.muted} />
                <T weight={active ? "bold" : "medium"} style={{ flex: 1, color: active ? C.primary : C.foreground }}>
                  {item.label}
                </T>
                {item.href === "/notifications" && unread > 0 ? (
                  <View style={{ minWidth: 22, height: 20, borderRadius: 10, backgroundColor: C.error, alignItems: "center", justifyContent: "center", paddingHorizontal: 6 }}>
                    <T weight="bold" style={{ color: "#fff", fontSize: 11, lineHeight: 16 }}>
                      {unread > 99 ? "99+" : unread}
                    </T>
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </View>
        <View style={{ borderTopWidth: 1, borderTopColor: C.border, paddingTop: 14, flexDirection: "row", alignItems: "center", gap: 10 }}>
          <Pressable onPress={() => router.push("/settings" as any)} style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
            <Avatar id={profile?.id} name={profile?.full_name} size={36} />
            <View style={{ flex: 1 }}>
              <T weight="semibold" numberOfLines={1}>
                {profile?.full_name}
              </T>
              <T className="text-[12px] text-muted">{profile ? ROLE_LABELS[profile.role] : ""}</T>
            </View>
          </Pressable>
          <IconButton icon="log-out" label="تسجيل الخروج" color={C.muted} onPress={signOut} />
        </View>
      </View>
      <View style={{ flex: 1 }}>{children}</View>
    </View>
  );
}

function MobileShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { settings } = useSession();
  const unread = useUnread();
  return (
    <View style={{ flex: 1, backgroundColor: C.background }}>
      <View
        style={{
          paddingTop: insets.top + 8,
          paddingHorizontal: 16,
          paddingBottom: 8,
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
          backgroundColor: C.background,
        }}
      >
        <LogoMark size={30} />
        <View style={{ flex: 1 }}>
          <T weight="bold" className="text-[16px]" style={{ lineHeight: 22 }}>
            مدار
          </T>
          <T className="text-[11px] text-muted" numberOfLines={1} style={{ lineHeight: 15 }}>
            {settings?.company_name ?? ""}
          </T>
        </View>
        <IconButton icon="bell" label="الإشعارات" badge={unread} onPress={() => router.push("/notifications" as any)} />
      </View>
      <View style={{ paddingHorizontal: 16 }}>
        <TimerChip compact />
      </View>
      <View style={{ flex: 1 }}>{children}</View>
      <View
        style={{
          flexDirection: "row",
          backgroundColor: C.surface,
          borderTopWidth: 1,
          borderTopColor: C.border,
          paddingBottom: Math.max(insets.bottom, Platform.OS === "web" ? 8 : 10),
          paddingTop: 6,
        }}
      >
        {DOCK.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Pressable
              key={item.href}
              onPress={() => router.navigate(item.href as any)}
              style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 2, paddingVertical: 4 }}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
            >
              <View
                style={{
                  width: 46,
                  height: 28,
                  borderRadius: 14,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: active ? C["primary-soft"] : "transparent",
                }}
              >
                <Icon name={item.icon} size={19} color={active ? C.primary : C.muted} />
              </View>
              <T weight={active ? "bold" : "medium"} style={{ fontSize: 11, color: active ? C.primary : C.muted }}>
                {item.label}
              </T>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** Running work session indicator with a stop control. */
export function TimerChip({ compact }: { compact?: boolean }) {
  const open = useOpenSession();
  const session = open.data;
  const task = useTask(session?.task_id);
  const now = useNow(1000, !!session);
  const stop = useStopTimer();
  const toast = useToast();
  const router = useRouter();
  if (!session) return null;
  const elapsed = now - new Date(session.started_at).getTime();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        backgroundColor: C.forest,
        borderRadius: 14,
        paddingVertical: compact ? 8 : 10,
        paddingHorizontal: 12,
        marginBottom: compact ? 8 : 0,
      }}
    >
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#8FD3B6" }} />
      <Pressable style={{ flex: 1 }} onPress={() => router.push(`/tasks/${session.task_id}` as any)}>
        <T weight="bold" style={{ color: "#F4F1EA", fontSize: 15, fontVariant: ["tabular-nums"] }}>
          {fmtClock(elapsed)}
        </T>
        <T style={{ color: "#C9D6CF", fontSize: 12 }} numberOfLines={1}>
          {task.data?.title ?? "جلسة عمل جارية"}
        </T>
      </Pressable>
      <Pressable
        onPress={() =>
          stop.mutate(null, {
            onSuccess: () => toast.show("تم إيقاف المؤقت وحفظ الجلسة"),
            onError: (e) => toast.show(errorMessage(e), "error"),
          })
        }
        style={({ pressed }) => ({
          width: 34,
          height: 34,
          borderRadius: 10,
          backgroundColor: pressed ? "#ffffff30" : "#ffffff1A",
          alignItems: "center",
          justifyContent: "center",
        })}
        accessibilityLabel="إيقاف المؤقت"
      >
        <Icon name="square" size={14} color="#F4F1EA" />
      </Pressable>
    </View>
  );
}

/** Standard scrollable page with a title row. */
export function Page({
  title,
  subtitle,
  actions,
  children,
  maxWidth = 1180,
  scroll = true,
  back,
}: {
  title?: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  maxWidth?: number;
  scroll?: boolean;
  back?: () => void;
}) {
  const wide = useIsWide();
  const qc = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const header =
    title || actions ? (
      <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 12, flexWrap: "wrap", marginBottom: wide ? 22 : 16 }}>
        {back ? (
          <IconButton icon="arrow-right" label="رجوع" onPress={back} style={{ backgroundColor: C.surface, borderWidth: 1, borderColor: C.border }} />
        ) : null}
        <View style={{ flex: 1, minWidth: 200, gap: 2 }}>
          {title ? (
            <T weight="bold" style={{ fontSize: wide ? 28 : 23, lineHeight: wide ? 42 : 34 }}>
              {title}
            </T>
          ) : null}
          {subtitle ? <T className="text-[13px] text-muted">{subtitle}</T> : null}
        </View>
        {actions ? <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap", alignItems: "center" }}>{actions}</View> : null}
      </View>
    ) : null;
  const inner = (
    <View style={{ width: "100%", maxWidth, alignSelf: "center", paddingHorizontal: wide ? 32 : 16, paddingTop: wide ? 28 : 6, paddingBottom: 40 }}>
      {header}
      {children}
    </View>
  );
  if (!scroll) return <View style={{ flex: 1 }}>{inner}</View>;
  return (
    <ScrollView
      style={{ flex: 1 }}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        Platform.OS === "web" ? undefined : (
          <RefreshControl
            refreshing={refreshing}
            tintColor={C.primary}
            onRefresh={async () => {
              setRefreshing(true);
              await qc.invalidateQueries();
              setRefreshing(false);
            }}
          />
        )
      }
    >
      {inner}
    </ScrollView>
  );
}
