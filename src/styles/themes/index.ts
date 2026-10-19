// Relative, not "@/": the generator and the contrast check import this under
// tsx, and a path alias they failed to resolve would fail the gate for a reason
// unrelated to colour.
import type { Palette } from "../../lib/design/palettes";

import { aurora } from "./aurora";
import { newspaper } from "./newspaper";
import type { PaletteSource } from "./schema";

/**
 * Every offered palette's source. Typed against PALETTES, so a palette listed
 * there with no source here -- or a source for one not listed -- does not
 * compile.
 */
export const PALETTE_SOURCES: Record<Palette, PaletteSource> = { aurora, newspaper };
