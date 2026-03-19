"use client";

import { useSearchParams } from "next/navigation";

import { getOAuthStartUrl } from "@/lib/api";

const providers = [
  {
    provider: "google" as const,
    label: "Google로 로그인",
    className: "rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white",
    description: "운영 계정 또는 로컬 개발용 마스터 계정으로 연결합니다.",
  },
  {
    provider: "kakao" as const,
    label: "카카오로 로그인",
    className: "rounded-full bg-[#FEE500] px-5 py-3 text-sm font-semibold text-slate-900",
    description: "카카오 계정 이메일 제공 동의가 필요합니다.",
  },
];

export default function LoginPage() {
  const searchParams = useSearchParams();
  const message = searchParams.get("error") ?? "";

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl items-center px-4 py-8 md:px-6">
      <section className="panel-strong w-full rounded-[32px] p-6 md:p-8">
        <div className="mb-6">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-amber-700">Auth</p>
          <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight text-slate-900">
            소셜 로그인
          </h1>
          <p className="mt-3 text-sm leading-7 text-slate-600">
            최초 접속 후 이름, 직분, 부서를 입력하면 승인 대기 상태가 되며 마스터 관리자가
            활성화합니다.
          </p>
          <p className="mt-2 text-sm leading-7 text-slate-500">
            로컬 환경에서 Google OAuth 설정이 없으면 개발용 마스터 계정으로 대체됩니다.
          </p>
        </div>

        <div className="grid gap-4">
          {providers.map((item) => (
            <a
              key={item.provider}
              href={getOAuthStartUrl(item.provider)}
              className="panel flex items-center justify-between rounded-[24px] px-5 py-5 transition-transform duration-200 hover:-translate-y-1"
            >
              <div>
                <h2 className="font-display text-2xl font-semibold text-slate-900">{item.label}</h2>
                <p className="mt-2 text-sm leading-7 text-slate-600">{item.description}</p>
              </div>
              <span className={item.className}>시작</span>
            </a>
          ))}
        </div>

        {message ? <p className="mt-5 text-sm font-medium text-rose-600">{message}</p> : null}
      </section>
    </main>
  );
}
