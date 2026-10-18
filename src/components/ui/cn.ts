import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merge class names, resolving Tailwind conflicts.
 *
 * twMerge is the half that matters. With it, a `className` prop is a RELIABLE
 * OVERRIDE, which is the contract every component here promises.
 *
 * Two things to know about it:
 *
 *  - It resolves conflicts by LATER ARGUMENT WINS, and it silently deletes the
 *    padding it decides is redundant. Put the shorthand FIRST in any cn() whose
 *    later arguments refine it: cn("p-4", "pt-2") keeps both; cn("pt-2", "p-4")
 *    loses the pt-2.
 *  - When a utility appears not to apply, PRINT THE MERGED STRING before
 *    inspecting CSS.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
