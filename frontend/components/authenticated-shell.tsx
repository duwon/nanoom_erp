"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";

import { SignOutButton } from "@/components/sign-out-button";
import type { AuthUser, UserRole } from "@/lib/types";

type NavItem = {
  id: string;
  href: string;
  label: string;
  description: string;
  exact?: boolean;
};

type NavGroup = {
  id: string;
  label: string;
  items: NavItem[];
};

type NavModule = {
  id: "dashboard" | "udms" | "worship" | "admin";
  label: string;
  description: string;
  roles: UserRole[];
  defaultHref: string;
  homeLabel: string;
  matchPrefixes: string[];
  groups: NavGroup[];
};

type ActiveLocation = {
  module: NavModule;
  group: NavGroup | null;
  item: NavItem | null;
  itemLabel: string;
};

const NAV_MODULES: NavModule[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    description: "오늘 처리할 일과 바로가기를 모아보는 시작 화면",
    roles: ["master", "final_approver", "editor", "member"],
    defaultHref: "/dashboard",
    homeLabel: "대시보드 홈",
    matchPrefixes: ["/dashboard"],
    groups: [
      {
        id: "dashboard-overview",
        label: "개요",
        items: [
          {
            id: "dashboard-home",
            href: "/dashboard",
            label: "대시보드 홈",
            description: "전체 상태와 빠른 실행을 확인합니다.",
            exact: true,
          },
        ],
      },
      {
        id: "dashboard-work",
        label: "나의 업무",
        items: [
          {
            id: "dashboard-approvals",
            href: "/udms/approvals",
            label: "결재",
            description: "검토와 승인 대기열로 이동합니다.",
          },
          {
            id: "dashboard-orders",
            href: "/worship",
            label: "오늘의 예배",
            description: "오늘 준비할 예배 흐름을 확인합니다.",
          },
        ],
      },
      {
        id: "dashboard-shortcuts",
        label: "바로가기",
        items: [
          {
            id: "dashboard-documents",
            href: "/udms/documents",
            label: "문서",
            description: "최근 문서와 파일 공간으로 이동합니다.",
          },
          {
            id: "dashboard-subtitles",
            href: "/worship/review",
            label: "검수 / 송출",
            description: "검수와 송출 상태를 바로 확인합니다.",
          },
        ],
      },
    ],
  },
  {
    id: "udms",
    label: "UDMS",
    description: "문서, 게시판, 공유, 결재를 묶는 문서 작업 공간",
    roles: ["master", "final_approver", "editor", "member"],
    defaultHref: "/udms/documents",
    homeLabel: "문서",
    matchPrefixes: ["/udms"],
    groups: [
      {
        id: "udms-space",
        label: "문서 공간",
        items: [
          {
            id: "udms-documents",
            href: "/udms/documents",
            label: "문서",
            description: "파일과 버전 관리를 진행합니다.",
          },
          {
            id: "udms-boards",
            href: "/udms/boards",
            label: "게시판",
            description: "게시 기준과 노출 규칙을 다룹니다.",
          },
        ],
      },
      {
        id: "udms-collaboration",
        label: "협업",
        items: [
          {
            id: "udms-shares",
            href: "/udms/shares",
            label: "공유",
            description: "협업과 공유 범위를 설정합니다.",
          },
          {
            id: "udms-approvals",
            href: "/udms/approvals",
            label: "결재",
            description: "검토와 승인 흐름을 처리합니다.",
          },
        ],
      },
      {
        id: "udms-policy",
        label: "정책",
        items: [
          {
            id: "udms-permissions",
            href: "/udms/permissions",
            label: "권한",
            description: "접근 제어 기준을 관리합니다.",
          },
        ],
      },
    ],
  },
  {
    id: "worship",
    label: "Worship",
    description: "예배 준비, 자막 운영, 자료 관리를 묶는 예배 작업 공간",
    roles: ["master", "final_approver", "editor", "member"],
    defaultHref: "/worship",
    homeLabel: "예배 대시보드",
    matchPrefixes: ["/worship"],
    groups: [
      {
        id: "worship-overview",
        label: "운영 개요",
        items: [
          {
            id: "worship-home",
            href: "/worship",
            label: "대시보드",
            description: "날짜와 예배 기준으로 운영 현황을 확인합니다.",
          },
        ],
      },
      {
        id: "worship-assignees",
        label: "담당자 입력",
        items: [
          {
            id: "worship-assignees-page",
            href: "/worship/assignees",
            label: "담당자 입력함",
            description: "역할별 입력 링크와 상태를 관리합니다.",
          },
        ],
      },
      {
        id: "worship-content",
        label: "콘텐츠 준비",
        items: [
          {
            id: "worship-songs",
            href: "/worship/songs",
            label: "찬양 / 특송",
            description: "곡 가사와 슬라이드를 준비합니다.",
          },
          {
            id: "worship-message",
            href: "/worship/message",
            label: "성경 / 말씀",
            description: "본문과 설교 포인트를 정리합니다.",
          },
        ],
      },
      {
        id: "worship-review",
        label: "검수 / 송출",
        items: [
          {
            id: "worship-review-page",
            href: "/worship/review",
            label: "출력 / 검수",
            description: "검수 리스트와 display 송출을 관리합니다.",
          },
        ],
      },
    ],
  },
  {
    id: "admin",
    label: "Admin",
    description: "사용자, 권한, 게시판, 예배 템플릿을 다루는 운영 공간",
    roles: ["master"],
    defaultHref: "/admin",
    homeLabel: "관리자 홈",
    matchPrefixes: ["/admin"],
    groups: [
      {
        id: "admin-users",
        label: "사용자 운영",
        items: [
          {
            id: "admin-users-list",
            href: "/admin/users",
            label: "사용자",
            description: "사용자와 승인 상태를 관리합니다.",
          },
          {
            id: "admin-permissions",
            href: "/admin/permissions",
            label: "권한",
            description: "권한과 정책 기준을 설정합니다.",
          },
        ],
      },
      {
        id: "admin-content",
        label: "콘텐츠 운영",
        items: [
          {
            id: "admin-boards",
            href: "/admin/boards",
            label: "게시판",
            description: "게시판과 노출 규칙을 관리합니다.",
          },
        ],
      },
      {
        id: "admin-worship",
        label: "예배 운영",
        items: [
          {
            id: "admin-worship-templates",
            href: "/admin/worship-templates",
            label: "예배 템플릿",
            description: "예배용 템플릿을 관리합니다.",
          },
        ],
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

function matchesPrefix(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

function isActivePath(pathname: string, item: NavItem) {
  if (item.exact) {
    return pathname === item.href;
  }
  return matchesPrefix(pathname, item.href);
}

function getVisibleModules(role: UserRole) {
  return NAV_MODULES.filter((module) => module.roles.includes(role));
}

function findActiveModule(pathname: string, modules: NavModule[]) {
  return modules.find((module) =>
    module.matchPrefixes.some((prefix) => matchesPrefix(pathname, prefix)),
  );
}

function findActiveLocation(pathname: string, modules: NavModule[]): ActiveLocation {
  const activeModule = findActiveModule(pathname, modules) ?? modules[0];
  if (!activeModule) {
    throw new Error("No visible modules available for authenticated shell.");
  }

  for (const group of activeModule.groups) {
    const activeItem = group.items.find((item) => isActivePath(pathname, item));
    if (activeItem) {
      return {
        module: activeModule,
        group,
        item: activeItem,
        itemLabel: activeItem.label,
      };
    }
  }

  return {
    module: activeModule,
    group: null,
    item: null,
    itemLabel: activeModule.homeLabel,
  };
}

export function AuthenticatedShell({
  user,
  children,
}: {
  user: AuthUser;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileModulesOpen, setMobileModulesOpen] = useState(false);

  const visibleModules = useMemo(() => getVisibleModules(user.role), [user.role]);
  const activeLocation = useMemo(
    () => findActiveLocation(pathname, visibleModules),
    [pathname, visibleModules],
  );
  const [openGroupId, setOpenGroupId] = useState<string | null>(
    activeLocation.group?.id ?? activeLocation.module.groups[0]?.id ?? null,
  );

  useEffect(() => {
    setMobileMenuOpen(false);
    setMobileModulesOpen(false);
  }, [pathname]);

  useEffect(() => {
    setOpenGroupId(activeLocation.group?.id ?? activeLocation.module.groups[0]?.id ?? null);
  }, [activeLocation.group?.id, activeLocation.module.id, activeLocation.module.groups]);

  const userLabel = user.name ?? user.email;
  const activeModule = activeLocation.module;
  const activeItemLabel = activeLocation.itemLabel;
  const hasMobilePanelOpen = mobileMenuOpen || mobileModulesOpen;

  function toggleMobileMenu() {
    setMobileModulesOpen(false);
    setMobileMenuOpen((current) => !current);
  }

  function toggleMobileModules() {
    setMobileMenuOpen(false);
    setMobileModulesOpen((current) => !current);
  }

  return (
    <div className="min-h-screen">
      <div
        className={`fixed inset-0 z-40 bg-slate-950/40 transition-opacity lg:hidden ${
          hasMobilePanelOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={() => {
          setMobileMenuOpen(false);
          setMobileModulesOpen(false);
        }}
        aria-hidden="true"
      />

      <div
        className={`fixed inset-x-4 top-20 z-50 rounded-[28px] border border-slate-200 bg-white/95 p-4 shadow-glow backdrop-blur-xl transition-all duration-200 lg:hidden ${
          mobileModulesOpen
            ? "translate-y-0 opacity-100"
            : "pointer-events-none -translate-y-3 opacity-0"
        }`}
      >
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-amber-700">
              Global Modules
            </p>
            <h2 className="mt-1 text-lg font-semibold text-slate-900">모듈 선택</h2>
          </div>
          <button
            type="button"
            className="rounded-full border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600"
            onClick={() => setMobileModulesOpen(false)}
          >
            닫기
          </button>
        </div>

        <div className="mt-4 grid gap-3">
          {visibleModules.map((module) => {
            const moduleIsActive = activeModule.id === module.id;

            return (
              <Link
                key={module.id}
                href={module.defaultHref}
                className={`rounded-[24px] border px-4 py-4 transition ${
                  moduleIsActive
                    ? "border-amber-300 bg-amber-50 text-slate-900"
                    : "border-slate-200 bg-white text-slate-700 hover:border-amber-200 hover:bg-amber-50/60"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="font-semibold">{module.label}</span>
                  {moduleIsActive ? (
                    <span className="rounded-full bg-white px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-amber-700">
                      현재
                    </span>
                  ) : null}
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-600">{module.description}</p>
              </Link>
            );
          })}
        </div>
      </div>

      <div className="lg:flex">
        <aside
          className={`fixed inset-y-0 left-0 z-50 w-80 border-r border-slate-200 bg-white/95 shadow-glow backdrop-blur-xl transition-transform duration-200 lg:translate-x-0 ${
            mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="flex h-full flex-col">
            <div className="border-b border-slate-200 px-6 py-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.3em] text-amber-700">
                    Contextual Menu
                  </p>
                  <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight text-slate-900">
                    {activeModule.label}
                  </h1>
                  <p className="mt-3 text-sm leading-6 text-slate-600">{activeModule.description}</p>
                </div>
                <button
                  type="button"
                  className="rounded-full border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 lg:hidden"
                  onClick={() => setMobileMenuOpen(false)}
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
                <Link
                  href={activeModule.defaultHref}
                  className="mt-4 inline-flex rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700"
                >
                  {activeModule.homeLabel}
                </Link>
              </div>
            </div>

            <nav className="flex-1 space-y-4 overflow-y-auto px-4 py-5">
              {activeModule.groups.map((group) => {
                const expanded = openGroupId === group.id;
                const groupIsActive = activeLocation.group?.id === group.id;

                return (
                  <section key={group.id} className="rounded-[24px] border border-slate-200 bg-white/70 p-2">
                    <button
                      type="button"
                      className={`flex w-full items-center justify-between rounded-[18px] px-4 py-3 text-left transition ${
                        groupIsActive
                          ? "bg-amber-50 text-slate-900"
                          : "text-slate-700 hover:bg-slate-50"
                      }`}
                      onClick={() => setOpenGroupId(group.id)}
                    >
                      <div>
                        <p className="text-sm font-semibold">{group.label}</p>
                        <p className="mt-1 text-xs leading-5 text-slate-500">
                          {group.items.length}개 메뉴
                        </p>
                      </div>
                      <span className="text-sm font-semibold text-slate-400">
                        {expanded ? "−" : "+"}
                      </span>
                    </button>

                    {expanded ? (
                      <div className="mt-2 grid gap-1">
                        {group.items.map((item) => {
                          const itemIsActive = isActivePath(pathname, item);

                          return (
                            <Link
                              key={item.id}
                              href={item.href}
                              className={`rounded-[18px] border px-4 py-3 text-left transition ${
                                itemIsActive
                                  ? "border-amber-300 bg-amber-50 text-slate-900 shadow-sm"
                                  : "border-transparent text-slate-600 hover:border-slate-200 hover:bg-slate-50 hover:text-slate-900"
                              }`}
                            >
                              <div className="flex items-center justify-between gap-3">
                                <span className="font-medium">{item.label}</span>
                                {itemIsActive ? (
                                  <span className="rounded-full bg-white px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-amber-700">
                                    현재
                                  </span>
                                ) : null}
                              </div>
                              <p className="mt-1 text-xs leading-5 text-slate-500">
                                {item.description}
                              </p>
                            </Link>
                          );
                        })}
                      </div>
                    ) : null}
                  </section>
                );
              })}
            </nav>

            <div className="border-t border-slate-200 p-4">
              <div className="rounded-[24px] border border-slate-200 bg-white px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                  세션
                </p>
                <p className="mt-2 text-sm text-slate-700">
                  {activeModule.label} / {activeItemLabel}
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
            <div className="px-4 py-4 md:px-6 lg:px-8">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 lg:hidden"
                    onClick={toggleMobileModules}
                  >
                    모듈
                  </button>
                  <button
                    type="button"
                    className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 lg:hidden"
                    onClick={toggleMobileMenu}
                  >
                    메뉴
                  </button>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.3em] text-amber-700">
                      {activeModule.label}
                    </p>
                    <h2 className="mt-1 text-lg font-semibold text-slate-900">
                      {activeModule.label} / {activeItemLabel}
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

              <div className="mt-4 hidden flex-wrap gap-2 lg:flex">
                {visibleModules.map((module) => {
                  const moduleIsActive = activeModule.id === module.id;

                  return (
                    <Link
                      key={module.id}
                      href={module.defaultHref}
                      className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
                        moduleIsActive
                          ? "border-amber-300 bg-amber-50 text-slate-900"
                          : "border-slate-200 bg-white text-slate-600 hover:border-amber-200 hover:bg-amber-50 hover:text-slate-900"
                      }`}
                    >
                      {module.label}
                    </Link>
                  );
                })}
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
