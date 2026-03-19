import type { ReactNode } from "react";

import { AuthenticatedShell } from "@/components/authenticated-shell";
import { requireWorkspaceUser } from "@/lib/server-auth";

export default async function WorkspaceLayout({ children }: { children: ReactNode }) {
  const user = await requireWorkspaceUser();

  return <AuthenticatedShell user={user}>{children}</AuthenticatedShell>;
}
