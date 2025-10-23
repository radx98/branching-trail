'use client';

import { BranchingCanvas } from "@/components/canvas/branching-canvas";
import { PrimaryButton } from "@/components/ui/primary-button";
import {
  SidebarActionButton,
  SidebarItem,
  SidebarShell,
} from "@/components/ui/sidebar-shell";
import {
  MOCK_PLACEHOLDER_NOTE,
  type BranchNode,
  useSessionStore,
} from "@/lib/state/session-store";
import { useMemo, useCallback } from "react";

export default function Home() {
  const sessions = useSessionStore((state) => state.sessions);
  const activeSessionId = useSessionStore((state) => state.activeSessionId);
  const createSession = useSessionStore((state) => state.createSession);
  const selectSession = useSessionStore((state) => state.selectSession);
  const submitPrompt = useSessionStore((state) => state.submitPrompt);
  const commitSpecifyPrompt = useSessionStore(
    (state) => state.commitSpecifyPrompt,
  );

  const activeSession = useMemo(
    () => sessions.find((session) => session.id === activeSessionId) ?? null,
    [sessions, activeSessionId],
  );

  const computeSessionStatus = useCallback(
    (node: BranchNode): "idle" | "loading" => {
      if (node.status === "loading") {
        return "loading";
      }
      for (const child of node.children) {
        if (computeSessionStatus(child) === "loading") {
          return "loading";
        }
      }
      return "idle";
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
        <div className="rounded-[var(--radius-card)] border border-white/30 bg-white/40 px-3 py-2 text-xs font-medium text-slate-600">
          {MOCK_PLACEHOLDER_NOTE}
        </div>
        {sessions.map((session) => {
          const status =
            session.root.children.length === 0 && !session.root.prompt
              ? "Setup"
              : computeSessionStatus(session.root) === "loading"
                ? "Refreshing"
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
              Phase 2 UI — Mock data only
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
