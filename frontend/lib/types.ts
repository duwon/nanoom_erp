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
