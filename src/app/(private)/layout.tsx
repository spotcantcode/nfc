import { requirePageAdmin } from "@/lib/auth";
import { Shell } from "@/components/shell";
export const dynamic = "force-dynamic";
export default async function PrivateLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePageAdmin();
  return <Shell email={user.email!}>{children}</Shell>;
}
