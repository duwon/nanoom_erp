import Link from "next/link";
import { redirect } from "next/navigation";

import { getAttentionRedirect, getCurrentUserServer, getDefaultAuthenticatedPath } from "@/lib/server-auth";

const cards = [
  {
    href: "/login",
    title: "Login",
    description: "Start authentication with the configured OAuth provider.",
  },
  {
    href: "/dashboard",
    title: "Dashboard",
    description: "Authenticated users land here for daily work.",
  },
  {
    href: "/udms/documents",
    title: "UDMS",
    description: "Document, board, share, and approval workflows.",
  },
  {
    href: "/display",
    title: "Display",
    description: "Fullscreen worship output view.",
  },
];

export default async function PublicHomePage() {
  const currentUser = await getCurrentUserServer();

  if (currentUser) {
    const attentionRedirect = getAttentionRedirect(currentUser);
    if (attentionRedirect) {
      redirect(attentionRedirect);
    }
    redirect(getDefaultAuthenticatedPath(currentUser));
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-7xl flex-col justify-center px-4 py-8 md:px-6 lg:px-8">
      <section className="panel-strong overflow-hidden rounded-[36px]">
        <div className="grid gap-10 px-6 py-8 md:px-8 md:py-10 lg:grid-cols-[1.15fr_0.85fr] lg:px-12 lg:py-14">
          <div className="space-y-6">
            <div className="inline-flex rounded-full border border-amber-200 bg-white/80 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-amber-700">
              Nanoom ERP
            </div>
            <div className="space-y-4">
              <h1 className="font-display text-4xl font-semibold tracking-tight text-slate-900 md:text-6xl">
                Public entry for authenticated work
                <br />
                and live display flow
              </h1>
              <p className="max-w-2xl text-base leading-8 text-slate-600 md:text-lg">
                The home page stays public, while authenticated users are moved into the workspace
                shell. Display remains outside the shell so it can stay fullscreen and focused.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/login"
                className="rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white"
              >
                Sign in
              </Link>
              <Link
                href="/dashboard"
                className="rounded-full border border-slate-300 bg-white px-5 py-3 text-sm font-medium text-slate-700"
              >
                Open dashboard
              </Link>
            </div>
          </div>

          <div className="grid gap-4">
            {cards.map((card) => (
              <Link
                key={card.href}
                href={card.href}
                className="panel rounded-[28px] p-5 transition-transform duration-200 hover:-translate-y-1"
              >
                <div className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
                  Open
                </div>
                <h2 className="mt-3 font-display text-2xl font-semibold text-slate-900">
                  {card.title}
                </h2>
                <p className="mt-3 text-sm leading-7 text-slate-600">{card.description}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
