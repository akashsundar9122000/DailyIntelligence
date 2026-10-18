import "server-only";

import { NextResponse, type NextRequest } from "next/server";
import type { z } from "zod";
import { uuidv7 } from "uuidv7";

import { sessionFromHeaders, type CurrentSession } from "@/lib/auth/session";
import { assertRecentStepUp } from "@/lib/auth/step-up";
import { AppError, HTTP_STATUS, isFrameworkSignal, toFailure, type Failure } from "@/lib/errors";
import { assertSameOriginHeaders, clientIp } from "@/lib/http/request";
import { take, type Limit } from "@/lib/rate-limit";
import { parseInput } from "@/lib/validation";

/**
 * The one shape every JSON endpoint answers in.
 *
 *   { ok: true,  data,  requestId }
 *   { ok: false, error: { code, message, fieldErrors? }, requestId }
 *
 * The request id is also the X-Request-Id header and is logged beside the real
 * error, so a person can quote it without the response carrying a stack trace,
 * a SQL message or a provider's reply.
 */
export type ApiSuccess<T> = { ok: true; data: T; requestId: string };
export type ApiFailure = { ok: false; error: Failure; requestId: string };

type RouteContext<P> = { params: Promise<P> };

type RouteOptions<Q extends z.ZodType | undefined, B extends z.ZodType | undefined> = {
  /** Validates the query string. */
  query?: Q;
  /** Validates a JSON body. Declaring one makes the route a mutation: it is then same-origin only. */
  body?: B;
  /** Per-address limit, taken before any work is done. */
  limit?: { name: string; rule: Limit };
  /**
   * Require a signed-in session, resolved from the database for this request.
   * `stepUp` additionally requires a recent re-proof of identity.
   */
  session?: "required" | "stepUp";
};

type Infer<S> = S extends z.ZodType ? z.infer<S> : undefined;

function respond<T>(body: ApiSuccess<T> | ApiFailure, status: number, extra?: Record<string, string>) {
  return NextResponse.json(body, {
    status,
    headers: { "X-Request-Id": body.requestId, "Cache-Control": "no-store", ...extra },
  });
}

export function defineRoute<
  T,
  P = Record<string, never>,
  Q extends z.ZodType | undefined = undefined,
  B extends z.ZodType | undefined = undefined,
>(
  options: RouteOptions<Q, B>,
  handler: (input: {
    query: Infer<Q>;
    body: Infer<B>;
    params: P;
    requestId: string;
    request: NextRequest;
    /** Present when the route asked for one; null otherwise. */
    session: CurrentSession | null;
  }) => Promise<T | Response>,
) {
  return async (request: NextRequest, context: RouteContext<P>) => {
    const requestId = uuidv7();
    try {
      if (options.limit) {
        // Before any scope is opened: the limiter counts in its own transaction.
        const taken = await take(`${options.limit.name}:${clientIp(request.headers)}`, options.limit.rule);
        if (!taken.ok) {
          return respond(
            { ok: false, error: { code: "RATE_LIMITED", message: "Too many requests. Please wait a moment." }, requestId },
            HTTP_STATUS.RATE_LIMITED,
            { "Retry-After": String(taken.retryAfterSeconds) },
          );
        }
      }

      let session: CurrentSession | null = null;
      if (options.session) {
        session = await sessionFromHeaders(request.headers);
        if (!session) throw new AppError("UNAUTHENTICATED", "Please sign in to continue.");
        if (options.session === "stepUp") assertRecentStepUp(session);
      }

      let body: unknown;
      if (options.body) {
        assertSameOriginHeaders(request.headers);
        try {
          body = await request.json();
        } catch {
          throw new AppError("VALIDATION", "The request body must be JSON.");
        }
      }

      const data = await handler({
        query: (options.query
          ? parseInput(options.query, Object.fromEntries(request.nextUrl.searchParams))
          : undefined) as Infer<Q>,
        body: (options.body ? parseInput(options.body, body) : undefined) as Infer<B>,
        params: await context.params,
        requestId,
        request,
        session,
      });
      // A handler may answer for itself -- a file download is not an envelope.
      if (data instanceof Response) {
        data.headers.set("X-Request-Id", requestId);
        data.headers.set("Cache-Control", "no-store");
        return data;
      }
      return respond({ ok: true, data, requestId }, 200);
    } catch (error) {
      if (isFrameworkSignal(error)) throw error;
      const failure = toFailure(error, `api ${requestId}`);
      return respond({ ok: false, error: failure, requestId }, HTTP_STATUS[failure.code]);
    }
  };
}
