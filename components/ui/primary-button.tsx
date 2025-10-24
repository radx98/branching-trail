import { cn } from "@/lib/utils";
import type { ButtonHTMLAttributes } from "react";

type PrimaryButtonProps = ButtonHTMLAttributes<HTMLButtonElement>;

export function PrimaryButton({
  className,
  ...props
}: PrimaryButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center rounded-[var(--radius-button)] bg-[var(--color-accent)] px-5 py-2 text-sm font-semibold text-[var(--color-accent-foreground)] shadow-[var(--shadow-soft)] transition-colors duration-150 hover:bg-indigo-500 disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}
