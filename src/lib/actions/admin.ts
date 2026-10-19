"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { dryRun, setOpsSwitch, setSourceEnabled, testSendToSelf } from "@/lib/services/admin";
import { SWITCHES, type SwitchKey } from "@/lib/services/ops";

import { signedInAction } from "./_define";

/** Switch a source on or off. The service checks the caller is an administrator; anyone else gets "not found". */
export const setSourceEnabledAction = signedInAction(
  z.object({ sourceId: z.uuid(), enabled: z.boolean(), reason: z.string().max(500).default("") }),
  async (input, { session }) => {
    await setSourceEnabled(session, input);
    revalidatePath("/app/admin");
    return { sourceId: input.sourceId, enabled: input.enabled };
  },
);

const SWITCH_KEYS = SWITCHES.map((entry) => entry.key) as [SwitchKey, ...SwitchKey[]];

/** Flip an operational switch. Off needs a reason; both are written to the audit log. */
export const setOpsSwitchAction = signedInAction(
  z.object({ key: z.enum(SWITCH_KEYS), enabled: z.boolean(), reason: z.string().max(500).default("") }),
  async (input, { session }) => {
    await setOpsSwitch(session, input);
    revalidatePath("/app/admin");
    return { key: input.key, enabled: input.enabled };
  },
);

/** Read a source now and store nothing. */
export const dryRunAction = signedInAction(z.object({ sourceId: z.uuid() }), (input, { session }) => dryRun(session, input.sourceId));

export const testSendAction = signedInAction(z.object({}), (_input, { session }) => testSendToSelf(session));
