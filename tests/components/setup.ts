import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Without this, each render stays mounted and the next test finds two of
// everything -- which reports as "multiple elements found", not as a leak.
afterEach(() => cleanup());
