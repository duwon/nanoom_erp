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
    label: "Dashboard",
    items: [
      {
        href: "/dashboard",
        label: "Overview",
        description: "Daily starting point",
        roles: ["master", "final_approver", "editor", "member"],
        exact: true,
      },
    ],
  },
  {
    label: "UDMS",
    items: [
      {
        href: "/udms/documents",
        label: "Documents",
        description: "Files and revisions",
        roles: ["master", "final_approver", "editor", "member"],
      },
      {
        href: "/udms/boards",
        label: "Boards",
        description: "Publishing rules",
        roles: ["master", "final_approver", "editor", "member"],
      },
      {
        href: "/udms/shares",
        label: "Shares",
        description: "Collaboration",
        roles: ["master", "final_approver", "editor", "member"],
      },
      {
        href: "/udms/approvals",
        label: "Approvals",
        description: "Review queue",
        roles: ["master", "final_approver", "editor", "member"],
      },
      {
        href: "/udms/permissions",
        label: "Permissions",
        description: "Access control",
        roles: ["master", "final_approver", "editor", "member"],
      },
    ],
  },
  {
    label: "Worship",
    items: [
      {
        href: "/worship/orders",
        label: "Orders",
        description: "Service order",
        roles: ["master", "final_approver", "editor", "member"],
      },
      {
        href: "/worship/subtitles/input",
        label: "Subtitles Input",
        description: "Prepare subtitle content",
        roles: ["master", "final_approver", "editor", "member"],
      },
      {
        href: "/worship/subtitles/output",
        label: "Subtitles Output",
        description: "Send to display",
        roles: ["master", "final_approver", "editor", "member"],
      },
      {
        href: "/worship/contents",
        label: "Contents",
        description: "Media assets",
        roles: ["master", "final_approver", "editor", "member"],
      },
    ],
  },
  {
    label: "Admin",
    items: [
      {
        href: "/admin",
        label: "Home",
        description: "Admin overview",
        roles: ["master"],
        exact: true,
      },
      {
        href: "/admin/users",
        label: "Users",
        description: "User management",
        roles: ["master"],
      },
      {
        href: "/admin/permissions",
        label: "Permissions",
        description: "Policy management",
        roles: ["master"],
      },
      {
        href: "/admin/boards",
        label: "Boards",
        description: "Board management",
        roles: ["master"],
      },
      {
        href: "/admin/worship-templates",
        label: "Worship Templates",
        description: "Service templates",
        roles: ["master"],
      },
    ],
  },
];

function formatRole(role: UserRole) {
  return role.replace("_", " ");
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
  const currentSection = active?.section ?? "Dashboard";
  const currentItem = active?.item.label ?? "Overview";

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
                    Nanoom ERP
                  </p>
                  <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight text-slate-900">
                    Authenticated Shell
                  </h1>
                </div>
                <button
                  type="button"
                  className="rounded-full border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 lg:hidden"
                  onClick={() => setMobileOpen(false)}
                >
                  Close
                </button>
              </div>

              <div className="mt-5 rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                  Current user
                </p>
                <p className="mt-2 text-sm font-semibold text-slate-900">{userLabel}</p>
                <p className="mt-1 text-sm text-slate-600">{user.email}</p>
                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                  <span className="rounded-full bg-white px-3 py-1 font-medium text-slate-700">
                    {formatRole(user.role)}
                  </span>
                  <span className="rounded-full bg-white px-3 py-1 font-medium text-slate-700">
                    {user.status}
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
                                Active
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
                  Session
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
                  Menu
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
