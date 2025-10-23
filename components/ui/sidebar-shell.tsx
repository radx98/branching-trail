import { cn } from "@/lib/utils";
import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";

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
        <span className="text-base font-semibold tracking-tight text-[color:var(--color-foreground)]">
          {title}
        </span>
        {action}
      </div>
      <nav className="flex grow flex-col gap-3 overflow-auto">{children}</nav>
    </aside>
  );
}

type SidebarItemProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  active?: boolean;
};

export function SidebarItem({
  active,
  className,
  ...props
}: SidebarItemProps) {
  return (
    <button
      data-active={active ? "true" : "false"}
      className={cn(
        "flex h-12 items-center justify-between rounded-[var(--radius-card)] border border-transparent bg-white/60 px-4 text-left font-medium text-slate-600 transition-colors data-[active=true]:bg-white data-[active=true]:text-slate-900 hover:bg-white/80",
        className,
      )}
      type="button"
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
        "inline-flex items-center justify-center rounded-[var(--radius-button)] bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-[var(--color-accent-foreground)] shadow-[var(--shadow-soft)] transition-[background,transform] duration-150 hover:bg-indigo-500 hover:-translate-y-0.5",
        className,
      )}
      {...props}
    />
  );
}
