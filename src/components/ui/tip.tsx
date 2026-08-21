import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Mount once near the root so tips share a single provider. */
export function TipProvider({ children }: { children: ReactNode }) {
  return (
    <TooltipPrimitive.Provider delayDuration={200} skipDelayDuration={100}>
      {children}
    </TooltipPrimitive.Provider>
  );
}

/** Bloomberg-style hover tip. Does not break block/flex layouts. */
export function Tip({
  content,
  children,
  side = "top",
  className,
  inline = false,
}: {
  content: ReactNode;
  children: ReactNode;
  side?: "top" | "bottom" | "left" | "right";
  className?: string;
  /** Render the trigger inline (for icons in headers) instead of as a block row. */
  inline?: boolean;
}) {
  if (!content) return <>{children}</>;
  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger asChild>
        <span
          className={cn(
            inline ? "inline-flex cursor-help" : "block w-full cursor-help",
            className,
          )}
        >
          {children}
        </span>
      </TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side={side}
          sideOffset={6}
          collisionPadding={8}
          className="z-[100] max-w-xs border border-accent bg-black px-2 py-1.5 font-mono text-[12px] leading-snug text-fg shadow-none animate-none"
        >
          {content}
          <TooltipPrimitive.Arrow className="fill-accent" />
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}
