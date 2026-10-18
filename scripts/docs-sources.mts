#!/usr/bin/env tsx
/** Writes docs/SOURCE_RIGHTS.md from the source catalogue. */
import { writeFileSync } from "node:fs";

import { renderSourceRights } from "../src/lib/sources/rights-doc";

writeFileSync("docs/SOURCE_RIGHTS.md", renderSourceRights());
console.log("docs/SOURCE_RIGHTS.md written from the catalogue");
