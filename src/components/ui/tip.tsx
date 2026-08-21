import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import {
  Children,
  cloneElement,
  isValidElement,
  type ReactElement,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";

/** Mount once near the root so tips share a single provider. */
export function TipProvider({ children }: { children: ReactNode }) {
  return (
    <TooltipPrimitive.Provider delayDuration={200} skipDelayDuration={100}>
      {children}
    </TooltipPrimitive.Provider>
  );
}

/**
 * Bloomberg-style hover tip.
 * Does NOT wrap children in an inline-flex span (that broke full-width legend rows).
 * Prefer a single ReactElement child so asChild can attach handlers without a layout box.
 */
export function Tip({
  content,
  children,
  side = "top",
  className,
}: {
  content: ReactNode;
  children: ReactNode;
  side?: "top" | "bottom" | "left" | "right";
  className?: string;
}) {
  if (!content) return <>{children}</>;

  const child = Children.only(
    isValidElement(children) ? (
      children
    ) : (
      <span className={cn("cursor-help", className)}>{children}</span>
    ),
  ) as ReactElement<{ className?: string }>;

  const trigger = cloneElement(child, {
    className: cn(child.props.className, "cursor-help", className),
  });

  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger asChild>{trigger}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side={side}
          sideOffset={6}
          collisionPadding={8}
          className="z-[100] max-w-xs border border-accent bg-black px-2 py-1.5 font-mono text-[10px] leading-snug text-fg shadow-none animate-none"
        >
          {content}
          <TooltipPrimitive.Arrow className="fill-accent" />
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}
