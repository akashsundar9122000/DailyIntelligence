import "server-only";

import type { z } from "zod";
import { uuidv7 } from "uuidv7";

import { getSession, type CurrentSession } from "@/lib/auth/session";
import { assertRecentStepUp } from "@/lib/auth/step-up";
import { isFrameworkSignal, toFailure, type ErrorCode } from "@/lib/errors";
import { assertSameOrigin } from "@/lib/http/request";
import { parseInput } from "@/lib/validation";

/**
 * Server-action wrappers. Every exported action in lib/actions/* is built with
 * one of these -- check:guards fails the gate otherwise -- because a server
 * action is its own entrypoint: no layout guard and no proxy runs before it.
 *
 * Each one asserts same-origin, parses the input, runs the handler, and turns
 * a known failure into a typed result instead of a thrown 500.
 */
export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: ErrorCode; message: string; fieldErrors?: Record<string, string>; reference: string };

/** Anyone, signed in or not. The handler still decides what it allows. */
export function publicAction<S extends z.ZodType, T>(schema: S, handler: (input: z.infer<S>) => Promise<T>) {
  return async (input: z.input<S>): Promise<ActionResult<T>> => {
    const reference = uuidv7();
    try {
      await assertSameOrigin();
      return { ok: true, data: await handler(parseInput(schema, input)) };
    } catch (error) {
      if (isFrameworkSignal(error)) throw error;
      return { ok: false, ...toFailure(error, `action ${reference}`), reference };
    }
  };
}

/**
 * A signed-in person. The session is resolved from the database here, on every
 * call: an action is reachable directly, whatever the page that renders its
 * form was guarded by.
 *
 * `stepUp: true` additionally requires the session to have proved its identity
 * in the last ten minutes. Use it for anything that cannot be undone.
 */
export function signedInAction<S extends z.ZodType, T>(
  schema: S,
  handler: (input: z.infer<S>, context: { session: CurrentSession }) => Promise<T>,
  options: { stepUp?: boolean } = {},
) {
  return async (input: z.input<S>): Promise<ActionResult<T>> => {
    const reference = uuidv7();
    try {
      await assertSameOrigin();
      const session = await getSession();
      if (!session) {
        return { ok: false, code: "UNAUTHENTICATED", message: "Please sign in to continue.", reference };
      }
      if (options.stepUp) assertRecentStepUp(session);
      return { ok: true, data: await handler(parseInput(schema, input), { session }) };
    } catch (error) {
      if (isFrameworkSignal(error)) throw error;
      return { ok: false, ...toFailure(error, `action ${reference}`), reference };
    }
  };
}
