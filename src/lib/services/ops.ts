import "server-only";

import { sql } from "drizzle-orm";
import { uuidv7 } from "uuidv7";

import { PROVIDERS } from "@/lib/db/schema/news";
import { execRows, withPublic, withSystem } from "@/lib/db/scope";
import { isoInstant } from "@/lib/db/sql";

/**
 * The switches an administrator flips without a deploy. A key with no row is
 * ON: the switch exists to stop something, and a missing row must never be
 * what stops the paper.
 */
export const SWITCHES = [
  { key: "ingestion", label: "Reading sources", detail: "Every source, every tick." },
  ...PROVIDERS.map((provider) => ({ key: `provider:${provider}`, label: `Provider: ${provider}`, detail: "Every source read through this adapter." })),
  { key: "ai", label: "AI pass", detail: "Explainers and the edition briefing." },
  { key: "ai_images", label: "AI illustrations", detail: "Pictures drawn for top stories; stories keep their cover art." },
  { key: "notifications", label: "Notifications", detail: "Every alert, briefing and digest, for every reader." },
] as const;
export type SwitchKey = (typeof SWITCHES)[number]["key"];

export type SwitchState = { key: SwitchKey; label: string; detail: string; enabled: boolean; reason: string | null; changedAt: string | null };

export async function switchesOff(): Promise<Set<string>> {
  const rows = await withPublic((tx) => execRows<{ key: string }>(tx, sql`select key from ops_switches where not enabled`));
  return new Set(rows.map((row) => row.key));
}

export async function isOn(key: SwitchKey): Promise<boolean> {
  return !(await switchesOff()).has(key);
}

export async function listSwitches(): Promise<SwitchState[]> {
  const rows = await withPublic((tx) =>
    execRows<{ key: string; enabled: boolean; reason: string | null; changedAt: string }>(
      tx,
      sql`select key, enabled, reason, ${isoInstant(sql`changed_at`)} as "changedAt" from ops_switches`,
    ),
  );
  const byKey = new Map(rows.map((row) => [row.key, row]));
  return SWITCHES.map((entry) => {
    const row = byKey.get(entry.key);
    return { ...entry, enabled: row?.enabled ?? true, reason: row?.reason ?? null, changedAt: row?.changedAt ?? null };
  });
}

/** Flip a switch, with the reason and who, and write it to the audit log in the same transaction. */
export async function setSwitch(key: SwitchKey, enabled: boolean, reason: string, actorUserId: string): Promise<void> {
  const why = reason.trim().slice(0, 500);
  await withSystem(`ops.switch:${key}`, async (tx) => {
    await tx.execute(
      sql`insert into ops_switches (key, enabled, reason, changed_by) values (${key}, ${enabled}, ${why || null}, ${actorUserId})
          on conflict (key) do update set enabled = excluded.enabled, reason = excluded.reason, changed_by = excluded.changed_by, changed_at = now()`,
    );
    await tx.execute(
      sql`insert into audit_events (id, actor_user_id, action, target_kind, target_id, detail)
          values (${uuidv7()}::uuid, ${actorUserId}::uuid, ${enabled ? "switch.on" : "switch.off"}, 'switch', ${key}, ${why})`,
    );
  });
}
