import { Redirect, Stack } from "expo-router";
import { View } from "react-native";
import { OrbitDecor, Wordmark } from "@/components/madar/logo";
import { AppShell } from "@/components/madar/shell";
import { Button, C, Loading, T } from "@/components/madar/ui";
import { useSession } from "@/lib/madar/session";

export default function AppLayout() {
  const { ready, session, profile, profileLoading, signOut, refreshProfile } = useSession();

  if (!ready || profileLoading) return <Loading />;
  if (!session) return <Redirect href="/login" />;

  if (!profile || profile.status !== "active") {
    const disabled = profile?.status === "disabled";
    return (
      <View style={{ flex: 1, backgroundColor: C.background, alignItems: "center", justifyContent: "center", padding: 24 }}>
        <View style={{ width: "100%", maxWidth: 460, backgroundColor: C.forest, borderRadius: 24, padding: 28, gap: 16, overflow: "hidden" }}>
          <OrbitDecor size={360} />
          <Wordmark light />
          <T weight="bold" style={{ color: "#F4F1EA", fontSize: 22, lineHeight: 34 }}>
            {disabled ? "تم إيقاف حسابك" : "حسابك بانتظار الموافقة"}
          </T>
          <T style={{ color: "#C9D6CF", lineHeight: 24 }}>
            {disabled
              ? "تواصل مع مدير النظام في شركتك لإعادة تفعيل الحساب."
              : `سجّلت باسم ${profile?.full_name ?? ""}. سيصلك الوصول إلى مساحة العمل فور موافقة مدير النظام، ويمكنك تحديث هذه الصفحة للتحقق.`}
          </T>
          <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
            {!disabled ? <Button title="تحقّق الآن" icon="refresh-cw" onPress={() => refreshProfile()} /> : null}
            <Button title="تسجيل الخروج" variant="secondary" icon="log-out" onPress={signOut} />
          </View>
        </View>
      </View>
    );
  }

  return (
    <AppShell>
      <Stack screenOptions={{ headerShown: false, animation: "fade", contentStyle: { backgroundColor: C.background } }} />
    </AppShell>
  );
}
