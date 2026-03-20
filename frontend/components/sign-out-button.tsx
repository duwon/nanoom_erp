"use client";

import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";

import { logout } from "@/lib/api";

type SignOutButtonProps = {
  className?: string;
  label?: ReactNode;
  title?: string;
};

export function SignOutButton({
  className = "rounded-full border border-slate-300 bg-white px-5 py-3 text-sm font-medium text-slate-700",
  label = "로그아웃",
  title = "로그아웃",
}: SignOutButtonProps) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);

  async function handleSignOut() {
    setIsPending(true);
    try {
      await logout();
      router.push("/login");
      router.refresh();
    } finally {
      setIsPending(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleSignOut}
      disabled={isPending}
      className={className}
      aria-label={title}
      title={title}
    >
      {isPending ? "로그아웃 중..." : label}
    </button>
  );
}
