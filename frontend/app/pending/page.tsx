import { SignOutButton } from "@/components/sign-out-button";
import { requirePendingUser } from "@/lib/server-auth";

export default async function PendingPage() {
  const user = await requirePendingUser();

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl items-center px-4 py-8 md:px-6">
      <section className="panel-strong w-full rounded-[32px] p-6 md:p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-amber-700">Pending</p>
        <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight text-slate-900">
          승인 대기
        </h1>
        <p className="mt-3 text-sm leading-7 text-slate-600">
          {user.name}님의 계정은 현재 승인 대기 상태입니다. 마스터 관리자가 역할과 상태를
          활성화하면 업무 화면 접근이 열립니다.
        </p>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <div className="rounded-[24px] border border-slate-200 bg-white/70 px-4 py-4 text-sm leading-6 text-slate-700">
            이메일: {user.email}
          </div>
          <div className="rounded-[24px] border border-slate-200 bg-white/70 px-4 py-4 text-sm leading-6 text-slate-700">
            직분/부서: {user.position} / {user.department}
          </div>
        </div>

        <div className="mt-6">
          <SignOutButton />
        </div>
      </section>
    </main>
  );
}
