"use server";

import { headers } from "next/headers";
import { z } from "zod";

import { MAX_QUESTION_CHARS } from "@/lib/ai/ask";
import { clientIp } from "@/lib/http/request";
import { askAboutStory } from "@/lib/services/ask";

import { signedInAction } from "./_define";

/** Ask about one story; answered from its records or not at all. */
export const askAboutStoryAction = signedInAction(z.object({ storyId: z.uuid(), question: z.string().max(MAX_QUESTION_CHARS * 2) }), async (input, { session }) =>
  askAboutStory(session.user.id, input.storyId, input.question, undefined, clientIp(await headers())),
);
