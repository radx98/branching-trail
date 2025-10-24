'use client';

import { BranchingCanvas } from "@/components/canvas/branching-canvas";
import { PrimaryButton } from "@/components/ui/primary-button";
import {
  SidebarActionButton,
  SidebarItem,
  SidebarShell,
} from "@/components/ui/sidebar-shell";
import { EMPTY_STATE_NOTE, useSessionStore } from "@/lib/state/session-store";
import type { BranchNode } from "@/lib/types/tree";
import { useMemo, useCallback, useEffect } from "react";

export default function Home() {
  const sessions = useSessionStore((state) => state.sessions);
  const activeSessionId = useSessionStore((state) => state.activeSessionId);
  const createSession = useSessionStore((state) => state.createSession);
  const selectSession = useSessionStore((state) => state.selectSession);
  const submitPrompt = useSessionStore((state) => state.submitPrompt);
  const commitSpecifyPrompt = useSessionStore(
    (state) => state.commitSpecifyPrompt,
  );
  const hydrate = useSessionStore((state) => state.hydrate);
  const isHydrating = useSessionStore((state) => state.isHydrating);
  const lastError = useSessionStore((state) => state.lastError);
  const clearError = useSessionStore((state) => state.clearError);

  const activeSession = useMemo(
    () => sessions.find((session) => session.id === activeSessionId) ?? null,
    [sessions, activeSessionId],
  );

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  const computeSessionStatus = useCallback(
    (node: BranchNode): "idle" | "loading" | "error" => {
      if (node.status === "error") {
        return "error";
      }
      if (node.status === "loading") {
        return "loading";
      }
      let childState: "idle" | "loading" | "error" = "idle";
      for (const child of node.children) {
        const status = computeSessionStatus(child);
        if (status === "error") {
          return "error";
        }
        if (status === "loading") {
          childState = "loading";
        }
      }
      return childState;
    },
    [],
  );

  return (
    <div className="flex min-h-screen bg-[var(--color-background)] text-[var(--color-foreground)]">
      <SidebarShell
        title="Branching Trail"
        action={
          <SidebarActionButton type="button" onClick={createSession}>
            New
          </SidebarActionButton>
        }
      >
        {lastError ? (
          <div className="flex items-center justify-between gap-3 rounded-[var(--radius-card)] border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-600">
            <span className="truncate">{lastError}</span>
            <button
              type="button"
              onClick={() => {
                clearError();
                void hydrate();
              }}
              className="shrink-0 rounded-full border border-rose-300 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-rose-600"
            >
              Retry
            </button>
          </div>
        ) : null}

        {isHydrating && sessions.length === 0 ? (
          <div className="rounded-[var(--radius-card)] border border-white/20 bg-white/60 px-3 py-2 text-xs font-medium text-slate-500">
            Loading sessions…
          </div>
        ) : null}

        {!isHydrating && sessions.length === 0 ? (
          <div className="rounded-[var(--radius-card)] border border-white/30 bg-white/40 px-3 py-2 text-xs font-medium text-slate-600">
            {EMPTY_STATE_NOTE}
          </div>
        ) : null}

        {sessions.map((session) => {
          const statusState = computeSessionStatus(session.root);
          const status = session.isPlaceholder && !session.root.prompt
            ? "Setup"
            : statusState === "loading"
              ? "Refreshing"
              : statusState === "error"
                ? "Error"
                : "Idle";

          return (
            <SidebarItem
              key={session.id}
              active={session.id === activeSessionId}
              onClick={() => selectSession(session.id)}
            >
              <span className="truncate">{session.title}</span>
              <span className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">
                {status}
              </span>
            </SidebarItem>
          );
        })}
      </SidebarShell>

      <main className="relative flex flex-1 flex-col overflow-hidden">
        <header className="flex flex-wrap items-center justify-between gap-6 border-b border-white/10 px-10 py-8">
          <div className="flex flex-col gap-3">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
              Canvas playground
            </p>
            <h1 className="text-3xl font-semibold tracking-tight text-[color:var(--color-foreground)]">
              {activeSession?.title ?? "Select a session"}
            </h1>
            <span className="text-xs uppercase tracking-[0.28em] text-slate-400">
              Phase 3 — AI-backed generation
            </span>
          </div>
          <PrimaryButton type="button" onClick={createSession}>
            Start fresh session
          </PrimaryButton>
        </header>

        <section className="flex-1 overflow-hidden">
          <BranchingCanvas
            session={activeSession}
            onSubmitPrompt={submitPrompt}
            onSpecifyPrompt={commitSpecifyPrompt}
          />
        </section>
      </main>
    </div>
  );
}
