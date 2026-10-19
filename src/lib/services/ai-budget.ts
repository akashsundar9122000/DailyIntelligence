import "server-only";

import { AppError } from "@/lib/errors";
import { LIMITS, take } from "@/lib/rate-limit";

/**
 * Every model call a reader starts (a question, a search by meaning) is
 * counted three ways: per account, per address of the caller, and for all
 * readers together in a day. Each fails CLOSED -- these are paid calls, and a
 * counter that cannot be reached must not become an unlimited allowance.
 * Background work has its own ceiling (AI_DAILY_LIMIT).
 */
export async function takeReaderAiCall(userId: string, ip: string, kind: "ask" | "meaning"): Promise<void> {
  const now = new Date();
  const closed = { failClosed: true };
  const hourly = await take(`${kind}:${userId}`, LIMITS.aiPerUser, now, closed);
  if (!hourly.ok) throw new AppError("RATE_LIMITED", "You have asked a lot this hour. Please try again later.");
  const daily = await take(`${kind}-day:${userId}`, LIMITS.aiPerUserDaily, now, closed);
  if (!daily.ok) throw new AppError("RATE_LIMITED", "You have reached today's limit. It resets tomorrow.");
  const network = await take(`ai-ip:${ip}`, LIMITS.aiPerIp, now, closed);
  if (!network.ok) throw new AppError("RATE_LIMITED", "Too many requests from this network. Please try again later.");
  const everyone = await take("ai-readers-day", LIMITS.aiReadersDaily, now, closed);
  if (!everyone.ok) throw new AppError("RATE_LIMITED", "The paper has answered as many questions as it can today. Please try again tomorrow.");
}
