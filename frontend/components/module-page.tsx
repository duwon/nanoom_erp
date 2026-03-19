import Link from "next/link";
import type { ReactNode } from "react";

type ActionLink = {
  href: string;
  label: string;
  variant?: "primary" | "secondary";
};

type ModulePageProps = {
  eyebrow: string;
  title: string;
  description: string;
  highlights?: string[];
  actions?: ActionLink[];
  children?: ReactNode;
};

export function ModulePage({
  eyebrow,
  title,
  description,
  highlights = [],
  actions = [],
  children,
}: ModulePageProps) {
  return (
    <main className="mx-auto min-h-screen max-w-7xl px-4 py-8 md:px-6 lg:px-8">
      <section className="panel-strong overflow-hidden rounded-[32px]">
        <div className="grid gap-8 px-6 py-8 md:px-8 md:py-10 lg:grid-cols-[1.15fr_0.85fr] lg:px-12 lg:py-14">
          <div className="space-y-5">
            <div className="inline-flex rounded-full border border-amber-200 bg-white/80 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-amber-700">
              {eyebrow}
            </div>
            <div className="space-y-4">
              <h1 className="font-display text-4xl font-semibold tracking-tight text-slate-900 md:text-5xl">
                {title}
              </h1>
              <p className="max-w-2xl text-base leading-8 text-slate-600 md:text-lg">
                {description}
              </p>
            </div>

            {highlights.length ? (
              <div className="grid gap-3 pt-2 sm:grid-cols-2">
                {highlights.map((item) => (
                  <div
                    key={item}
                    className="rounded-[24px] border border-slate-200 bg-white/70 px-4 py-4 text-sm leading-6 text-slate-700"
                  >
                    {item}
                  </div>
                ))}
              </div>
            ) : null}

            {actions.length ? (
              <div className="flex flex-wrap gap-3 pt-2">
                {actions.map((action) => (
                  <Link
                    key={action.href}
                    href={action.href}
                    className={
                      action.variant === "secondary"
                        ? "rounded-full border border-slate-300 bg-white px-5 py-3 text-sm font-medium text-slate-700"
                        : "rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white"
                    }
                  >
                    {action.label}
                  </Link>
                ))}
              </div>
            ) : null}
          </div>

          <div className="space-y-4">{children}</div>
        </div>
      </section>
    </main>
  );
}
