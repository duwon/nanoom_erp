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
      label: "문서 열기",
      description: "공유 파일, 버전, 첨부를 확인합니다.",
      variant: "primary",
    },
    {
      href: "/worship/orders",
      label: "예배 순서",
      description: "예배 준비 흐름을 이어갑니다.",
      variant: "secondary",
    },
  ];

  if (role === "master") {
    shortcuts.push({
      href: "/admin/users",
      label: "사용자 관리",
      description: "승인, 역할, 계정 상태를 확인합니다.",
      variant: "secondary",
    });
  } else {
    shortcuts.push({
      href: "/udms/approvals",
      label: "결재",
      description: "문서를 검토 대기열로 넘깁니다.",
      variant: "secondary",
    });
  }

  return shortcuts;
}

function buildNextActions(role: AuthUser["role"]) {
  if (role === "master") {
    return [
      {
        title: "사용자 승인 검토",
        description: "대기 중인 계정과 역할을 확인합니다.",
        href: "/admin/users",
      },
      {
        title: "게시판 설정 점검",
        description: "게시판과 문서 노출 규칙을 확인합니다.",
        href: "/admin/boards",
      },
      {
        title: "예배 템플릿 확인",
        description: "예배 준비 전에 최신 템플릿을 확인합니다.",
        href: "/admin/worship-templates",
      },
    ];
  }

  return [
    {
      title: "최근 문서 열기",
      description: "팀이 마지막으로 보던 문서부터 이어갑니다.",
      href: "/udms/documents",
    },
    {
      title: "예배 순서 준비",
      description: "다음 예배 흐름을 배치합니다.",
      href: "/worship/orders",
    },
    {
      title: "결재 대기 검토",
      description: "결정이 필요한 문서를 처리합니다.",
      href: "/udms/approvals",
    },
  ];
}

function formatRole(role: AuthUser["role"]) {
  switch (role) {
    case "master":
      return "관리자";
    case "final_approver":
      return "최종 승인자";
    case "editor":
      return "편집자";
    case "member":
      return "일반 사용자";
  }
}

function formatStatus(status: AuthUser["status"]) {
  switch (status) {
    case "pending":
      return "승인 대기";
    case "active":
      return "활성";
    case "blocked":
      return "차단";
  }
}

function formatSocialProvider(provider: AuthUser["socialProvider"]) {
  return provider === "google" ? "구글" : "카카오";
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
              대시보드
            </div>

            <div className="space-y-4">
              <h1 className="font-display text-4xl font-semibold tracking-tight text-slate-900 md:text-5xl">
                다시 오신 것을 환영합니다, {displayName}
              </h1>
              <p className="max-w-2xl text-base leading-8 text-slate-600 md:text-lg">
                오늘 업무를 시작하는 화면입니다. 왼쪽 쉘을 사용해 문서 관리, 예배, 관리자 화면을
                이동해도 현재 위치가 유지됩니다.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-[24px] border border-slate-200 bg-white/80 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                  계정
                </p>
                <p className="mt-2 text-sm font-semibold text-slate-900">{user.email}</p>
                <p className="mt-1 text-sm text-slate-600">{formatSocialProvider(user.socialProvider)}</p>
              </div>
              <div className="rounded-[24px] border border-slate-200 bg-white/80 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                  프로필
                </p>
                <p className="mt-2 text-sm font-semibold text-slate-900">
                  {user.position ?? "직분 미입력"}
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  {user.department ?? "부서 미입력"}
                </p>
              </div>
              <div className="rounded-[24px] border border-slate-200 bg-white/80 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                  역할
                </p>
                <p className="mt-2 text-sm font-semibold text-slate-900">{formatRole(user.role)}</p>
                <p className="mt-1 text-sm text-slate-600">인증 쉘에서 사용하는 접근 수준입니다.</p>
              </div>
              <div className="rounded-[24px] border border-slate-200 bg-white/80 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                  상태
                </p>
                <p className="mt-2 text-sm font-semibold text-slate-900">{formatStatus(user.status)}</p>
                <p className="mt-1 text-sm text-slate-600">
                  {user.approvedAt ? `승인 시각 ${user.approvedAt}` : "승인 정보 대기"}
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-[28px] border border-slate-200 bg-white/80 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                빠른 실행
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
                세션 요약
              </p>
              <div className="mt-4 grid gap-3">
                <div className="rounded-[20px] bg-slate-50 px-4 py-4 text-sm text-slate-700">
                  여기서 시작한 뒤, 필요한 모듈로 이어서 이동합니다.
                </div>
                <div className="rounded-[20px] bg-slate-50 px-4 py-4 text-sm text-slate-700">
                  쉘은 데스크톱과 모바일 모두에서 내비게이션을 유지합니다.
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
              다음 작업
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
