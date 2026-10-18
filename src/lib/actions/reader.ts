"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { CATEGORY_SLUGS, categoryFor } from "@/config/categories";
import { AppError } from "@/lib/errors";
import { FEEDBACK_KINDS, INTEREST_KINDS, INTEREST_STANCES, REPORT_REASONS } from "@/lib/db/schema/reader";
import {
  completeOnboarding,
  createCollection,
  deleteCollection,
  fileReport,
  clearHistory,
  removeInterest,
  saveNotificationPrefs,
  reorderInterests,
  saveOnboardingStep,
  setCategoryFollows,
  setInCollection,
  setInterest,
  toggleBookmark,
  toggleFeedback,
  updateBookmark,
} from "@/lib/services/reader";

import { signedInAction } from "./_define";

const id = z.uuid();

/** Follow, mute or block one topic, place, person, keyword or source. */
export const setInterestAction = signedInAction(
  z.object({
    kind: z.enum(INTEREST_KINDS),
    value: z.string().trim().min(1).max(120),
    label: z.string().trim().min(1).max(120),
    stance: z.enum(INTEREST_STANCES),
    priority: z.boolean().optional(),
  }),
  async (input, { session }) => {
    if (input.kind === "category" && !(CATEGORY_SLUGS as readonly string[]).includes(input.value)) {
      throw new AppError("VALIDATION", "Please check the highlighted fields.", { value: "Choose one of the listed sections." });
    }
    const row = await setInterest(session.user.id, input);
    revalidatePath("/app", "layout");
    return row;
  },
);

export const removeInterestAction = signedInAction(z.object({ id }), async (input, { session }) => {
  await removeInterest(session.user.id, input.id);
  revalidatePath("/app", "layout");
  return { removed: input.id };
});

export const reorderInterestsAction = signedInAction(z.object({ ids: z.array(id).max(60) }), async (input, { session }) => {
  await reorderInterests(session.user.id, input.ids);
  revalidatePath("/app", "layout");
  return { ordered: input.ids.length };
});

/** The whole set of followed sections and top priorities, as onboarding and Settings write them. */
export const setCategoryFollowsAction = signedInAction(
  z.object({ categories: z.array(z.enum(CATEGORY_SLUGS as [string, ...string[]])).max(CATEGORY_SLUGS.length), priorities: z.array(z.string()).max(3) }),
  async (input, { session }) => {
    await setCategoryFollows(
      session.user.id,
      input.categories.map((slug) => ({ slug, label: categoryFor(slug)?.label ?? slug })),
      input.priorities,
    );
    revalidatePath("/app", "layout");
    return { following: input.categories.length };
  },
);

export const onboardingStepAction = signedInAction(z.object({ step: z.number().int().min(1).max(6) }), async (input, { session }) => {
  await saveOnboardingStep(session.user.id, input.step);
  return { step: input.step };
});

export const completeOnboardingAction = signedInAction(z.object({}), async (_input, { session }) => {
  await completeOnboarding(session.user.id);
  revalidatePath("/app", "layout");
  return { done: true };
});

export const toggleBookmarkAction = signedInAction(z.object({ storyId: id }), async (input, { session }) => {
  const result = await toggleBookmark(session.user.id, input.storyId);
  revalidatePath("/app/saved");
  return result;
});

export const updateBookmarkAction = signedInAction(
  z.object({ bookmarkId: id, note: z.string().max(2000).nullable().optional(), read: z.boolean().optional() }),
  async (input, { session }) => {
    await updateBookmark(session.user.id, input.bookmarkId, { note: input.note, read: input.read });
    revalidatePath("/app/saved");
    return { updated: input.bookmarkId };
  },
);

export const createCollectionAction = signedInAction(z.object({ name: z.string().max(200) }), async (input, { session }) => {
  const collection = await createCollection(session.user.id, input.name);
  revalidatePath("/app/saved");
  return collection;
});

export const deleteCollectionAction = signedInAction(z.object({ collectionId: id }), async (input, { session }) => {
  await deleteCollection(session.user.id, input.collectionId);
  revalidatePath("/app/saved");
  return { deleted: input.collectionId };
});

export const setInCollectionAction = signedInAction(
  z.object({ bookmarkId: id, collectionId: id, inCollection: z.boolean() }),
  async (input, { session }) => {
    await setInCollection(session.user.id, input.bookmarkId, input.collectionId, input.inCollection);
    revalidatePath("/app/saved");
    return input;
  },
);

export const feedbackAction = signedInAction(z.object({ storyId: id, kind: z.enum(FEEDBACK_KINDS) }), async (input, { session }) => {
  const result = await toggleFeedback(session.user.id, input.storyId, input.kind);
  revalidatePath("/app", "layout");
  return result;
});

export const reportAction = signedInAction(
  z.object({ storyId: id, itemId: id.nullable().optional(), reason: z.enum(REPORT_REASONS), detail: z.string().max(2000).default("") }),
  async (input, { session }) => fileReport(session.user.id, input),
);

export const clearHistoryAction = signedInAction(z.object({}), async (_input, { session }) => ({ cleared: await clearHistory(session.user.id) }));

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use a time like 07:30.");

export const saveNotificationPrefsAction = signedInAction(
  z.object({
    breaking: z.boolean(),
    hot: z.boolean(),
    topics: z.boolean(),
    storyUpdates: z.boolean(),
    morningBriefing: z.boolean(),
    eveningBriefing: z.boolean(),
    emailDigest: z.boolean(),
    morningAt: time,
    eveningAt: time,
    quietHours: z.boolean(),
    quietStart: time,
    quietEnd: time,
    dailyCap: z.number().int().min(0).max(20),
  }),
  async (input, { session }) => saveNotificationPrefs(session.user.id, input),
);
