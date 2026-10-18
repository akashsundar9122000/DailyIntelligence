"use server";

import { updatePreferences } from "@/lib/services/preferences";
import { preferencesPatchSchema } from "@/lib/settings/preferences";

import { signedInAction } from "./_define";

/** Save any subset of the signed-in user's preferences. Returns what is now stored. */
export const savePreferencesAction = signedInAction(preferencesPatchSchema, (patch, { session }) =>
  updatePreferences(session.user.id, patch),
);
