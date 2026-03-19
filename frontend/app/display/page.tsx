"use client";

import { useEffect, useState } from "react";

import { getDisplayState, getWebSocketUrl } from "@/lib/api";
import type { DisplayState } from "@/lib/types";

type ConnectionState = "connecting" | "live" | "reconnecting";

export default function DisplayPage() {
  const [displayState, setDisplayState] = useState<DisplayState | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>("connecting");

  useEffect(() => {
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
    let websocket: WebSocket | undefined;
    let isDisposed = false;

    async function syncInitialState() {
      try {
        const nextState = await getDisplayState();
        if (!isDisposed) {
          setDisplayState(nextState);
        }
      } catch {
        if (!isDisposed) {
          setConnectionState("reconnecting");
        }
      }
    }

    function connect() {
      setConnectionState((current) => (current === "live" ? current : "connecting"));
      websocket = new WebSocket(getWebSocketUrl());

      websocket.onopen = () => {
        setConnectionState("live");
      };

      websocket.onmessage = (event) => {
        const parsedEvent = JSON.parse(event.data) as {
          type: string;
          payload: DisplayState;
        };

        if (parsedEvent.type === "display.updated") {
          setDisplayState(parsedEvent.payload);
        }
      };

      websocket.onclose = () => {
        if (isDisposed) {
          return;
        }
        setConnectionState("reconnecting");
        reconnectTimer = setTimeout(connect, 1500);
      };

      websocket.onerror = () => {
        websocket?.close();
      };
    }

    void syncInitialState();
    connect();

    return () => {
      isDisposed = true;
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
      }
      websocket?.close();
    };
  }, []);

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-950 px-6 py-8 text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(249,115,22,0.35),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(34,197,94,0.28),transparent_22%),linear-gradient(180deg,#020617_0%,#0f172a_100%)]" />
      <div className="absolute inset-x-0 top-0 h-px bg-white/20" />

      <section className="relative z-10 flex w-full max-w-7xl flex-col gap-10">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.36em] text-amber-300">
              Nanoom Display
            </p>
            <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight text-white md:text-6xl">
              Fullscreen worship display
            </h1>
          </div>
          <div className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm text-slate-100 backdrop-blur">
            {connectionState === "live"
              ? "LIVE"
              : connectionState === "connecting"
                ? "CONNECTING"
                : "RECONNECTING"}
          </div>
        </div>

        <div className="rounded-[40px] border border-white/10 bg-white/10 px-8 py-10 shadow-glow backdrop-blur-xl md:px-12 md:py-14">
          <div className="mb-6 text-sm uppercase tracking-[0.34em] text-slate-300">
            {displayState?.activeItemId ? `ACTIVE / ${displayState.activeItemId}` : "STANDBY"}
          </div>
          <h2 className="font-display text-5xl font-semibold leading-tight text-white md:text-7xl">
            {displayState?.title ?? "Waiting for display content"}
          </h2>
          <p className="mt-10 whitespace-pre-wrap font-display text-3xl leading-[1.55] text-slate-100 md:text-5xl">
            {displayState?.content ?? "Open a worship order in the workspace to show content here."}
          </p>
        </div>
      </section>
    </main>
  );
}
