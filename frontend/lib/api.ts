import type {
  ActiveUserSummary,
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
  WorshipCalendarResponse,
  WorshipGuestLinkResponse,
  WorshipGuestTaskView,
  WorshipInputTemplate,
  WorshipInputTemplateUpsert,
  WorshipPresentationState,
  WorshipReviewResponse,
  WorshipScriptureLookupResponse,
  WorshipSection,
  WorshipSectionTypeDefinition,
  WorshipSectionTypeDefinitionUpsert,
  WorshipServiceDetail,
  WorshipSlideTemplate,
  WorshipSlideTemplateUpsert,
  WorshipSongLookupItem,
  WorshipTemplate,
  TargetTypeDescriptor,
  TargetPolicyAction,
  TargetPolicyRule,
  UserProfileUpdate,
} from "@/lib/types";
import { getPublicApiBaseUrl } from "@/lib/api-base-url";

function getApiV1BaseUrl() {
  return `${getPublicApiBaseUrl()}/api/v1`;
}

function normalizeWorshipSlide<T extends { slideTemplateKey?: string; templateKey?: string }>(slide: T): T {
  return {
    ...slide,
    slideTemplateKey: slide.slideTemplateKey ?? slide.templateKey ?? "",
    templateKey: slide.templateKey ?? slide.slideTemplateKey ?? "",
  };
}

function normalizeWorshipSection<T extends {
  sectionTypeCode?: string;
  sectionType?: string;
  slideTemplateKey?: string;
  templateKey?: string;
  slides?: Array<{ slideTemplateKey?: string; templateKey?: string }>;
}>(section: T): T {
  return {
    ...section,
    sectionTypeCode: section.sectionTypeCode ?? section.sectionType ?? "",
    sectionType: section.sectionType ?? section.sectionTypeCode ?? "",
    slideTemplateKey: section.slideTemplateKey ?? section.templateKey ?? "",
    templateKey: section.templateKey ?? section.slideTemplateKey ?? "",
    slides: section.slides?.map((slide) => normalizeWorshipSlide(slide)) ?? [],
  };
}

function normalizeWorshipTemplate<T extends {
  defaultSections: Array<{
    sectionTypeCode?: string;
    sectionType?: string;
    slideTemplateKey?: string;
    templateKey?: string;
  }>;
  taskPresets?: unknown[];
  templatePresets?: unknown[];
}>(template: T): T {
  return {
    ...template,
    defaultSections: template.defaultSections.map((section) => normalizeWorshipSection(section)),
    taskPresets: template.taskPresets ?? [],
    templatePresets: template.templatePresets ?? [],
  };
}

function defaultInputTemplateIdForSection(sectionTypeCode: string) {
  switch (sectionTypeCode) {
    case "song":
    case "special_song":
      return "input-song-lyrics";
    case "scripture":
      return "input-scripture";
    case "message":
      return "input-message-notes";
    case "prayer":
      return "input-prayer";
    case "notice":
    case "media":
      return "input-generic-notes";
    default:
      return "input-generic-notes";
  }
}

function defaultWorkspaceBucketForSection(sectionTypeCode: string) {
  switch (sectionTypeCode) {
    case "song":
    case "special_song":
      return "music";
    default:
      return "content";
  }
}

function buildWorshipTemplatePayload(payload: {
  serviceKind: string;
  displayName: string;
  startTime: string;
  generationRule: string;
  defaultSections: Array<Record<string, unknown>>;
  isActive: boolean;
}) {
  return {
    serviceKind: payload.serviceKind,
    displayName: payload.displayName,
    startTime: payload.startTime,
    generationRule: payload.generationRule,
    isActive: payload.isActive,
    defaultSections: payload.defaultSections.map((section, index) => {
      const sectionTypeCode = String(section.sectionTypeCode ?? section.sectionType ?? "");
      const slideTemplateKey = String(section.slideTemplateKey ?? section.templateKey ?? "");
      return {
        id: String(section.id ?? `section-${index + 1}`),
        order: Number(section.order ?? index + 1),
        sectionTypeCode,
        title: String(section.title ?? ""),
        detail: String(section.detail ?? ""),
        role: String(section.role ?? ""),
        assigneeName: section.assigneeName == null ? null : String(section.assigneeName),
        durationMinutes: Number(section.durationMinutes ?? 0),
        dueOffsetMinutes: Number(section.dueOffsetMinutes ?? 0),
        inputTemplateId: String(section.inputTemplateId ?? defaultInputTemplateIdForSection(sectionTypeCode)),
        slideTemplateKey,
        workspaceBucket: String(section.workspaceBucket ?? defaultWorkspaceBucketForSection(sectionTypeCode)),
        notes: String(section.notes ?? ""),
        content: typeof section.content === "object" && section.content ? (section.content as Record<string, unknown>) : {},
      };
    }),
  };
}

