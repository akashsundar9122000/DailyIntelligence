"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { dryRun, mergeStories, resolveReport, setOpsSwitch, setSourceEnabled, splitItem, testSendToSelf } from "@/lib/services/admin";
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

export const resolveReportAction = signedInAction(
  z.object({ reportId: z.uuid(), status: z.enum(["actioned", "dismissed"]), resolution: z.string().max(500).default("") }),
  async (input, { session }) => {
    await resolveReport(session, input);
    revalidatePath("/app/admin");
    return { reportId: input.reportId, status: input.status };
  },
);

/** Merge one story into another. Confirmed in the page; checked again here. */
export const mergeStoriesAction = signedInAction(z.object({ keepId: z.uuid(), mergeId: z.uuid() }), async (input, { session }) => {
  const result = await mergeStories(session, input);
  revalidatePath("/app/admin");
  revalidatePath(`/app/story/${input.keepId}`);
  return result;
});

export const splitItemAction = signedInAction(z.object({ storyId: z.uuid(), itemId: z.uuid() }), async (input, { session }) => {
  const result = await splitItem(session, input);
  revalidatePath(`/app/story/${input.storyId}`);
  return result;
});
