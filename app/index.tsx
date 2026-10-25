import { Redirect } from "expo-router";
import { Loading } from "@/components/madar/ui";
import { useSession } from "@/lib/madar/session";

export default function Index() {
  const { ready, session } = useSession();
  if (!ready) return <Loading />;
  return <Redirect href={session ? "/dashboard" : "/login"} />;
}
