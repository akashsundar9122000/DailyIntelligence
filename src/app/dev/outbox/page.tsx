import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";

import { EmptyState, ErrorState } from "@/components/ui/states";
import { devOutboxEnabled, smtpConfigured } from "@/lib/env";
import { recentOutbox, type OutboxEntry } from "@/lib/mail/send";

export const metadata: Metadata = { title: "Mail outbox", robots: { index: false, follow: false } };

const STATUS_STYLE: Record<string, string> = {
  SENT: "bg-success-subtle text-success",
  FAILED: "bg-danger-subtle text-danger",
  QUEUED: "bg-info-subtle text-info",
  DEV: "bg-warning-subtle text-warning",
};

/**
 * Every message the application has recorded, newest first, with its body.
 * A development tool: it shows one-time codes, so it does not exist in
 * production unless the dev-tools flag is set, never exists on a hosted
 * deployment whatever is set, and is never linked from the product.
 */
export default async function OutboxPage() {
  await connection();
  if (!devOutboxEnabled()) notFound();

  let entries: OutboxEntry[] | null = null;
  try {
    entries = await recentOutbox();
  } catch {
    entries = null;
  }

  return (
    <main className="mx-auto max-w-4xl space-y-6 px-4 py-10 sm:px-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold text-text-primary">Mail outbox</h1>
        <p className="max-w-[65ch] text-sm text-text-secondary">
          {smtpConfigured()
            ? "SMTP is configured: queued messages are delivered."
            : "SMTP is not configured: messages are recorded here with status DEV and are not sent to anyone."}
        </p>
      </header>

      {entries === null ? (
        <ErrorState description="The outbox could not be read. Check that the database is configured and migrated." />
      ) : entries.length === 0 ? (
        <EmptyState
          title="Nothing has been sent yet"
          description="Messages appear here as soon as the application queues one, such as a sign-up verification code."
        />
      ) : (
        <ul className="space-y-4">
          {entries.map((entry) => (
            <li key={entry.id} className="space-y-3 rounded-lg border border-border bg-surface p-5" data-testid="outbox-entry">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium text-text-primary">{entry.subject}</p>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLE[entry.status] ?? "bg-surface-sunken text-text-secondary"}`}
                >
                  {entry.status}
                </span>
              </div>
              <p className="text-sm text-text-secondary">
                To <span data-testid="outbox-to">{entry.toEmail}</span> · {entry.template} ·{" "}
                <time dateTime={entry.createdAt}>{entry.createdAt}</time>
              </p>
              <pre
                className="overflow-x-auto whitespace-pre-wrap rounded-md bg-surface-sunken p-4 font-mono text-sm text-text-secondary"
                data-testid="outbox-body"
              >
                {entry.textBody}
              </pre>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
