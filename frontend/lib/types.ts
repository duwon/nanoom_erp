export type SocialProvider = "google" | "kakao";

export type UserRole = "master" | "final_approver" | "editor" | "member";

export type UserStatus = "pending" | "active" | "blocked";

export type AuthUser = {
  id: string;
  email: string;
  socialProvider: SocialProvider;
  providerUserId: string;
  role: UserRole;
  status: UserStatus;
  name: string | null;
  position: string | null;
  department: string | null;
  approvedAt: string | null;
  approvedBy: string | null;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type UserProfileUpdate = {
  name: string;
  position: string;
  department: string;
};

export type AdminUserUpdate = {
  role?: UserRole;
  status?: UserStatus;
};

export type LookupEntry = {
  code: string;
  name: string;
};

export type Board = {
  id: string;
  name: string;
  description: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type DocumentStatus = "draft" | "published" | "superseded";
export type SharePermission = "read" | "edit";
export type ShareTargetType = "user" | "department";
export type BoardPermissionAction = "read" | "create" | "manage";
export type PermissionSubjectType = "role" | "department" | "user";

export type ApprovalTemplate = {
  id: string;
  name: string;
  description: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type DocumentShare = {
  id: string;
  docId: string;
  targetType: ShareTargetType;
  targetId: string;
  permission: SharePermission;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

export type DocumentAttachment = {
  id: string;
  docId: string;
  storageKey: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

export type UdmsDocumentSummary = {
  id: string;
  originDocId: string;
  prevDocId: string | null;
  versionNumber: number;
  boardId: string;
  title: string;
  content: string;
  status: DocumentStatus;
  approvalTemplateId: string | null;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
};

export type UdmsDocumentDetail = UdmsDocumentSummary & {
  attachments: DocumentAttachment[];
  shares: DocumentShare[];
};

export type BoardPermissionRule = {
  id: string;
  boardId: string;
  subjectType: PermissionSubjectType;
  subjectId: string;
  actions: BoardPermissionAction[];
  createdAt: string;
  updatedAt: string;
};

export type SharedDocumentSummary = {
  share: DocumentShare;
  document: UdmsDocumentSummary;
  direction: "received" | "sent";
};

export type SharedDocumentOverview = {
  received: SharedDocumentSummary[];
  sent: SharedDocumentSummary[];
};

export type OrderItem = {
  id: string;
  title: string;
  order: number;
  content: string;
  isActive: boolean;
  updatedAt: string;
};

export type DisplayState = {
  activeItemId: string | null;
  title: string;
  content: string;
  updatedAt: string | null;
};
