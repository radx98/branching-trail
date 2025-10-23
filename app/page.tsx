import { CanvasBlock } from "@/components/ui/canvas-block";
import { PrimaryButton } from "@/components/ui/primary-button";
import {
  SidebarActionButton,
  SidebarItem,
  SidebarShell,
} from "@/components/ui/sidebar-shell";

export default function Home() {
  const placeholderSessions = [
    { id: "current", title: "New session", status: "active" as const },
    { id: "previous", title: "Indie Game Explorer", status: "idle" as const },
  ];

  const placeholderNodes = [
    {
      id: "prompt-root",
      title: "Initial Prompt",
      description: "Describe what you want to explore to start a new tree.",
      variant: "prompt",
    },
    {
      id: "option-1",
      title: "Strategy & Simulation",
      description: "Lean into systems thinking and long-form planning.",
      variant: "option",
    },
    {
      id: "option-2",
      title: "Action & Adventure",
      description: "Chase thrilling set pieces with responsive mechanics.",
      variant: "option",
    },
    {
      id: "specify",
      title: "Specify",
      description: "Add your own twist without attaching it to an option.",
      variant: "specify",
    },
  ];

  return (
    <div className="flex min-h-screen bg-[var(--color-background)] text-[var(--color-foreground)]">
      <SidebarShell
        title="Branching Trail"
        action={<SidebarActionButton>New</SidebarActionButton>}
      >
        {placeholderSessions.map((session) => (
          <SidebarItem
            key={session.id}
            active={session.status === "active"}
          >
            {session.title}
          </SidebarItem>
        ))}
      </SidebarShell>

      <main className="relative flex flex-1 flex-col overflow-hidden">
        <header className="flex items-center justify-between border-b border-white/10 px-10 py-8">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
              Prototype canvas
            </p>
            <h1 className="text-3xl font-semibold tracking-tight">
              Creative branching explorer
            </h1>
          </div>
          <PrimaryButton type="button">Start exploring</PrimaryButton>
        </header>

        <section className="flex-1 overflow-auto px-10 py-12">
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {placeholderNodes.map((node) => (
              <CanvasBlock key={node.id}>
                <span className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-400">
                  {node.variant}
                </span>
                <h2 className="mt-3 text-lg font-semibold tracking-tight text-slate-900">
                  {node.title}
                </h2>
                <p className="mt-2 text-sm text-slate-500">{node.description}</p>
              </CanvasBlock>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
