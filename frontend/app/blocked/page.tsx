import { SignOutButton } from "@/components/sign-out-button";
import { requireBlockedUser } from "@/lib/server-auth";

export default async function BlockedPage() {
  const user = await requireBlockedUser();

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl items-center px-4 py-8 md:px-6">
      <section className="panel-strong w-full rounded-[32px] p-6 md:p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-amber-700">Blocked</p>
        <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight text-slate-900">
          접근 차단
        </h1>
        <p className="mt-3 text-sm leading-7 text-slate-600">
          {user.email} 계정은 현재 차단 상태입니다. 관리자에게 문의해 상태를 확인하세요.
        </p>

        <div className="mt-6">
          <SignOutButton />
        </div>
      </section>
    </main>
  );
}
