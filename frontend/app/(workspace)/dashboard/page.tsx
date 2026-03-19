import Link from "next/link";

import { requireWorkspaceUser } from "@/lib/server-auth";
import type { AuthUser } from "@/lib/types";

type Shortcut = {
  href: string;
  label: string;
  description: string;
  variant?: "primary" | "secondary";
};

function buildShortcuts(role: AuthUser["role"]): Shortcut[] {
  const shortcuts: Shortcut[] = [
    {
      href: "/udms/documents",
      label: "Open Documents",
      description: "Review shared files, revisions, and attachments.",
      variant: "primary",
    },
    {
      href: "/worship/orders",
      label: "Service Orders",
      description: "Continue the worship preparation flow.",
      variant: "secondary",
    },
  ];

  if (role === "master") {
    shortcuts.push({
      href: "/admin/users",
      label: "Admin Users",
      description: "Check approvals, roles, and account status.",
      variant: "secondary",
    });
  } else {
    shortcuts.push({
      href: "/udms/approvals",
      label: "Approvals",
      description: "Move documents through the review queue.",
      variant: "secondary",
    });
  }

  return shortcuts;
}

function buildNextActions(role: AuthUser["role"]) {
  if (role === "master") {
    return [
      {
        title: "Review user approvals",
        description: "Check pending accounts and confirm role assignments.",
        href: "/admin/users",
      },
      {
        title: "Audit the board setup",
        description: "Verify how boards map to document publishing rules.",
        href: "/admin/boards",
      },
      {
        title: "Check worship templates",
        description: "Confirm the latest template set before service prep.",
        href: "/admin/worship-templates",
      },
    ];
  }

  return [
    {
      title: "Open the latest documents",
      description: "Continue where the team left off in UDMS.",
      href: "/udms/documents",
    },
    {
      title: "Prepare the worship order",
      description: "Move the next service flow into position.",
      href: "/worship/orders",
    },
    {
      title: "Review the approval queue",
      description: "Work through documents that need a decision.",
      href: "/udms/approvals",
    },
  ];
}

export default async function DashboardPage() {
  const user = await requireWorkspaceUser("/dashboard");
  const shortcuts = buildShortcuts(user.role);
  const nextActions = buildNextActions(user.role);
  const displayName = user.name ?? user.email;

  return (
    <div className="grid gap-6">
      <section className="panel-strong overflow-hidden rounded-[36px]">
        <div className="grid gap-8 px-6 py-7 lg:grid-cols-[1.15fr_0.85fr] lg:px-10 lg:py-10">
          <div className="space-y-6">
            <div className="inline-flex rounded-full border border-amber-200 bg-white/80 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-amber-700">
              Dashboard
            </div>

            <div className="space-y-4">
              <h1 className="font-display text-4xl font-semibold tracking-tight text-slate-900 md:text-5xl">
                Welcome back, {displayName}
              </h1>
              <p className="max-w-2xl text-base leading-8 text-slate-600 md:text-lg">
                This is the starting point for daily work. Use the shell on the left to move
                between UDMS, Worship, and Admin without losing your place.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-[24px] border border-slate-200 bg-white/80 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                  Account
                </p>
                <p className="mt-2 text-sm font-semibold text-slate-900">{user.email}</p>
                <p className="mt-1 text-sm text-slate-600">{user.socialProvider}</p>
              </div>
              <div className="rounded-[24px] border border-slate-200 bg-white/80 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                  Profile
                </p>
                <p className="mt-2 text-sm font-semibold text-slate-900">
                  {user.position ?? "Position not set"}
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  {user.department ?? "Department not set"}
                </p>
              </div>
              <div className="rounded-[24px] border border-slate-200 bg-white/80 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                  Role
                </p>
                <p className="mt-2 text-sm font-semibold text-slate-900">{user.role}</p>
                <p className="mt-1 text-sm text-slate-600">Access level for authenticated shell</p>
              </div>
              <div className="rounded-[24px] border border-slate-200 bg-white/80 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                  Status
                </p>
                <p className="mt-2 text-sm font-semibold text-slate-900">{user.status}</p>
                <p className="mt-1 text-sm text-slate-600">
                  {user.approvedAt ? `Approved at ${user.approvedAt}` : "Awaiting approval info"}
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-[28px] border border-slate-200 bg-white/80 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                Quick actions
              </p>
              <div className="mt-4 grid gap-3">
                {shortcuts.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`rounded-[20px] border px-4 py-4 transition ${
                      item.variant === "primary"
                        ? "border-slate-900 bg-slate-900 text-white"
                        : "border-slate-200 bg-white text-slate-900 hover:border-amber-300 hover:bg-amber-50"
                    }`}
                  >
                    <div className="text-sm font-semibold">{item.label}</div>
                    <p className={`mt-1 text-sm leading-6 ${item.variant === "primary" ? "text-slate-200" : "text-slate-600"}`}>
                      {item.description}
                    </p>
                  </Link>
                ))}
              </div>
            </div>

            <div className="rounded-[28px] border border-slate-200 bg-white/80 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                Session summary
              </p>
              <div className="mt-4 grid gap-3">
                <div className="rounded-[20px] bg-slate-50 px-4 py-4 text-sm text-slate-700">
                  Start here, then continue into the module that needs attention.
                </div>
                <div className="rounded-[20px] bg-slate-50 px-4 py-4 text-sm text-slate-700">
                  The shell keeps navigation visible on desktop and mobile.
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        {nextActions.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="panel rounded-[28px] p-5 transition-transform duration-200 hover:-translate-y-1"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
              Next action
            </p>
            <h2 className="mt-3 font-display text-2xl font-semibold text-slate-900">
              {item.title}
            </h2>
            <p className="mt-3 text-sm leading-7 text-slate-600">{item.description}</p>
          </Link>
        ))}
      </section>
    </div>
  );
}
