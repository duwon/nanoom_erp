import type { ReactNode } from "react";

import { requireMasterUser } from "@/lib/server-auth";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  await requireMasterUser();
  return children;
}
