import "server-only";

import { sql } from "drizzle-orm";
import nodemailer from "nodemailer";
import { uuidv7 } from "uuidv7";

import { execRows, withSystem, type Tx } from "@/lib/db/scope";
import { isoInstant } from "@/lib/db/sql";
import { env, smtpConfigured } from "@/lib/env";

import { renderMail, type MailContent } from "./templates";

/** The part of a mail transport this module uses. Lets a test stand in for SMTP. */
export type MailTransport = {
  sendMail(message: { from: string; to: string; subject: string; html: string; text: string }): Promise<unknown>;
};

/**
 * Queue a message INSIDE the caller's transaction, so a rolled-back change
 * sends nothing. `flushMail` delivers after commit.
 *
 * With no SMTP configured the row is stored with status DEV and can be read on
 * /dev/outbox. The log gets the template and the recipient's domain -- never
 * the body, which may carry a one-time code, and never the full address.
 */
export async function queueMail(tx: Tx, to: string, template: string, content: MailContent): Promise<string> {
  const { html, text } = renderMail(content);
  const status = smtpConfigured() ? "QUEUED" : "DEV";
  const id = uuidv7();
  await tx.execute(
    sql`select enqueue_email(${id}::uuid, ${to}, ${content.subject}, ${html}, ${text}, ${template}, ${status})`,
  );
  if (status === "DEV") {
    console.info(`[mail:dev] ${template} recorded for an address at ${to.split("@")[1] ?? "unknown"}; not sent`);
  }
  return id;
}

let cachedTransport: MailTransport | null = null;

function smtpTransport(): MailTransport {
  if (cachedTransport) return cachedTransport;
  const e = env();
  cachedTransport = nodemailer.createTransport({
    host: e.SMTP_HOST,
    port: e.SMTP_PORT,
    secure: e.SMTP_PORT === 465,
    auth: { user: e.SMTP_USER, pass: e.SMTP_PASS },
    connectionTimeout: 10_000,
    socketTimeout: 15_000,
  });
  return cachedTransport;
}

export type FlushResult = { attempted: number; sent: number; failed: number };

type Queued = { id: string; to_email: string; subject: string; html: string; text_body: string };

/**
 * Deliver queued mail. Best-effort: a failure is recorded on the row, not
 * thrown at the user whose action queued it.
 *
 * Each outcome is its own short transaction, written as soon as it is known. A
 * single transaction around the whole batch would hold a connection across
 * every SMTP round trip, and a crash halfway would un-record messages that had
 * already gone out, to be sent a second time.
 */
export async function flushMail(limit = 20, transport?: MailTransport): Promise<FlushResult> {
  const result: FlushResult = { attempted: 0, sent: 0, failed: 0 };
  if (!transport && !smtpConfigured()) return result;
  const from = env().MAIL_FROM;
  if (!from) return result;
  const sender = transport ?? smtpTransport();

  const queued = await withSystem("mail.flush", (tx) =>
    execRows<Queued>(
      tx,
      sql`select id, to_email, subject, html, text_body from email_outbox
          where status = 'QUEUED' order by created_at limit ${limit}`,
    ),
  );

  for (const message of queued) {
    result.attempted++;
    try {
      await sender.sendMail({
        from,
        to: message.to_email,
        subject: message.subject,
        html: message.html,
        text: message.text_body,
      });
      await withSystem("mail.sent", (tx) =>
        // Once it has left, its words are not kept: a body can be a one-time code, and a table of sent codes is a
        // thing to steal. What was sent, to whom and when stays; what it said does not.
        tx.execute(sql`update email_outbox set status = 'SENT', sent_at = now(), error = null, html = '', text_body = '' where id = ${message.id}`),
      );
      result.sent++;
    } catch (error) {
      // The provider's reply can echo the recipient and the server's banner.
      // Keep the class of failure, not the conversation.
      const reason = error instanceof Error ? (error.name === "Error" ? "send failed" : error.name) : "send failed";
      await withSystem("mail.failed", (tx) =>
        tx.execute(sql`update email_outbox set status = 'FAILED', error = ${reason} where id = ${message.id}`),
      );
      result.failed++;
    }
  }
  return result;
}

export type OutboxEntry = {
  id: string;
  toEmail: string;
  subject: string;
  template: string;
  status: string;
  textBody: string;
  /** ISO-8601 instant. */
  createdAt: string;
};

/** The most recent messages, for the development outbox page only. */
export async function recentOutbox(limit = 50): Promise<OutboxEntry[]> {
  return withSystem("mail.dev-outbox", (tx) =>
    execRows<OutboxEntry>(
      tx,
      sql`select id, to_email as "toEmail", subject, template, status, text_body as "textBody", ${isoInstant(sql`created_at`)} as "createdAt"
          from email_outbox order by email_outbox.created_at desc limit ${limit}`,
    ),
  );
}
