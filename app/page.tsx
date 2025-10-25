'use client';

import { BranchingCanvas } from "@/components/canvas/branching-canvas";
import {
  SidebarActionButton,
  SidebarItem,
  SidebarShell,
} from "@/components/ui/sidebar-shell";
import { EMPTY_STATE_NOTE, useSessionStore } from "@/lib/state/session-store";
import { useMemo, useEffect } from "react";

export default function Home() {
  const sessions = useSessionStore((state) => state.sessions);
  const activeSessionId = useSessionStore((state) => state.activeSessionId);
  const createSession = useSessionStore((state) => state.createSession);
  const selectSession = useSessionStore((state) => state.selectSession);
  const deleteSession = useSessionStore((state) => state.deleteSession);
  const submitPrompt = useSessionStore((state) => state.submitPrompt);
  const commitSpecifyPrompt = useSessionStore(
    (state) => state.commitSpecifyPrompt,
  );
  const expandOption = useSessionStore((state) => state.expandOption);
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

  return (
    <div className="flex min-h-screen bg-[var(--color-background)] text-[var(--color-foreground)]">
      <SidebarShell
        title="Branching Trail"
        action={
          <SidebarActionButton type="button" onClick={createSession}>
            +
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

        {sessions.map((session) => (
          <SidebarItem
            key={session.id}
            active={session.id === activeSessionId}
            onClick={() => selectSession(session.id)}
          >
            <span className="truncate">{session.title}</span>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                void deleteSession(session.id);
              }}
              className="inline-flex h-8 items-center justify-center rounded-full text-[color:var(--color-foreground-soft)] transition-colors hover:bg-white/70 hover:text-[color:var(--color-foreground)]"
              aria-label="Delete session"
            >
              <svg
                viewBox="0 0 24 24"
                aria-hidden="true"
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
              >
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </SidebarItem>
        ))}
      </SidebarShell>

      <main className="relative flex flex-1 flex-col overflow-hidden">
        <section className="flex-1 overflow-hidden">
          <BranchingCanvas
            session={activeSession}
            onSubmitPrompt={submitPrompt}
            onSpecifyPrompt={commitSpecifyPrompt}
            onExpandOption={expandOption}
          />
        </section>
      </main>
    </div>
  );
}
