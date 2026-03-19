import type { ReactNode } from "react";

import { redirectAuthenticatedFromAuthPage } from "@/lib/server-auth";

export default async function AuthLayout({ children }: { children: ReactNode }) {
  await redirectAuthenticatedFromAuthPage();
  return children;
}
