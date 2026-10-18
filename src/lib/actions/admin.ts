"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { setSourceEnabled } from "@/lib/services/admin";

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
