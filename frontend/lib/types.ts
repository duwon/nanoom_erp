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
  worshipRoles: string[];
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
  worshipRoles?: string[];
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

export type WorshipStatus = "waiting" | "progress" | "review" | "complete";
export type WorshipSectionType = string;
export type WorshipWorkspaceBucket = "music" | "content";
export type WorshipFieldType =
  | "title"        // section.title (한 줄 텍스트)
  | "song_search"  // section.title (곡 검색 UI)
  | "detail"       // section.detail (여러 줄 텍스트)
  | "notes"        // section.notes (여러 줄 텍스트)
  | "lyrics"       // 슬라이드 자동 생성 (가사 입력)
  | "scripture"    // 성경 조회 + 슬라이드 생성, section.detail에도 저장
  | "textarea"     // 일반 여러 줄 텍스트 (content만 저장)
  | "text";        // 하위 호환 (title과 동일하게 처리)
export type WorshipGenerationRule = "daily" | "sunday" | "wednesday" | "friday";

export type WorshipSlide = {
  id: string;
  label: string;
  lines: string[];
  slideTemplateKey: string;
  templateKey?: string;
  aspectRatio: string;
  notes: string;
};

export type WorshipSectionCapabilities = {
  canEdit: boolean;
  canAssign: boolean;
  canShare: boolean;
  canAddSiblingSong: boolean;
  canRemove: boolean;
};

export type WorshipSection = {
  id: string;
  order: number;
  sectionTypeCode: WorshipSectionType;
  sectionType: WorshipSectionType;
  workspaceBucket?: WorshipWorkspaceBucket;
  title: string;
  detail: string;
  role: string;
  assigneeId: string | null;
  assigneeName: string | null;
  status: WorshipStatus;
  durationMinutes: number;
  dueOffsetMinutes?: number;
  inputTemplateId?: string;
  slideTemplateKey: string;
  templateKey: string;
  notes: string;
  content: Record<string, unknown>;
  slides: WorshipSlide[];
  capabilities: WorshipSectionCapabilities;
  updatedAt: string;
};

export type WorshipTaskFieldSpec = {
  key: string;
  label: string;
  fieldType: WorshipFieldType;
  required: boolean;
  helpText: string;
};

export type WorshipGuestAccess = {
  tokenHash: string | null;
  issuedAt: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
  lastOpenedAt: string | null;
};

export type WorshipTask = {
  id: string;
  sectionId: string;
  inputTemplateId?: string;
  role: string;
  scope: string;
  requiredFields: WorshipTaskFieldSpec[];
  status: WorshipStatus;
  dueAt: string | null;
  tips: string;
  guestAccess: WorshipGuestAccess;
  lastSubmittedAt: string | null;
  values?: Record<string, unknown>;
};

export type WorshipReviewSummary = {
  totalSections: number;
  completeSections: number;
  progressSections: number;
  waitingSections: number;
  reviewSections: number;
  pendingReviewCount: number;
  pendingTaskCount: number;
};

export type WorshipTemplateSectionPreset = {
  id: string;
  order: number;
  sectionTypeCode?: WorshipSectionType;
  sectionType: WorshipSectionType;
  title: string;
  detail: string;
  role: string;
  assigneeName: string | null;
  durationMinutes: number;
  dueOffsetMinutes?: number;
  inputTemplateId?: string;
  slideTemplateKey?: string;
  workspaceBucket?: WorshipWorkspaceBucket;
  templateKey: string;
  notes: string;
  content: Record<string, unknown>;
};

export type WorshipTemplatePreset = {
  key: string;
  label: string;
  description: string;
};

export type WorshipTaskPreset = {
  id: string;
  role: string;
  scope: string;
  sectionIds: string[];
  requiredFields: WorshipTaskFieldSpec[];
  dueOffsetMinutes: number;
  tips: string;
};

export type WorshipSectionTypeDefinition = {
  code: string;
  label: string;
  description: string;
  workspaceBucket: WorshipWorkspaceBucket;
  defaultTitle: string;
  defaultRole: string;
  defaultDurationMinutes: number;
  defaultDueOffsetMinutes: number;
  defaultInputTemplateId: string;
  defaultSlideTemplateKey: string;
  isActive: boolean;
  sortOrder: number;
  usageCount: number;
};

