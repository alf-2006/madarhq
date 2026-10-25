import { useRouter } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { Page } from "@/components/madar/shell";
import { Button, C, Chip, EmptyState, Icon, Loading, T, Tap, confirmAction, type IconName } from "@/components/madar/ui";
import { fmtRelative } from "@/lib/madar/format";
import { useNotificationActions, useNotifications } from "@/lib/madar/queries";
import { useMe } from "@/lib/madar/session";
import type { NotificationItem } from "@/lib/madar/types";

const KIND: Record<string, { icon: IconName; color: string }> = {
  task_assigned: { icon: "user-check", color: C.primary },
  review_requested: { icon: "inbox", color: C.warning },
  task_approved: { icon: "check-circle", color: C.success },
  task_returned: { icon: "corner-up-right", color: C.error },
  comment_added: { icon: "message-circle", color: C.info },
  member_pending: { icon: "user-plus", color: C.warning },
  member_approved: { icon: "smile", color: C.primary },
};

export default function NotificationsScreen() {
  const me = useMe();
  const router = useRouter();
  const notifications = useNotifications();
  const { markRead, markAll, clearRead } = useNotificationActions();
  const [unreadOnly, setUnreadOnly] = useState(false);
  const list = (notifications.data ?? []).filter((n) => !unreadOnly || !n.read_at);
  const unread = (notifications.data ?? []).filter((n) => !n.read_at).length;

  const open = (n: NotificationItem) => {
    if (!n.read_at) markRead.mutate(n.id);
    if (n.task_id) router.push(`/tasks/${n.task_id}` as any);
    else if (n.kind === "member_pending") router.push("/team" as any);
  };

  return (
    <Page
      title="الإشعارات"
      subtitle={unread ? `${unread} غير مقروء` : "لا جديد"}
      maxWidth={820}
      actions={
        <>
          {unread ? <Button title="تعليم الكل كمقروء" icon="check" variant="secondary" size="sm" onPress={() => markAll.mutate(undefined)} loading={markAll.isPending} /> : null}
          {(notifications.data ?? []).some((n) => n.read_at) ? (
            <Button
              title="حذف المقروءة"
              icon="trash-2"
              variant="ghost"
              size="sm"
              onPress={async () => {
                if (await confirmAction("حذف كل الإشعارات المقروءة؟", "حذف")) clearRead.mutate(me.id);
              }}
            />
          ) : null}
        </>
      }
    >
      <View style={{ flexDirection: "row", gap: 8, marginBottom: 14 }}>
        <Chip label="الكل" active={!unreadOnly} onPress={() => setUnreadOnly(false)} />
        <Chip label={`غير المقروءة (${unread})`} active={unreadOnly} onPress={() => setUnreadOnly(true)} />
      </View>
      {notifications.isLoading ? (
        <Loading />
      ) : list.length === 0 ? (
        <EmptyState icon="bell" title={unreadOnly ? "قرأت كل الإشعارات" : "لا توجد إشعارات"} hint="ستصلك هنا الإسنادات وطلبات المراجعة والتعليقات." />
      ) : (
        <View style={{ backgroundColor: C.surface, borderRadius: 18, borderWidth: 1, borderColor: C.border, overflow: "hidden" }}>
          {list.map((n, i) => {
            const k = KIND[n.kind] ?? { icon: "bell" as IconName, color: C.muted };
            return (
              <Tap
                key={n.id}
                onPress={() => open(n)}
                style={({ pressed }) => ({
                  flexDirection: "row",
                  gap: 12,
                  padding: 14,
                  borderTopWidth: i === 0 ? 0 : 1,
                  borderTopColor: C.border,
                  backgroundColor: pressed ? C.background : n.read_at ? C.surface : C["primary-soft"] + "88",
                })}
              >
                <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: k.color + "1A", alignItems: "center", justifyContent: "center" }}>
                  <Icon name={k.icon} size={17} color={k.color} />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <T weight={n.read_at ? "medium" : "bold"}>{n.title}</T>
                  {n.body ? (
                    <T className="text-[13px] text-muted" numberOfLines={2}>
                      {n.body}
                    </T>
                  ) : null}
                  <T className="text-[11.5px] text-muted">{fmtRelative(n.created_at)}</T>
                </View>
                {!n.read_at ? <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: C.primary, marginTop: 6 }} /> : null}
              </Tap>
            );
          })}
        </View>
      )}
    </Page>
  );
}
