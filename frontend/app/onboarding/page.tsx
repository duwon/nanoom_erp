import { OnboardingForm } from "@/components/onboarding-form";
import { SignOutButton } from "@/components/sign-out-button";
import { requireOnboardingUser } from "@/lib/server-auth";

export default async function OnboardingPage() {
  const user = await requireOnboardingUser();

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl items-center px-4 py-8 md:px-6">
      <section className="panel-strong w-full rounded-[32px] p-6 md:p-8">
        <div className="mb-6">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-amber-700">
            정보 입력
          </p>
          <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight text-slate-900">
            사용자 정보 입력
          </h1>
          <p className="mt-3 text-sm leading-7 text-slate-600">
            {user.email} 계정으로 로그인되었습니다. 이름, 직분, 부서를 입력하면 승인 대기
            상태로 전환됩니다.
          </p>
        </div>

        <OnboardingForm initialUser={user} />

        <div className="mt-6">
          <SignOutButton />
        </div>
      </section>
    </main>
  );
}