function normalizeWorshipService<T extends {
  sections: Array<{
    sectionTypeCode?: string;
    sectionType?: string;
    slideTemplateKey?: string;
    templateKey?: string;
    slides?: Array<{ slideTemplateKey?: string; templateKey?: string }>;
  }>;
  reviewSummary?: unknown;
}>(service: T): T {
  return {
    ...service,
    sections: service.sections.map((section) => normalizeWorshipSection(section)),
  };
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

export async function listActiveUsers(): Promise<ActiveUserSummary[]> {
  const response = await fetch(`${getApiV1BaseUrl()}/users/active`, {
    cache: "no-store",
    credentials: "include",
  });
  return handleResponse<ActiveUserSummary[]>(response);
}

export async function updateMyProfile(payload: UserProfileUpdate): Promise<AuthUser> {
  return requestJson<AuthUser>(`${getApiV1BaseUrl()}/users/me/profile`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function switchMyDevRole(role: "master" | "editor"): Promise<AuthUser> {
  return requestJson<AuthUser>(`${getApiV1BaseUrl()}/users/me/dev-role`, {
    method: "PUT",
    body: JSON.stringify({ role }),
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
  myDocuments?: boolean;
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
  if (params?.myDocuments) {
    url.searchParams.set("myDocuments", "true");
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

export async function getWorshipCalendar(params?: {
  anchorDate?: string;
  days?: number;
}): Promise<WorshipCalendarResponse> {
  const url = new URL(`${getApiV1BaseUrl()}/worship/calendar`);
  if (params?.anchorDate) {
    url.searchParams.set("anchorDate", params.anchorDate);
  }
  if (params?.days) {
    url.searchParams.set("days", String(params.days));
  }
  const response = await fetch(url.toString(), {
    cache: "no-store",
    credentials: "include",
  });
  return handleResponse<WorshipCalendarResponse>(response);
}

export async function getWorshipService(serviceId: string) {
  const response = await fetch(`${getApiV1BaseUrl()}/worship/services/${serviceId}`, {
    cache: "no-store",
    credentials: "include",
  });
  return normalizeWorshipService(await handleResponse<WorshipServiceDetail>(response));
}

export async function createWorshipService(payload: {
  targetDate: string;
  templateId: string;
}): Promise<WorshipServiceDetail> {
  return normalizeWorshipService(await requestJson<WorshipServiceDetail>(`${getApiV1BaseUrl()}/worship/services`, {
    method: "POST",
    body: JSON.stringify(payload),
  }));
}

export async function updateWorshipService(
  serviceId: string,
  payload: { version: number; summary?: string; serviceName?: string; startAt?: string },
): Promise<WorshipServiceDetail> {
  return normalizeWorshipService(await requestJson<WorshipServiceDetail>(`${getApiV1BaseUrl()}/worship/services/${serviceId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  }));
}

export async function updateWorshipSection(
  serviceId: string,
  sectionId: string,
  payload: {
    version: number;
    title?: string;
    detail?: string;
    role?: string;
    assigneeId?: string | null;
    assigneeName?: string | null;
    status?: string;
    durationMinutes?: number;
    dueOffsetMinutes?: number;
    inputTemplateId?: string;
    slideTemplateKey?: string;
    notes?: string;
    content?: Record<string, unknown>;
    slides?: WorshipSection["slides"];
    editorValues?: Record<string, unknown>;
    markComplete?: boolean;
  },
): Promise<WorshipServiceDetail> {
  return normalizeWorshipService(await requestJson<WorshipServiceDetail>(`${getApiV1BaseUrl()}/worship/services/${serviceId}/sections/${sectionId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  }));
}

export async function addWorshipSection(
  serviceId: string,
  payload: {
    version: number;
    afterSectionId: string;
    sectionTypeCode?: WorshipSection["sectionTypeCode"];
    sectionType?: WorshipSection["sectionTypeCode"];
  },
): Promise<WorshipServiceDetail> {
  return normalizeWorshipService(await requestJson<WorshipServiceDetail>(`${getApiV1BaseUrl()}/worship/services/${serviceId}/sections`, {
    method: "POST",
    body: JSON.stringify({
      ...payload,
      sectionTypeCode: payload.sectionTypeCode ?? payload.sectionType,
    }),
  }));
}

export async function deleteWorshipSection(
  serviceId: string,
  sectionId: string,
  version: number,
): Promise<WorshipServiceDetail> {
  const response = await fetch(
    `${getApiV1BaseUrl()}/worship/services/${serviceId}/sections/${sectionId}?version=${version}`,
    {
      method: "DELETE",
      credentials: "include",
    },
  );
  return normalizeWorshipService(await handleResponse<WorshipServiceDetail>(response));
}

export async function reorderWorshipSections(
  serviceId: string,
  payload: { version: number; sections: Array<{ sectionId: string; order: number }> },
): Promise<WorshipServiceDetail> {
  return normalizeWorshipService(await requestJson<WorshipServiceDetail>(`${getApiV1BaseUrl()}/worship/services/${serviceId}/sections/reorder`, {
    method: "POST",
    body: JSON.stringify(payload),
  }));
}

export async function issueWorshipGuestLink(
  serviceId: string,
  taskId: string,
): Promise<WorshipGuestLinkResponse> {
  return requestJson<WorshipGuestLinkResponse>(
    `${getApiV1BaseUrl()}/worship/services/${serviceId}/tasks/${taskId}/guest-link`,
    {
      method: "POST",
    },
  );
}

export async function getWorshipGuestInput(token: string): Promise<WorshipGuestTaskView> {
  const response = await fetch(`${getApiV1BaseUrl()}/worship/input/${token}`, {
    cache: "no-store",
    credentials: "include",
  });
  return handleResponse<WorshipGuestTaskView>(response);
}

export async function submitWorshipGuestInput(
  token: string,
  values: Record<string, unknown>,
  markComplete = false,
): Promise<WorshipGuestTaskView> {
  return requestJson<WorshipGuestTaskView>(`${getApiV1BaseUrl()}/worship/input/${token}`, {
    method: "PUT",
    body: JSON.stringify({ values, markComplete }),
  });
}

export async function lookupWorshipSongs(query: string): Promise<WorshipSongLookupItem[]> {
  const url = new URL(`${getApiV1BaseUrl()}/worship/lookups/songs`);
  url.searchParams.set("q", query);
  const response = await fetch(url.toString(), {
    cache: "no-store",
    credentials: "include",
  });
  return handleResponse<WorshipSongLookupItem[]>(response);
}

export async function lookupWorshipScripture(params: {
  book: string;
  chapter: number;
  verseStart: number;
  verseEnd?: number;
  translation?: string;
}): Promise<WorshipScriptureLookupResponse> {
  const url = new URL(`${getApiV1BaseUrl()}/worship/lookups/scripture`);
  url.searchParams.set("book", params.book);
  url.searchParams.set("chapter", String(params.chapter));
  url.searchParams.set("verseStart", String(params.verseStart));
  if (params.verseEnd) {
    url.searchParams.set("verseEnd", String(params.verseEnd));
  }
  if (params.translation) {
    url.searchParams.set("translation", params.translation);
  }
  const response = await fetch(url.toString(), {
    cache: "no-store",
    credentials: "include",
  });
  return handleResponse<WorshipScriptureLookupResponse>(response);
}

export async function parseWorshipLyrics(
  serviceId: string,
  sectionId: string,
  payload: { lyrics: string; slideTemplateKey?: string },
): Promise<{ slides: WorshipSection["slides"] }> {
  return requestJson<{ slides: WorshipSection["slides"] }>(
    `${getApiV1BaseUrl()}/worship/services/${serviceId}/sections/${sectionId}/lyrics:parse`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}

export async function getWorshipReview(serviceId: string): Promise<WorshipReviewResponse> {
  const response = await fetch(`${getApiV1BaseUrl()}/worship/services/${serviceId}/review`, {
    cache: "no-store",
    credentials: "include",
  });
  const review = await handleResponse<WorshipReviewResponse>(response);
  return {
    ...review,
    service: normalizeWorshipService(review.service),
    items: review.items.map((item) => ({
      ...item,
      slideTemplateKey: item.slideTemplateKey ?? item.templateKey ?? "",
      templateKey: item.templateKey ?? item.slideTemplateKey ?? "",
    })),
    preview: {
      ...review.preview,
      sections: review.preview.sections.map((section) => normalizeWorshipSection(section)),
    },
  };
}

export async function activateWorshipPresentation(
  serviceId: string,
  selectedSectionIds: string[],
): Promise<WorshipPresentationState> {
  const response = await fetch(`${getApiV1BaseUrl()}/worship/services/${serviceId}/presentation/activate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ selectedSectionIds }),
    credentials: "include",
  });
  return handleResponse<WorshipPresentationState>(response);
}

export async function listWorshipTemplates(): Promise<WorshipTemplate[]> {
  const response = await fetch(`${getApiV1BaseUrl()}/admin/worship-templates`, {
    cache: "no-store",
    credentials: "include",
  });
  return (await handleResponse<WorshipTemplate[]>(response)).map((template) => normalizeWorshipTemplate(template));
}

export async function createWorshipTemplate(payload: {
  serviceKind: string;
  displayName: string;
  startTime: string;
  generationRule: string;
  defaultSections: Array<Record<string, unknown>>;
  isActive: boolean;
}): Promise<WorshipTemplate> {
  return normalizeWorshipTemplate(await requestJson<WorshipTemplate>(`${getApiV1BaseUrl()}/admin/worship-templates`, {
    method: "POST",
    body: JSON.stringify(buildWorshipTemplatePayload(payload)),
  }));
}

export async function updateWorshipTemplate(
  templateId: string,
  payload: {
    serviceKind: string;
    displayName: string;
    startTime: string;
    generationRule: string;
    defaultSections: Array<Record<string, unknown>>;
    isActive: boolean;
  },
): Promise<WorshipTemplate> {
  return normalizeWorshipTemplate(await requestJson<WorshipTemplate>(`${getApiV1BaseUrl()}/admin/worship-templates/${templateId}`, {
    method: "PUT",
    body: JSON.stringify(buildWorshipTemplatePayload(payload)),
  }));
}

export async function deleteWorshipTemplate(templateId: string): Promise<void> {
  const response = await fetch(`${getApiV1BaseUrl()}/admin/worship-templates/${templateId}`, {
    method: "DELETE",
    credentials: "include",
  });
  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }
}

export async function listWorshipSectionTypes(): Promise<WorshipSectionTypeDefinition[]> {
  const response = await fetch(`${getApiV1BaseUrl()}/admin/worship-section-types`, {
    cache: "no-store",
    credentials: "include",
  });
  return handleResponse<WorshipSectionTypeDefinition[]>(response);
}

export async function createWorshipSectionType(
  payload: WorshipSectionTypeDefinitionUpsert,
): Promise<WorshipSectionTypeDefinition> {
  return requestJson<WorshipSectionTypeDefinition>(`${getApiV1BaseUrl()}/admin/worship-section-types`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateWorshipSectionType(
  code: string,
  payload: WorshipSectionTypeDefinitionUpsert,
): Promise<WorshipSectionTypeDefinition> {
  return requestJson<WorshipSectionTypeDefinition>(`${getApiV1BaseUrl()}/admin/worship-section-types/${code}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function deleteWorshipSectionType(code: string): Promise<void> {
  const response = await fetch(`${getApiV1BaseUrl()}/admin/worship-section-types/${code}`, {
    method: "DELETE",
    credentials: "include",
  });
  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }
}

export async function listWorshipInputTemplates(): Promise<WorshipInputTemplate[]> {
  const response = await fetch(`${getApiV1BaseUrl()}/admin/worship-input-templates`, {
    cache: "no-store",
    credentials: "include",
  });
  return handleResponse<WorshipInputTemplate[]>(response);
}

export async function createWorshipInputTemplate(payload: WorshipInputTemplateUpsert): Promise<WorshipInputTemplate> {
  return requestJson<WorshipInputTemplate>(`${getApiV1BaseUrl()}/admin/worship-input-templates`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateWorshipInputTemplate(
  templateId: string,
  payload: WorshipInputTemplateUpsert,
): Promise<WorshipInputTemplate> {
  return requestJson<WorshipInputTemplate>(`${getApiV1BaseUrl()}/admin/worship-input-templates/${templateId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function deleteWorshipInputTemplate(templateId: string): Promise<void> {
  const response = await fetch(`${getApiV1BaseUrl()}/admin/worship-input-templates/${templateId}`, {
    method: "DELETE",
    credentials: "include",
  });
  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }
}

export async function listWorshipSlideTemplates(): Promise<WorshipSlideTemplate[]> {
  const response = await fetch(`${getApiV1BaseUrl()}/admin/worship-slide-templates`, {
    cache: "no-store",
    credentials: "include",
  });
  return handleResponse<WorshipSlideTemplate[]>(response);
}

export async function createWorshipSlideTemplate(payload: WorshipSlideTemplateUpsert): Promise<WorshipSlideTemplate> {
  return requestJson<WorshipSlideTemplate>(`${getApiV1BaseUrl()}/admin/worship-slide-templates`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateWorshipSlideTemplate(
  key: string,
  payload: WorshipSlideTemplateUpsert,
): Promise<WorshipSlideTemplate> {
  return requestJson<WorshipSlideTemplate>(`${getApiV1BaseUrl()}/admin/worship-slide-templates/${key}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function deleteWorshipSlideTemplate(key: string): Promise<void> {
  const response = await fetch(`${getApiV1BaseUrl()}/admin/worship-slide-templates/${key}`, {
    method: "DELETE",
    credentials: "include",
  });
  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }
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
