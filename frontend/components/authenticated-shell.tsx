"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";

import { SignOutButton } from "@/components/sign-out-button";
import type { AuthUser, UserRole } from "@/lib/types";

type NavItem = {
  href: string;
  label: string;
  description: string;
  roles: UserRole[];
  exact?: boolean;
};

type NavSection = {
  label: string;
  items: NavItem[];
};

const NAV_SECTIONS: NavSection[] = [
  {
    label: "대시보드",
    items: [
      {
        href: "/dashboard",
        label: "개요",
        description: "매일 시작하는 화면",
        roles: ["master", "final_approver", "editor", "member"],
        exact: true,
      },
    ],
  },
  {
    label: "문서 관리",
    items: [
      {
        href: "/udms/documents",
        label: "문서",
        description: "파일과 버전 관리",
        roles: ["master", "final_approver", "editor", "member"],
      },
      {
        href: "/udms/boards",
        label: "게시판",
        description: "게시 기준과 노출 규칙",
        roles: ["master", "final_approver", "editor", "member"],
      },
      {
        href: "/udms/shares",
        label: "공유",
        description: "협업과 공유 범위",
        roles: ["master", "final_approver", "editor", "member"],
      },
      {
        href: "/udms/approvals",
        label: "결재",
        description: "검토와 승인 대기열",
        roles: ["master", "final_approver", "editor", "member"],
      },
      {
        href: "/udms/permissions",
        label: "권한",
        description: "접근 제어",
        roles: ["master", "final_approver", "editor", "member"],
      },
    ],
  },
  {
    label: "예배",
    items: [
      {
        href: "/worship/orders",
        label: "예배 순서",
        description: "예배 순서를 준비",
        roles: ["master", "final_approver", "editor", "member"],
      },
      {
        href: "/worship/subtitles/input",
        label: "자막 입력",
        description: "자막 내용을 작성",
        roles: ["master", "final_approver", "editor", "member"],
      },
      {
        href: "/worship/subtitles/output",
        label: "자막 출력",
        description: "디스플레이로 송출",
        roles: ["master", "final_approver", "editor", "member"],
      },
      {
        href: "/worship/contents",
        label: "콘텐츠",
        description: "미디어 자료",
        roles: ["master", "final_approver", "editor", "member"],
      },
    ],
  },
  {
    label: "관리자",
    items: [
      {
        href: "/admin",
        label: "관리자 홈",
        description: "관리자 개요",
        roles: ["master"],
        exact: true,
      },
      {
        href: "/admin/users",
        label: "사용자",
        description: "사용자 관리",
        roles: ["master"],
      },
      {
        href: "/admin/permissions",
        label: "권한",
        description: "정책 관리",
        roles: ["master"],
      },
      {
        href: "/admin/boards",
        label: "게시판",
        description: "게시판 관리",
        roles: ["master"],
      },
      {
        href: "/admin/worship-templates",
        label: "예배 템플릿",
        description: "예배용 템플릿",
        roles: ["master"],
      },
    ],
  },
];

function formatRole(role: UserRole) {
  switch (role) {
    case "master":
      return "관리자";
    case "final_approver":
      return "최종 승인자";
    case "editor":
      return "편집자";
    case "member":
      return "일반 사용자";
  }
}

function formatStatus(status: AuthUser["status"]) {
  switch (status) {
    case "pending":
      return "승인 대기";
    case "active":
      return "활성";
    case "blocked":
      return "차단";
  }
}

function getVisibleSections(role: UserRole) {
  return NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => item.roles.includes(role)),
  })).filter((section) => section.items.length > 0);
}

