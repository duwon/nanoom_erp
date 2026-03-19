import type {
  AdminUserUpdate,
  AuthUser,
  Board,
  DisplayState,
  LookupEntry,
  OrderItem,
  SocialProvider,
  UserProfileUpdate,
} from "@/lib/types";
import { getPublicApiBaseUrl } from "@/lib/api-base-url";

function getApiV1BaseUrl() {
  return `${getPublicApiBaseUrl()}/api/v1`;
}

export function getOAuthStartUrl(provider: SocialProvider, nextPath = "/") {
  const url = new URL(`${getApiV1BaseUrl()}/auth/oauth/${provider}/start`);
  url.searchParams.set("next", nextPath);
  return url.toString();
}

export function getWebSocketUrl() {
  const envUrl = process.env.NEXT_PUBLIC_WS_URL;
  if (envUrl) {
    return envUrl;
  }

  const apiUrl = getPublicApiBaseUrl();
  if (apiUrl.startsWith("https://")) {
    return apiUrl.replace("https://", "wss://") + "/ws/display";
  }
  return apiUrl.replace("http://", "ws://") + "/ws/display";
}

async function readErrorMessage(response: Response): Promise<string> {
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const payload = (await response.json()) as { detail?: string };
    if (payload.detail) {
      return payload.detail;
    }
  }

  const text = await response.text();
  return text || `Request failed with status ${response.status}`;
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }
  return (await response.json()) as T;
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    credentials: "include",
  });

  return handleResponse<T>(response);
}

export async function logout(): Promise<{ status: string }> {
  return requestJson<{ status: string }>(`${getApiV1BaseUrl()}/auth/logout`, {
    method: "POST",
  });
}

export async function getCurrentUser(): Promise<AuthUser> {
  const response = await fetch(`${getApiV1BaseUrl()}/auth/me`, {
    cache: "no-store",
    credentials: "include",
  });
  return handleResponse<AuthUser>(response);
}

export async function updateMyProfile(payload: UserProfileUpdate): Promise<AuthUser> {
  return requestJson<AuthUser>(`${getApiV1BaseUrl()}/users/me/profile`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function listAdminUsers(): Promise<AuthUser[]> {
  const response = await fetch(`${getApiV1BaseUrl()}/admin/users`, {
    cache: "no-store",
    credentials: "include",
  });
  return handleResponse<AuthUser[]>(response);
}

export async function updateAdminUser(userId: string, payload: AdminUserUpdate): Promise<AuthUser> {
  return requestJson<AuthUser>(`${getApiV1BaseUrl()}/admin/users/${userId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function getDepartments(): Promise<LookupEntry[]> {
  const response = await fetch(`${getApiV1BaseUrl()}/lookups/departments`, {
    cache: "no-store",
    credentials: "include",
  });
  return handleResponse<LookupEntry[]>(response);
}

export async function getPositions(): Promise<LookupEntry[]> {
  const response = await fetch(`${getApiV1BaseUrl()}/lookups/positions`, {
    cache: "no-store",
    credentials: "include",
  });
  return handleResponse<LookupEntry[]>(response);
}

export async function getBoards(): Promise<Board[]> {
  const response = await fetch(`${getApiV1BaseUrl()}/udms/boards`, {
    cache: "no-store",
    credentials: "include",
  });
  return handleResponse<Board[]>(response);
}

export async function getOrderItems(): Promise<OrderItem[]> {
  const response = await fetch(`${getPublicApiBaseUrl()}/api/order-items`, {
    cache: "no-store",
  });
  return handleResponse<OrderItem[]>(response);
}

export async function updateOrderItem(
  itemId: string,
  payload: { title: string; content: string },
): Promise<OrderItem> {
  const response = await fetch(`${getPublicApiBaseUrl()}/api/order-items/${itemId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  return handleResponse<OrderItem>(response);
}

export async function activateOrderItem(itemId: string): Promise<DisplayState> {
  const response = await fetch(
    `${getPublicApiBaseUrl()}/api/order-items/${itemId}/activate`,
    {
      method: "POST",
    },
  );

  return handleResponse<DisplayState>(response);
}

export async function getDisplayState(): Promise<DisplayState> {
  const response = await fetch(`${getPublicApiBaseUrl()}/api/display-state`, {
    cache: "no-store",
  });

  return handleResponse<DisplayState>(response);
}
