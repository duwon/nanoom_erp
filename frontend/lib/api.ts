import type {
  AdminUserUpdate,
  ApprovalTemplate,
  AuthUser,
  Board,
  DisplayState,
  DocumentAclAction,
  DocumentAclEffect,
  DocumentAttachment,
  DocumentDetail,
  DocumentRevision,
  DocumentStatus,
  DocumentSummary,
  DocumentTargetType,
  LookupEntry,
  OrderItem,
  PermissionSubjectType,
  SharedDocumentsOverview,
  SocialProvider,
  TargetTypeDescriptor,
  TargetPolicyAction,
  TargetPolicyRule,
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

export async function getTargetTypes(): Promise<TargetTypeDescriptor[]> {
  const response = await fetch(`${getApiV1BaseUrl()}/udms/target-types`, {
    cache: "no-store",
    credentials: "include",
  });
  return handleResponse<TargetTypeDescriptor[]>(response);
}

export async function listDocuments(params?: {
  targetType?: DocumentTargetType;
  targetId?: string;
  status?: DocumentStatus;
  q?: string;
}): Promise<DocumentSummary[]> {
  const url = new URL(`${getApiV1BaseUrl()}/udms/docs`);
  if (params?.targetType) {
    url.searchParams.set("targetType", params.targetType);
  }
  if (params?.targetId) {
    url.searchParams.set("targetId", params.targetId);
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
  return handleResponse<DocumentSummary[]>(response);
}

export async function getDocument(documentId: string): Promise<DocumentDetail> {
  const response = await fetch(`${getApiV1BaseUrl()}/udms/docs/${documentId}`, {
    cache: "no-store",
    credentials: "include",
  });
  return handleResponse<DocumentDetail>(response);
}

export async function createDocument(payload: {
  title: string;
  category: string;
  tags: string[];
  targetType: DocumentTargetType;
  targetId: string;
  body: string;
  moduleData?: Record<string, unknown>;
  changeLog?: string;
}): Promise<DocumentDetail> {
  return requestJson<DocumentDetail>(`${getApiV1BaseUrl()}/udms/docs`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateDocument(
  documentId: string,
  payload: {
    title?: string;
    category?: string;
    tags?: string[];
    targetType?: DocumentTargetType;
    targetId?: string;
    body?: string;
    moduleData?: Record<string, unknown>;
    changeLog?: string;
  },
): Promise<DocumentDetail> {
  return requestJson<DocumentDetail>(`${getApiV1BaseUrl()}/udms/docs/${documentId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function createWorkingCopy(documentId: string): Promise<DocumentDetail> {
  return requestJson<DocumentDetail>(`${getApiV1BaseUrl()}/udms/docs/${documentId}/working-copy`, {
    method: "POST",
  });
}

export async function publishDocument(documentId: string): Promise<DocumentDetail> {
  return requestJson<DocumentDetail>(`${getApiV1BaseUrl()}/udms/docs/${documentId}/publish`, {
    method: "POST",
  });
}

export async function rollbackDocument(documentId: string, targetVersion: number): Promise<DocumentDetail> {
  return requestJson<DocumentDetail>(`${getApiV1BaseUrl()}/udms/docs/${documentId}/rollback`, {
    method: "POST",
    body: JSON.stringify({ targetVersion }),
  });
}

export async function listDocumentRevisions(documentId: string): Promise<DocumentRevision[]> {
  const response = await fetch(`${getApiV1BaseUrl()}/udms/docs/${documentId}/revisions`, {
    cache: "no-store",
    credentials: "include",
  });
  return handleResponse<DocumentRevision[]>(response);
}

export async function updateDocumentSecurity(
  documentId: string,
  payload: {
    acl: Array<{
      subjectType: PermissionSubjectType;
      subjectId: string;
      actions: DocumentAclAction[];
      effect: DocumentAclEffect;
    }>;
  },
): Promise<DocumentDetail> {
  return requestJson<DocumentDetail>(`${getApiV1BaseUrl()}/udms/docs/${documentId}/security`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function createDocumentExternalShare(
  documentId: string,
  payload: { label: string; expiresAt?: string | null; canDownload: boolean },
): Promise<DocumentDetail> {
  return requestJson<DocumentDetail>(`${getApiV1BaseUrl()}/udms/docs/${documentId}/external-shares`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function deleteDocumentExternalShare(documentId: string, shareId: string): Promise<DocumentDetail> {
  return requestJson<DocumentDetail>(`${getApiV1BaseUrl()}/udms/docs/${documentId}/external-shares/${shareId}`, {
    method: "DELETE",
  });
}

export async function getSharedDocuments(): Promise<SharedDocumentsOverview> {
  const response = await fetch(`${getApiV1BaseUrl()}/udms/docs/shared`, {
    cache: "no-store",
    credentials: "include",
  });
  return handleResponse<SharedDocumentsOverview>(response);
}

export async function uploadDocumentAttachment(documentId: string, file: File): Promise<DocumentAttachment> {
  const body = new FormData();
  body.append("file", file);
  return requestFormData<DocumentAttachment>(`${getApiV1BaseUrl()}/udms/docs/${documentId}/files`, body);
}

export async function deleteDocumentAttachment(attachmentId: string): Promise<void> {
  const response = await fetch(`${getApiV1BaseUrl()}/udms/files/${attachmentId}`, {
    method: "DELETE",
    credentials: "include",
  });
  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }
}

export function getAttachmentDownloadUrl(attachmentId: string) {
  return `${getApiV1BaseUrl()}/udms/files/${attachmentId}/download`;
}

export async function getTargetPolicies(params?: {
  targetType?: DocumentTargetType;
  targetId?: string;
}): Promise<TargetPolicyRule[]> {
  const url = new URL(`${getApiV1BaseUrl()}/udms/policies`);
  if (params?.targetType) {
    url.searchParams.set("targetType", params.targetType);
  }
  if (params?.targetId) {
    url.searchParams.set("targetId", params.targetId);
  }
  const response = await fetch(url.toString(), {
    cache: "no-store",
    credentials: "include",
  });
  return handleResponse<TargetPolicyRule[]>(response);
}

export async function replaceTargetPolicies(
  targetType: DocumentTargetType,
  targetId: string,
  payload: Array<{ subjectType: PermissionSubjectType; subjectId: string; actions: TargetPolicyAction[] }>,
): Promise<TargetPolicyRule[]> {
  return requestJson<TargetPolicyRule[]>(`${getApiV1BaseUrl()}/udms/policies/${targetType}/${targetId}`, {
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
  const response = await fetch(`${getPublicApiBaseUrl()}/api/order-items/${itemId}/activate`, {
    method: "POST",
  });
  return handleResponse<DisplayState>(response);
}

export async function getDisplayState(): Promise<DisplayState> {
  const response = await fetch(`${getPublicApiBaseUrl()}/api/display-state`, {
    cache: "no-store",
  });
  return handleResponse<DisplayState>(response);
}
