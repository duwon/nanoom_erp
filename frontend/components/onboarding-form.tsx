"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { updateMyProfile } from "@/lib/api";
import type { AuthUser } from "@/lib/types";

type OnboardingFormProps = {
  initialUser: AuthUser;
};

export function OnboardingForm({ initialUser }: OnboardingFormProps) {
  const router = useRouter();
  const [name, setName] = useState(initialUser.name ?? "");
  const [position, setPosition] = useState(initialUser.position ?? "");
  const [department, setDepartment] = useState(initialUser.department ?? "");
  const [message, setMessage] = useState("");
  const [isPending, setIsPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsPending(true);
    setMessage("");

    try {
      const user = await updateMyProfile({ name, position, department });
      router.push(user.status === "active" ? (user.role === "master" ? "/admin" : "/dashboard") : "/pending");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "프로필 저장에 실패했습니다.");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <form className="grid gap-4" onSubmit={handleSubmit}>
      <label className="grid gap-2">
        <span className="text-sm font-medium text-slate-700">이름</span>
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-amber-400"
          autoComplete="name"
        />
      </label>

      <label className="grid gap-2">
        <span className="text-sm font-medium text-slate-700">직분</span>
        <input
          value={position}
          onChange={(event) => setPosition(event.target.value)}
          className="rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-amber-400"
        />
      </label>

      <label className="grid gap-2">
        <span className="text-sm font-medium text-slate-700">부서</span>
        <input
          value={department}
          onChange={(event) => setDepartment(event.target.value)}
          className="rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-amber-400"
        />
      </label>

      <button
        type="submit"
        disabled={isPending}
        className="mt-2 rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending ? "저장 중..." : "정보 저장"}
      </button>

      {message ? <p className="text-sm font-medium text-rose-600">{message}</p> : null}
    </form>
  );
}
