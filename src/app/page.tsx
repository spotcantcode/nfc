import { notFound, redirect } from "next/navigation";
import { managementEnabled } from "@/lib/config";
export const dynamic = "force-dynamic";
export default function Home() {
  if (!managementEnabled()) notFound();
  redirect("/dashboard");
}
