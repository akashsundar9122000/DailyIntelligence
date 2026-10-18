import { sql } from "drizzle-orm";
import { uuidv7 } from "uuidv7";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";

import { closeDb } from "@/lib/db/client";
import { execRows, withSystem, withUser } from "@/lib/db/scope";
import { flushMail, queueMail, type MailTransport } from "@/lib/mail/send";

afterAll(async () => {
  await closeDb();
});
afterEach(() => vi.unstubAllEnvs());

const content = { subject: "Your code", heading: "Confirm your email", paragraphs: ["Enter the code."], code: "482913" };
const address = () => `reader-${uuidv7()}@example.in`;

async function statusOf(id: string) {
  const rows = await withSystem("test", (tx) =>
    execRows<{ status: string; error: string | null; sent: boolean }>(
      tx,
      sql`select status, error, sent_at is not null as sent from email_outbox where id = ${id}`,
    ),
  );
  return rows[0] ?? null;
}

/** SMTP settings are parsed once per module instance, so each case loads its own. */
async function withSmtp(configured: boolean) {
  vi.resetModules();
  vi.stubEnv("SMTP_HOST", configured ? "smtp.example.in" : "");
  vi.stubEnv("SMTP_USER", configured ? "mailer" : "");
  vi.stubEnv("SMTP_PASS", configured ? "not-a-real-password" : "");
  vi.stubEnv("MAIL_FROM", configured ? "Sender <no-reply@example.in>" : "");
  return {
    mail: await import("@/lib/mail/send"),
    scope: await import("@/lib/db/scope"),
    client: await import("@/lib/db/client"),
  };
}

describe("queueing mail", () => {
  it("records a message as DEV, not sent, when no SMTP is configured", async () => {
    const id = await withUser(uuidv7(), (tx) => queueMail(tx, address(), "verify-email", content));
    expect(await statusOf(id)).toEqual({ status: "DEV", error: null, sent: false });
  });

  it("can be queued from a user's own transaction without that user seeing the outbox", async () => {
    const seen = await withUser(uuidv7(), async (tx) => {
      await queueMail(tx, address(), "verify-email", content);
      // The function raised the role for one INSERT. It must have put it back.
      return {
        role: (await execRows<{ role: string }>(tx, sql`select current_setting('app.role', true) as role`))[0]?.role,
        visible: (await execRows(tx, sql`select 1 from email_outbox`)).length,
      };
    });
    expect(seen).toEqual({ role: "USER", visible: 0 });
  });

  it("sends nothing when the change that queued it is rolled back", async () => {
    const to = address();
    await expect(
      withUser(uuidv7(), async (tx) => {
        await queueMail(tx, to, "password-changed", content);
        throw new Error("the change failed");
      }),
    ).rejects.toThrow("the change failed");
    const rows = await withSystem("test", (tx) => execRows(tx, sql`select 1 from email_outbox where to_email = ${to}`));
    expect(rows).toEqual([]);
  });

  it("does not deliver DEV messages even when given a transport", async () => {
    const to = address();
    const id = await withUser(uuidv7(), (tx) => queueMail(tx, to, "verify-email", content));
    const recipients: string[] = [];
    const transport: MailTransport = {
      async sendMail(message) {
        recipients.push(message.to);
        return {};
      },
    };
    vi.stubEnv("MAIL_FROM", "Sender <no-reply@example.in>");
    vi.resetModules();
    const fresh = await import("@/lib/mail/send");
    await fresh.flushMail(500, transport);
    // A message recorded while mail was off must never go out later by accident.
    expect(recipients).not.toContain(to);
    expect((await statusOf(id))?.status).toBe("DEV");
    await (await import("@/lib/db/client")).closeDb();
  });
});

describe("delivering mail", () => {
  it("does nothing, and says so, when SMTP is not configured", async () => {
    expect(await flushMail()).toEqual({ attempted: 0, sent: 0, failed: 0 });
  });

  it("marks a delivered message SENT and a refused one FAILED, each on its own row", async () => {
    const { mail, scope, client } = await withSmtp(true);
    const good = address();
    const bad = address();
    const ids = await scope.withUser(uuidv7(), async (tx) => ({
      good: await mail.queueMail(tx, good, "verify-email", content),
      bad: await mail.queueMail(tx, bad, "verify-email", content),
    }));
    expect((await statusOf(ids.good))?.status).toBe("QUEUED");

    const delivered: string[] = [];
    const transport: MailTransport = {
      async sendMail(message) {
        if (message.to === bad) throw new Error(`550 mailbox ${bad} unavailable`);
        delivered.push(message.to);
        return {};
      },
    };
    const result = await mail.flushMail(500, transport);

    expect(delivered).toContain(good);
    expect(result.failed).toBeGreaterThanOrEqual(1);
    // Read back from the table, not from the summary the function returned.
    expect(await statusOf(ids.good)).toEqual({ status: "SENT", error: null, sent: true });
    // What it said is not kept once it has left: a body can be a one-time code.
    const kept = await withSystem("test", (tx) => execRows<{ html: string; text_body: string; subject: string }>(tx, sql`select html, text_body, subject from email_outbox where id = ${ids.good}`));
    expect(kept[0]).toMatchObject({ html: "", text_body: "" });
    expect(kept[0]!.subject.length).toBeGreaterThan(0);
    const failed = await statusOf(ids.bad);
    expect(failed).toMatchObject({ status: "FAILED", sent: false });
    // The provider's reply echoes the address; only the class of failure is kept.
    expect(failed?.error).not.toContain(bad);
    await client.closeDb();
  });

  it("does not send a message twice", async () => {
    const { mail, scope, client } = await withSmtp(true);
    const to = address();
    await scope.withUser(uuidv7(), (tx) => mail.queueMail(tx, to, "verify-email", content));
    const recipients: string[] = [];
    const transport: MailTransport = {
      async sendMail(message) {
        recipients.push(message.to);
        return {};
      },
    };
    await mail.flushMail(500, transport);
    await mail.flushMail(500, transport);
    expect(recipients.filter((recipient) => recipient === to)).toHaveLength(1);
    await client.closeDb();
  });
});
