import type { ReactNode } from "react";

import { requireWorkspaceUser } from "@/lib/server-auth";

export default async function WorshipLayout({ children }: { children: ReactNode }) {
  await requireWorkspaceUser("/worship");
  return children;
}
