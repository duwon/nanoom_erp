import type { ReactNode } from "react";

import { requireWorkspaceUser } from "@/lib/server-auth";

export default async function UdmsLayout({ children }: { children: ReactNode }) {
  await requireWorkspaceUser("/udms");
  return children;
}
