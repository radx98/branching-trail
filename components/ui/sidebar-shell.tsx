import { cn } from "@/lib/utils";
import type {
  ButtonHTMLAttributes,
  HTMLAttributes,
  ReactNode,
  MouseEvent,
} from "react";

type SidebarShellProps = HTMLAttributes<HTMLElement> & {
  title: string;
  action?: ReactNode;
};

export function SidebarShell({
  title,
  action,
  className,
  children,
  ...props
}: SidebarShellProps) {
  return (
    <aside
      className={cn(
        "flex w-72 shrink-0 flex-col gap-6 border-r border-transparent bg-[var(--color-sidebar)]/70 px-6 py-8 text-sm backdrop-blur-md",
        className,
      )}
      {...props}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xl font-semibold tracking-tight text-[color:var(--color-foreground)]">
          {title}
        </span>
        {action}
      </div>
      <nav className="mt-8 flex grow flex-col gap-3 overflow-auto">{children}</nav>
    </aside>
  );
}

type SidebarItemProps = HTMLAttributes<HTMLDivElement> & {
  active?: boolean;
};

export function SidebarItem({
  active,
  className,
  onClick,
  onKeyDown,
  ...props
}: SidebarItemProps) {
  return (
    <div
      role="button"
      tabIndex={0}
      data-active={active ? "true" : "false"}
      className={cn(
        "flex h-12 items-center justify-between rounded-[var(--radius-card)] border border-transparent bg-white/60 px-4 text-left font-medium text-slate-600 transition-colors data-[active=true]:bg-white data-[active=true]:text-slate-900 hover:bg-white/80",
        className,
      )}
      onClick={onClick as unknown as (event: MouseEvent<HTMLDivElement>) => void}
      onKeyDown={(event) => {
        onKeyDown?.(event);
        if (event.defaultPrevented) {
          return;
        }
        if (!onClick) {
          return;
        }
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onClick(
            event as unknown as MouseEvent<HTMLDivElement>,
          );
        }
      }}
      {...props}
    />
  );
}

type SidebarButtonProps = ButtonHTMLAttributes<HTMLButtonElement>;

export function SidebarActionButton({
  className,
  ...props
}: SidebarButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex h-10 w-10 items-center justify-center rounded-full bg-[var(--color-accent)] text-[var(--color-accent-foreground)] shadow-[var(--shadow-soft)] transition-colors duration-150 hover:bg-indigo-500",
        className,
      )}
      {...props}
    >
      <span className="inline-flex">
        <svg
          viewBox="0 0 24 24"
          aria-hidden="true"
          className="h-5 w-5 fill-none stroke-current stroke-[2.2] drop-shadow-[0_1px_1px_rgba(0,0,0,0.12)]"
        >
          <path d="M12 5v14M5 12h14" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    </button>
  );
}