export type WorshipSectionTypeDefinitionUpsert = Omit<WorshipSectionTypeDefinition, "usageCount">;

export type WorshipInputTemplate = {
  id: string;
  label: string;
  description: string;
  tips: string;
  fields: WorshipTaskFieldSpec[];
  isActive: boolean;
  usageCount: number;
  createdAt: string;
  updatedAt: string;
};

export type WorshipInputTemplateUpsert = Omit<WorshipInputTemplate, "usageCount" | "createdAt" | "updatedAt">;

export type WorshipSlideTemplate = {
  key: string;
  label: string;
  description: string;
  isActive: boolean;
  usageCount: number;
  createdAt: string;
  updatedAt: string;
};

export type WorshipSlideTemplateUpsert = Omit<WorshipSlideTemplate, "usageCount" | "createdAt" | "updatedAt">;

export type WorshipTemplate = {
  id: string;
  serviceKind: string;
  displayName: string;
  startTime: string;
  generationRule: WorshipGenerationRule;
  defaultSections: WorshipTemplateSectionPreset[];
  taskPresets: WorshipTaskPreset[];
  templatePresets: WorshipTemplatePreset[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type WorshipCalendarService = {
  id: string;
  serviceKind: string;
  serviceName: string;
  startAt: string;
  status: WorshipStatus;
  reviewSummary: WorshipReviewSummary;
};

export type WorshipCalendarTemplateOption = {
  templateId: string;
  serviceKind: string;
  displayName: string;
  startTime: string;
};

export type WorshipCalendarDay = {
  date: string;
  dateLabel: string;
  weekdayLabel: string;
  services: WorshipCalendarService[];
  availableTemplates: WorshipCalendarTemplateOption[];
};

export type WorshipCalendarResponse = {
  anchorDate: string;
  days: WorshipCalendarDay[];
  defaultServiceId: string | null;
};

export type WorshipServiceMetadata = {
  createdAt: string;
  updatedAt: string;
};

export type WorshipServiceDetail = {
  id: string;
  date: string;
  serviceKind: string;
  serviceName: string;
  startAt: string;
  summary: string;
  templateId: string;
  version: number;
  status: WorshipStatus;
  sections: WorshipSection[];
  tasks: WorshipTask[];
  reviewSummary: WorshipReviewSummary;
  exportSnapshot: Record<string, unknown>;
  metadata: WorshipServiceMetadata;
};

export type WorshipGuestLinkResponse = {
  taskId: string;
  token: string;
  inputUrl: string;
  expiresAt: string | null;
};

export type WorshipGuestTaskView = {
  taskId: string;
  sectionId: string;
  serviceId: string;
  serviceName: string;
  date: string;
  role: string;
  scope: string;
  dueAt: string | null;
  tips: string;
  status: WorshipStatus;
  requiredFields: WorshipTaskFieldSpec[];
  values: Record<string, unknown>;
};

export type ActiveUserSummary = {
  id: string;
  name: string | null;
  department: string | null;
  position: string | null;
  worshipRoles: string[];
};

export type WorshipSongLookupItem = {
  id: string;
  title: string;
  artist: string;
  recentUseCount: number;
  tags: string[];
};

export type WorshipScriptureLookupResponse = {
  reference: string;
  text: string;
  translation: string;
  slides: WorshipSlide[];
};

export type WorshipReviewItem = {
  sectionId: string;
  order: number;
  title: string;
  detail: string;
  status: WorshipStatus;
  slideTemplateKey: string;
  templateKey?: string;
  notes: string;
};

export type WorshipPresentationPreview = {
  serviceId: string;
  serviceName: string;
  generatedAt: string;
  sections: WorshipSection[];
};

export type WorshipReviewResponse = {
  service: WorshipServiceDetail;
  items: WorshipReviewItem[];
  preview: WorshipPresentationPreview;
};

export type WorshipPresentationState = {
  serviceId: string | null;
  activeSectionId: string | null;
  title: string;
  content: string;
  updatedAt: string | null;
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
