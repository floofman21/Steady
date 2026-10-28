import { redirect } from "next/navigation";
import { canSeeDashboard } from "@/lib/permissions";
import { getViewer } from "@/lib/viewer";

export default async function Home() {
  const viewer = await getViewer();
  redirect(viewer && canSeeDashboard(viewer) ? "/dashboard" : "/check-in");
}
