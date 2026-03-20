import type {
  AdminUserUpdate,
  ApprovalTemplate,
  AuthUser,
  Board,
  BoardPermissionRule,
  BoardPermissionAction,
  DocumentAttachment,
  DocumentShare,
  DisplayState,
  LookupEntry,
  OrderItem,
  PermissionSubjectType,
  SharedDocumentOverview,
  SocialProvider,
  UdmsDocumentDetail,
  UdmsDocumentSummary,
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

async function requestFormData<T>(url: string, body: FormData, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    method: init?.method ?? "POST",
    body,
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

export async function createBoard(payload: {
  name: string;
  description: string;
  isActive: boolean;
}): Promise<Board> {
  return requestJson<Board>(`${getApiV1BaseUrl()}/admin/boards`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateBoard(
  boardId: string,
  payload: { name: string; description: string; isActive: boolean },
): Promise<Board> {
  return requestJson<Board>(`${getApiV1BaseUrl()}/admin/boards/${boardId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function getApprovalTemplates(): Promise<ApprovalTemplate[]> {
  const response = await fetch(`${getApiV1BaseUrl()}/udms/approval-templates`, {
    cache: "no-store",
    credentials: "include",
  });
  return handleResponse<ApprovalTemplate[]>(response);
}

export async function listUdmsDocuments(params?: {
  boardId?: string;
  status?: string;
  q?: string;
}): Promise<UdmsDocumentSummary[]> {
  const url = new URL(`${getApiV1BaseUrl()}/udms/documents`);
  if (params?.boardId) {
    url.searchParams.set("boardId", params.boardId);
  }
  if (params?.status) {
    url.searchParams.set("status", params.status);
  }
  if (params?.q) {
    url.searchParams.set("q", params.q);
  }
  const response = await fetch(url.toString(), {
    cache: "no-store",
    credentials: "include",
  });
  return handleResponse<UdmsDocumentSummary[]>(response);
}

export async function getUdmsDocument(documentId: string): Promise<UdmsDocumentDetail> {
  const response = await fetch(`${getApiV1BaseUrl()}/udms/documents/${documentId}`, {
    cache: "no-store",
    credentials: "include",
  });
  return handleResponse<UdmsDocumentDetail>(response);
}

export async function createUdmsDocument(payload: {
  boardId: string;
  title: string;
  content: string;
  approvalTemplateId?: string | null;
}): Promise<UdmsDocumentDetail> {
  return requestJson<UdmsDocumentDetail>(`${getApiV1BaseUrl()}/udms/documents`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateUdmsDocument(
  documentId: string,
  payload: {
    boardId?: string;
    title?: string;
    content?: string;
    approvalTemplateId?: string | null;
  },
): Promise<UdmsDocumentDetail> {
  return requestJson<UdmsDocumentDetail>(`${getApiV1BaseUrl()}/udms/documents/${documentId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function publishUdmsDocument(documentId: string): Promise<UdmsDocumentDetail> {
  return requestJson<UdmsDocumentDetail>(`${getApiV1BaseUrl()}/udms/documents/${documentId}/publish`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export async function createUdmsNextVersion(documentId: string): Promise<UdmsDocumentDetail> {
  return requestJson<UdmsDocumentDetail>(`${getApiV1BaseUrl()}/udms/documents/${documentId}/versions`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export async function getUdmsVersions(documentId: string): Promise<UdmsDocumentSummary[]> {
  const response = await fetch(`${getApiV1BaseUrl()}/udms/documents/${documentId}/versions`, {
    cache: "no-store",
    credentials: "include",
  });
  return handleResponse<UdmsDocumentSummary[]>(response);
}

export async function getDocumentShares(documentId: string): Promise<DocumentShare[]> {
  const response = await fetch(`${getApiV1BaseUrl()}/udms/documents/${documentId}/shares`, {
    cache: "no-store",
    credentials: "include",
  });
  return handleResponse<DocumentShare[]>(response);
}

export async function replaceDocumentShares(
  documentId: string,
  payload: Array<{ targetType: "user" | "department"; targetId: string; permission: "read" | "edit" }>,
): Promise<DocumentShare[]> {
  return requestJson<DocumentShare[]>(`${getApiV1BaseUrl()}/udms/documents/${documentId}/shares`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function getSharedDocuments(): Promise<SharedDocumentOverview> {
  const response = await fetch(`${getApiV1BaseUrl()}/udms/shares`, {
    cache: "no-store",
    credentials: "include",
  });
  return handleResponse<SharedDocumentOverview>(response);
}

export async function uploadDocumentAttachment(
  documentId: string,
  file: File,
): Promise<DocumentAttachment> {
  const body = new FormData();
  body.append("file", file);
  return requestFormData<DocumentAttachment>(`${getApiV1BaseUrl()}/udms/documents/${documentId}/attachments`, body);
}

export async function deleteDocumentAttachment(attachmentId: string): Promise<void> {
  const response = await fetch(`${getApiV1BaseUrl()}/udms/attachments/${attachmentId}`, {
    method: "DELETE",
    credentials: "include",
  });
  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }
}

export function getAttachmentDownloadUrl(attachmentId: string) {
  return `${getApiV1BaseUrl()}/udms/attachments/${attachmentId}/download`;
}

export async function getBoardPermissionRules(): Promise<BoardPermissionRule[]> {
  const response = await fetch(`${getApiV1BaseUrl()}/udms/permissions`, {
    cache: "no-store",
    credentials: "include",
  });
  return handleResponse<BoardPermissionRule[]>(response);
}

export async function replaceBoardPermissionRules(
  boardId: string,
  payload: Array<{ subjectType: PermissionSubjectType; subjectId: string; actions: BoardPermissionAction[] }>,
): Promise<BoardPermissionRule[]> {
  return requestJson<BoardPermissionRule[]>(`${getApiV1BaseUrl()}/udms/boards/${boardId}/permissions`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
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