function isActivePath(pathname: string, item: NavItem) {
  if (item.exact) {
    return pathname === item.href;
  }
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

function findActiveItem(pathname: string, sections: NavSection[]) {
  for (const section of sections) {
    const activeItem = section.items.find((item) => isActivePath(pathname, item));
    if (activeItem) {
      return { section: section.label, item: activeItem };
    }
  }
  return null;
}

export function AuthenticatedShell({
  user,
  children,
}: {
  user: AuthUser;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const sections = useMemo(() => getVisibleSections(user.role), [user.role]);
  const active = useMemo(() => findActiveItem(pathname, sections), [pathname, sections]);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const userLabel = user.name ?? user.email;
  const currentSection = active?.section ?? "대시보드";
  const currentItem = active?.item.label ?? "개요";

  return (
    <div className="min-h-screen">
      <div className="lg:flex">
        <div
          className={`fixed inset-0 z-40 bg-slate-950/40 transition-opacity lg:hidden ${
            mobileOpen ? "opacity-100" : "pointer-events-none opacity-0"
          }`}
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />

        <aside
          className={`fixed inset-y-0 left-0 z-50 w-80 border-r border-slate-200 bg-white/95 shadow-glow backdrop-blur-xl transition-transform duration-200 lg:translate-x-0 ${
            mobileOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="flex h-full flex-col">
            <div className="border-b border-slate-200 px-6 py-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.3em] text-amber-700">
                    나눔 업무 시스템
                  </p>
                  <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight text-slate-900">
                    인증 쉘
                  </h1>
                </div>
                <button
                  type="button"
                  className="rounded-full border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 lg:hidden"
                  onClick={() => setMobileOpen(false)}
                >
                  닫기
                </button>
              </div>

              <div className="mt-5 rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                  현재 사용자
                </p>
                <p className="mt-2 text-sm font-semibold text-slate-900">{userLabel}</p>
                <p className="mt-1 text-sm text-slate-600">{user.email}</p>
                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                  <span className="rounded-full bg-white px-3 py-1 font-medium text-slate-700">
                    {formatRole(user.role)}
                  </span>
                  <span className="rounded-full bg-white px-3 py-1 font-medium text-slate-700">
                    {formatStatus(user.status)}
                  </span>
                </div>
              </div>
            </div>

            <nav className="flex-1 space-y-6 overflow-y-auto px-4 py-5">
              {sections.map((section) => (
                <section key={section.label} className="space-y-3">
                  <p className="px-2 text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
                    {section.label}
                  </p>
                  <div className="grid gap-1">
                    {section.items.map((item) => {
                      const activeItem = isActivePath(pathname, item);

                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          className={`rounded-[20px] border px-4 py-3 text-left transition ${
                            activeItem
                              ? "border-amber-300 bg-amber-50 text-slate-900 shadow-sm"
                              : "border-transparent text-slate-600 hover:border-slate-200 hover:bg-slate-50 hover:text-slate-900"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <span className="font-medium">{item.label}</span>
                            {activeItem ? (
                              <span className="rounded-full bg-white px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-amber-700">
                                현재
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-1 text-xs leading-5 text-slate-500">{item.description}</p>
                        </Link>
                      );
                    })}
                  </div>
                </section>
              ))}
            </nav>

            <div className="border-t border-slate-200 p-4">
              <div className="rounded-[24px] border border-slate-200 bg-white px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                  세션
                </p>
                <p className="mt-2 text-sm text-slate-700">
                  {currentSection} / {currentItem}
                </p>
                <div className="mt-4">
                  <SignOutButton className="w-full rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white" />
                </div>
              </div>
            </div>
          </div>
        </aside>

        <div className="min-h-screen flex-1 lg:pl-80">
          <header className="sticky top-0 z-30 border-b border-white/60 bg-white/80 backdrop-blur-xl">
            <div className="flex items-center justify-between gap-4 px-4 py-4 md:px-6 lg:px-8">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 lg:hidden"
                  onClick={() => setMobileOpen(true)}
                >
                  메뉴
                </button>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.3em] text-amber-700">
                    {currentSection}
                  </p>
                  <h2 className="mt-1 text-lg font-semibold text-slate-900">
                    {currentSection} / {currentItem}
                  </h2>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="hidden rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-600 md:block">
                  {userLabel}
                </div>
                <SignOutButton className="hidden rounded-full border border-slate-300 bg-white px-5 py-3 text-sm font-medium text-slate-700 md:inline-flex" />
              </div>
            </div>
          </header>

          <main className="px-4 py-6 md:px-6 lg:px-8">
            <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">{children}</div>
          </main>
        </div>
      </div>
    </div>
  );
}
