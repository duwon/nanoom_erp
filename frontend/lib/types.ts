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

export type ApprovalTemplate = {
  id: string;
  name: string;
  description: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type DocumentTargetType = string;

export type TargetTypeDescriptor = {
  targetType: string;
  label: string;
  namespace: string;
  deepLinkTemplate: string;
  requiresExistingParent: boolean;
  documentTitleHint: string | null;
  isEnabled: boolean;
};

export type DocumentStatus = "draft" | "published" | "locked" | "archived";
export type PermissionSubjectType = "role" | "department" | "user";
export type TargetPolicyAction = "read" | "create" | "manage";
export type DocumentAclAction = "read" | "edit" | "manage" | "publish";
export type DocumentAclEffect = "allow" | "deny";
export type DocumentEditorType = "tiptap";

export type DocumentHeader = {
  title: string;
  category: string;
  tags: string[];
  authorId: string | null;
};

export type DocumentLink = {
  targetType: DocumentTargetType;
  targetId: string;
  deepLink: string | null;
};

export type DocumentAttachment = {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  storageKey: string;
  version: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

export type DocumentRevision = {
  id: string;
  documentId: string;
  version: number;
  header: DocumentHeader;
  body: string | null;
  summary: string;
  editorType: DocumentEditorType;
  attachments: DocumentAttachment[];
  moduleData: Record<string, unknown>;
  changeLog: string;
  createdBy: string;
  createdAt: string;
  isCurrent: boolean;
  isPublished: boolean;
};

export type DocumentMetadata = {
  version: number;
  isDeleted: boolean;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type DocumentState = {
  status: DocumentStatus;
};

export type DocumentAclRule = {
  subjectType: PermissionSubjectType;
  subjectId: string;
  actions: DocumentAclAction[];
  effect: DocumentAclEffect;
};

export type ExternalShareLink = {
  id: string;
  label: string;
  token: string;
  expiresAt: string | null;
  canDownload: boolean;
  createdBy: string;
  createdAt: string;
};

export type DocumentSecurity = {
  acl: DocumentAclRule[];
  externalShares: ExternalShareLink[];
};

export type DocumentSecuritySummary = {
  aclCount: number;
  externalShareCount: number;
  hasDenyRules: boolean;
};

export type DocumentCapabilities = {
  effectiveActions: string[];
  canRead: boolean;
  canEditWorkingCopy: boolean;
  canPublish: boolean;
  canManageSecurity: boolean;
  canCreateWorkingCopy: boolean;
};

export type DocumentSummary = {
  id: string;
  header: DocumentHeader;
  link: DocumentLink;
  state: DocumentState;
  metadata: DocumentMetadata;
  currentRevision: DocumentRevision;
  publishedRevision: DocumentRevision | null;
  workingRevision: DocumentRevision | null;
  securitySummary: DocumentSecuritySummary;
  moduleData: Record<string, unknown>;
  capabilities: DocumentCapabilities;
};

export type DocumentDetail = DocumentSummary & {
  security: DocumentSecurity;
};

export type SharedDocumentRow = {
  document: DocumentSummary;
  accessSource: string;
};

export type ExternalShareRow = {
  documentId: string;
  documentTitle: string;
  link: ExternalShareLink;
  targetType: DocumentTargetType;
  targetId: string;
};

export type SharedDocumentsOverview = {
  accessible: SharedDocumentRow[];
  externalLinks: ExternalShareRow[];
};

export type TargetPolicyRule = {
  id: string;
  targetType: DocumentTargetType;
  targetId: string;
  subjectType: PermissionSubjectType;
  subjectId: string;
  actions: TargetPolicyAction[];
  createdAt: string;
  updatedAt: string;
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
