import type { z } from "zod";

import { AppError } from "@/lib/errors";

/** Parse untrusted input, or throw a VALIDATION error keyed by field path. */
export function parseInput<S extends z.ZodType>(schema: S, input: unknown): z.infer<S> {
  const result = schema.safeParse(input);
  if (result.success) return result.data;
  const fieldErrors: Record<string, string> = {};
  for (const issue of result.error.issues) fieldErrors[issue.path.join(".") || "_"] ??= issue.message;
  throw new AppError("VALIDATION", "Please check the highlighted fields.", fieldErrors);
}
