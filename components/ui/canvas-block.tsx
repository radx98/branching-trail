import { cn } from "@/lib/utils";
import type { HTMLAttributes } from "react";

type CanvasBlockProps = HTMLAttributes<HTMLDivElement>;

/**
 * CanvasBlock is the base shell for prompts and options rendered on the canvas.
 * Future iterations can compose additional controls into this container.
 */
export function CanvasBlock({
  className,
  ...props
}: CanvasBlockProps) {
  return (
    <div
      className={cn(
        "rounded-[var(--radius-block)] border border-[color:var(--color-border-soft)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-soft)] transition-colors duration-150",
        className,
      )}
      {...props}
    />
  );
}
