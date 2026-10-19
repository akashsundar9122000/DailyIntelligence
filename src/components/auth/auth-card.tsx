import type { ReactNode } from "react";

/** The frame every authentication page shares: a kicker, one heading, one form, one way out. */
export function AuthCard({
  kicker,
  title,
  description,
  children,
  footer,
}: {
  kicker?: string;
  title: string;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="w-full max-w-[26rem]">
      <div className="border-t-[3px] border-rule pt-4">
        {kicker ? <p className="kicker text-text-tertiary">{kicker}</p> : null}
        <h1 tabIndex={-1} className="mt-1 text-4xl font-bold leading-[1.05] text-text-primary focus:outline-none sm:text-5xl">{title}</h1>
        {description ? <p className="dek mt-3 text-lg">{description}</p> : null}
      </div>
      <div className="mt-8 space-y-5">{children}</div>
      {footer ? <div className="mt-8 border-t border-border pt-4 text-sm text-text-secondary">{footer}</div> : null}
    </div>
  );
}

export function FormError({ message }: { message: string | null }) {
  // Always in the DOM so the announcement is made when the text arrives.
  return (
    <p role="alert" className={message ? "border-l-[3px] border-danger bg-danger-subtle px-3 py-2.5 text-sm text-danger" : "sr-only"}>
      {message ?? ""}
    </p>
  );
}

export function FormNotice({ children }: { children: ReactNode }) {
  return (
    <p role="status" className="border-l-[3px] border-rule bg-surface-sunken px-3 py-2.5 text-sm text-text-primary">
      {children}
    </p>
  );
}

export const authLink = "font-medium text-text-primary underline underline-offset-4 decoration-border-strong hover:decoration-text-primary";
