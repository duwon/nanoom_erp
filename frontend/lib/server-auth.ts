import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { getPublicApiBaseUrl, getServerApiBaseUrl } from "@/lib/api-base-url";
import type { AuthUser } from "@/lib/types";

export function isProfileComplete(user: Pick<AuthUser, "name" | "position" | "department">) {
  return Boolean(user.name && user.position && user.department);
}

export function getDefaultAuthenticatedPath(user: Pick<AuthUser, "role">) {
  return user.role === "master" ? "/admin" : "/dashboard";
}

export function getAttentionRedirect(user: AuthUser, requestedPath = "/dashboard") {
  if (!isProfileComplete(user)) {
    return "/onboarding";
  }
  if (user.status === "pending") {
    return "/pending";
  }
  if (user.status === "blocked") {
    return "/blocked";
  }
  if (requestedPath.startsWith("/admin") && user.role !== "master") {
    return getDefaultAuthenticatedPath(user);
  }
  return null;
}

export async function getCurrentUserServer(): Promise<AuthUser | null> {
  const requestHeaders = await headers();
  const cookie = requestHeaders.get("cookie");
  const requestInit: RequestInit = { cache: "no-store" };
  if (cookie) {
    requestInit.headers = { cookie };
  }
  const primaryBaseUrl = getServerApiBaseUrl();
  const fallbackBaseUrl = getPublicApiBaseUrl();

  async function fetchCurrentUser(baseUrl: string) {
    return fetch(`${baseUrl}/api/v1/auth/me`, requestInit);
  }

  let response: Response;
  try {
    response = await fetchCurrentUser(primaryBaseUrl);
  } catch (error) {
    if (primaryBaseUrl !== fallbackBaseUrl) {
      try {
        response = await fetchCurrentUser(fallbackBaseUrl);
      } catch (fallbackError) {
        console.error("Failed to fetch current user on the server:", `${primaryBaseUrl}/api/v1/auth/me`, error);
        console.error("Fallback fetch also failed:", `${fallbackBaseUrl}/api/v1/auth/me`, fallbackError);
        return null;
      }
    } else {
      console.error("Failed to fetch current user on the server:", `${primaryBaseUrl}/api/v1/auth/me`, error);
      return null;
    }
  }

  if (response.status === 401) {
    return null;
  }
  if (!response.ok) {
    return null;
  }
  return (await response.json()) as AuthUser;
}

export async function redirectAuthenticatedFromAuthPage() {
  const user = await getCurrentUserServer();
  if (!user) {
    return;
  }

  const attentionRedirect = getAttentionRedirect(user);
  if (attentionRedirect) {
    redirect(attentionRedirect);
  }
  redirect(getDefaultAuthenticatedPath(user));
}

export async function requireWorkspaceUser(requestedPath = "/dashboard") {
  const user = await getCurrentUserServer();
  if (!user) {
    redirect("/login");
  }

  const attentionRedirect = getAttentionRedirect(user, requestedPath);
  if (attentionRedirect) {
    redirect(attentionRedirect);
  }
  return user;
}

export async function requireMasterUser() {
  const user = await requireWorkspaceUser("/admin");
  if (user.role !== "master") {
    redirect(getDefaultAuthenticatedPath(user));
  }
  return user;
}

export async function requireOnboardingUser() {
  const user = await getCurrentUserServer();
  if (!user) {
    redirect("/login");
  }

  if (user.status === "blocked") {
    redirect("/blocked");
  }

  if (isProfileComplete(user)) {
    if (user.status === "pending") {
      redirect("/pending");
    }
    if (user.status === "active") {
      redirect(getDefaultAuthenticatedPath(user));
    }
  }

  return user;
}

export async function requirePendingUser() {
  const user = await getCurrentUserServer();
  if (!user) {
    redirect("/login");
  }

  if (!isProfileComplete(user)) {
    redirect("/onboarding");
  }
  if (user.status === "blocked") {
    redirect("/blocked");
  }
  if (user.status === "active") {
    redirect(getDefaultAuthenticatedPath(user));
  }

  return user;
}

export async function requireBlockedUser() {
  const user = await getCurrentUserServer();
  if (!user) {
    redirect("/login");
  }

  if (user.status === "pending") {
    redirect(isProfileComplete(user) ? "/pending" : "/onboarding");
  }
  if (user.status === "active") {
    redirect(getDefaultAuthenticatedPath(user));
  }

  return user;
}
