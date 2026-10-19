import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "./cn";

/**
 * The basic surface. How it is drawn is the palette's (.card in tokens.css):
 * a ruled sheet in Newspaper -- hairline frame, thick ink rule across the top,
 * no shadow -- and a frosted pane in Aurora.
 */
export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("card", className)} {...props} />;
}

export function CardHeader({
  title,
  description,
  action,
  className,
  as: Heading = "h2",
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
  /** The heading level this card sits at in its page's outline. */
  as?: "h2" | "h3" | "h4";
}) {
  return (
    <div className={cn("flex items-start justify-between gap-4 px-[var(--pad-card)] pt-[var(--pad-card)]", className)}>
      <div className="min-w-0 space-y-1">
        <Heading className="font-display text-lg font-bold leading-snug text-text-primary">{title}</Heading>
        {description ? <p className="text-sm text-text-secondary">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function CardBody({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-[var(--pad-card)]", className)} {...props} />;
}
