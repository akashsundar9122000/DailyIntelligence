import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "./cn";

/**
 * The basic surface: a ruled sheet. A hairline frame with a thick ink rule
 * across the top, the way a newspaper boxes a panel. No shadow and no rounded
 * corners -- paper does not float.
 */
export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("border border-border border-t-2 border-t-text-primary bg-surface", className)} {...props} />;
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
