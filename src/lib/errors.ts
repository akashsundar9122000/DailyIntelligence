export type ErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION"
  | "CONFLICT"
  | "UNAVAILABLE"
  | "RATE_LIMITED"
  | "INVALID_STATE"
  | "INTERNAL";

/** An error meant for the person using the app. `message` is safe to show. */
export class AppError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly fieldErrors?: Record<string, string>,
  ) {
    super(message);
    this.name = "AppError";
  }
}

/*
 * Another user's resource is reported as NOT FOUND, never as forbidden. A 403
 * confirms the thing exists, which is itself a leak: it lets anybody enumerate
 * which portfolio ids are real.
 */
export const notFound = (what = "That") => new AppError("NOT_FOUND", `${what} was not found.`);
export const forbidden = (message = "You do not have permission to do that.") => new AppError("FORBIDDEN", message);
export const invalidState = (message: string) => new AppError("INVALID_STATE", message);
export const unavailable = (message = "That is temporarily unavailable. Please try again shortly.") =>
  new AppError("UNAVAILABLE", message);

/** The HTTP status each code answers with. One table, so two routes cannot disagree. */
export const HTTP_STATUS: Record<ErrorCode, number> = {
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  VALIDATION: 422,
  CONFLICT: 409,
  UNAVAILABLE: 503,
  RATE_LIMITED: 429,
  INVALID_STATE: 409,
  INTERNAL: 500,
};

/**
 * Translate a Postgres refusal into something a person can act on.
 *
 * Only the SQLSTATE is read. The driver's message carries table, column and
 * constraint names and occasionally the offending value; none of it may reach
 * a client.
 */
export function fromDbError(error: unknown): AppError | null {
  const e = error as { code?: unknown; cause?: { code?: unknown } } | null;
  const code = typeof e?.code === "string" ? e.code : typeof e?.cause?.code === "string" ? e.cause.code : undefined;
  switch (code) {
    case "42501": // insufficient privilege, including a row-level security refusal
      return forbidden();
    case "23505":
      return new AppError("CONFLICT", "That already exists.");
    case "23503":
      return new AppError("VALIDATION", "A referenced record does not exist.");
    case "23514":
    case "22023":
      return new AppError("VALIDATION", "Some values are out of range.");
    default:
      return null;
  }
}

/** Next's redirect() and notFound() work by throwing. They must pass through untouched. */
export function isFrameworkSignal(error: unknown): boolean {
  if (!error || typeof error !== "object" || !("digest" in error)) return false;
  const digest = (error as { digest: unknown }).digest;
  return typeof digest === "string" && digest.startsWith("NEXT_");
}

export type Failure = { code: ErrorCode; message: string; fieldErrors?: Record<string, string> };

/**
 * The single place an unknown thrown value becomes something safe to return.
 * `reference` is logged with the real error so a person can quote it to
 * support without the response carrying the error itself.
 */
export function toFailure(error: unknown, reference: string): Failure {
  if (error instanceof AppError) {
    return { code: error.code, message: error.message, ...(error.fieldErrors ? { fieldErrors: error.fieldErrors } : {}) };
  }
  const fromDb = fromDbError(error);
  if (fromDb) return { code: fromDb.code, message: fromDb.message };
  console.error(`[${reference}] unexpected error`, error);
  return { code: "INTERNAL", message: "Something went wrong. Please try again." };
}
