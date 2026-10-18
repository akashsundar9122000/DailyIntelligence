import { Slot } from "@radix-ui/react-slot";
import { Loader2 } from "lucide-react";
import type { ButtonHTMLAttributes, ReactNode } from "react";

import { cn } from "./cn";

type Variant = "primary" | "secondary" | "ghost" | "ink" | "danger" | "link";
type Size = "sm" | "md" | "lg" | "icon";

/*
 * Plain lookup records rather than cva: the variants are a closed set, the
 * strings are readable at a glance, and it is one less dependency to keep
 * aligned with Tailwind's class ordering.
 *
 * The primary action is ink, not a colour: on newsprint the only colour is the
 * spot red, and that means "breaking" or "something is wrong". `danger` is for
 * destructive actions and uses its own on-colour.
 */
const variants: Record<Variant, string> = {
  primary: "bg-accent text-on-accent hover:bg-accent-hover",
  secondary: "bg-surface text-text-primary border border-border-strong hover:bg-surface-hover",
  ghost: "text-text-secondary hover:bg-surface-hover",
  ink: "bg-ink text-on-ink hover:opacity-90",
  danger: "bg-danger text-on-danger hover:opacity-90",
  link: "text-text-primary underline underline-offset-4 decoration-border-strong hover:decoration-text-primary",
};

/* coarse: pointers get the 44px touch floor; cursors keep the tighter rhythm.
   Written as a variant rather than a media query so the rule is visible at the
   call site, which is where it gets broken. */
const sizes: Record<Size, string> = {
  sm: "h-9 coarse:h-11 px-3 text-sm gap-1.5 rounded-sm",
  md: "h-10 coarse:h-11 px-4 text-sm gap-2 rounded-sm",
  lg: "h-12 coarse:h-12 px-6 text-base gap-2 rounded-sm",
  icon: "size-10 coarse:size-11 rounded-sm",
};

const base =
  "inline-flex items-center justify-center font-medium transition-colors " +
  "disabled:pointer-events-none disabled:opacity-50 " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  /** Render as the single child element -- so a Button can BE a <Link>, and
   *  navigation stays a real anchor: middle-clickable, previewable on hover,
   *  announced correctly. */
  asChild?: boolean;
  loading?: boolean;
  children?: ReactNode;
}

export function Button({
  variant = "primary",
  size = "md",
  asChild = false,
  loading = false,
  className,
  children,
  disabled,
  type,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot : "button";

  /*
   * Slot requires EXACTLY ONE CHILD, so the loading branch must not render a
   * spinner alongside children when asChild is set. Render one or the other.
   */
  const content =
    loading && !asChild ? (
      <>
        <Loader2 className="size-4 animate-spin" aria-hidden />
        {children}
      </>
    ) : (
      children
    );

  return (
    <Comp
      className={cn(base, variants[variant], sizes[size], className)}
      disabled={disabled ?? (loading && !asChild)}
      aria-busy={loading || undefined}
      // A button inside a form submits it unless told otherwise, and the
      // accidental submit is the one that loses somebody's input.
      type={asChild ? undefined : (type ?? "button")}
      {...props}
    >
      {content}
    </Comp>
  );
}
