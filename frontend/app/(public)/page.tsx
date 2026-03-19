import Link from "next/link";
import { redirect } from "next/navigation";

import { getAttentionRedirect, getCurrentUserServer, getDefaultAuthenticatedPath } from "@/lib/server-auth";

const cards = [
  {
    href: "/login",
    title: "로그인",
    description: "설정된 인증 공급자로 인증을 시작합니다.",
  },
  {
    href: "/dashboard",
    title: "대시보드",
    description: "인증 사용자가 일상 업무를 시작하는 화면입니다.",
  },
  {
    href: "/udms/documents",
    title: "문서 관리",
    description: "문서, 게시판, 공유, 결재 흐름을 다룹니다.",
  },
  {
    href: "/display",
    title: "디스플레이",
    description: "예배 출력용 전체 화면입니다.",
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
              나눔 업무 시스템
            </div>
            <div className="space-y-4">
              <h1 className="font-display text-4xl font-semibold tracking-tight text-slate-900 md:text-6xl">
                인증 업무를 위한 공개 진입점
                <br />
                그리고 실시간 디스플레이 흐름
              </h1>
              <p className="max-w-2xl text-base leading-8 text-slate-600 md:text-lg">
                홈 화면은 공개 상태로 유지하고, 인증 사용자는 업무 쉘로 이동합니다. 디스플레이는
                전체 화면과 집중도를 위해 쉘 밖에 둡니다.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/login"
                className="rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white"
              >
                로그인
              </Link>
              <Link
                href="/dashboard"
                className="rounded-full border border-slate-300 bg-white px-5 py-3 text-sm font-medium text-slate-700"
              >
                대시보드 열기
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
                  열기
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
