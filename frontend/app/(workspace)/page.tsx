import { redirect } from "next/navigation";
import Link from "next/link";

import { getAttentionRedirect, getCurrentUserServer } from "@/lib/server-auth";

const cards = [
  {
    href: "/login",
    title: "로그인",
    description: "httpOnly 쿠키 기반 인증으로 시작합니다.",
  },
  {
    href: "/udms/documents",
    title: "UDMS",
    description: "게시판, 문서, 첨부파일, 공유, 결재를 묶어 관리합니다.",
  },
  {
    href: "/worship/orders",
    title: "예배 순서",
    description: "사용자가 예배 순서를 편집하는 진입점입니다.",
  },
  {
    href: "/worship/subtitles/input",
    title: "자막 입력",
    description: "담당 순서의 자막을 입력하는 화면입니다.",
  },
  {
    href: "/admin",
    title: "관리자",
    description: "사용자, 게시판, 템플릿, 권한을 관리합니다.",
  },
  {
    href: "/display",
    title: "Display",
    description: "실시간 예배 송출 화면입니다.",
  },
];

export default async function WorkspaceHomePage() {
  const currentUser = await getCurrentUserServer();
  if (currentUser) {
    const attentionRedirect = getAttentionRedirect(currentUser);
    if (attentionRedirect) {
      redirect(attentionRedirect);
    }
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
                로그인, UDMS, 예배 순서와 자막을
                <br />
                한 흐름으로 묶는 시작점
              </h1>
              <p className="max-w-2xl text-base leading-8 text-slate-600 md:text-lg">
                현재는 단순한 출발점이지만, 내부 구조는 auth, udms, worship, admin으로
                분리 가능한 형태로 준비되어 있습니다. 예배 템플릿 관리는 관리자 영역에서
                처리합니다.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/login"
                className="rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white"
              >
                로그인 열기
              </Link>
              <Link
                href="/admin"
                className="rounded-full border border-slate-300 bg-white px-5 py-3 text-sm font-medium text-slate-700"
              >
                관리자 열기
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
