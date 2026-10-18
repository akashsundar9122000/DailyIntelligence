import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";
import { defineConfig } from "vitest/config";

/*
 * The live-model evaluation. NOT part of `pnpm verify`.
 *
 * It asks the real hosted model real questions against the local test database
 * and reports what the pipeline did with each answer. It needs a key, costs
 * money, takes a minute and depends on a service outside this repository, any
 * one of which disqualifies it from a gate that must give the same answer
 * twice. Run it by hand after changing a prompt, a tool or the model list:
 *
 *   pnpm eval:ai
 */
loadEnv({ path: ".env.local", quiet: true });
const testUrl = process.env.DATABASE_URL_TEST;
if (!testUrl) throw new Error("DATABASE_URL_TEST is not set. See .env.example.");
if (!process.env.NVIDIA_API_KEY) throw new Error("NVIDIA_API_KEY is not set, so there is no model to evaluate. This is not a test that can run without one.");

export default defineConfig({
  test: {
    name: "eval",
    environment: "node",
    include: ["tests/eval/**/*.eval.ts"],
    globalSetup: ["tests/integration/global-setup.ts"],
    env: { DATABASE_URL: testUrl, DATABASE_URL_AUTH: testUrl.replace("//di_app@", "//di_auth@"), AUTH_LIMIT_DEFAULT: "5000", AUTH_LIMIT_SIGN_UP: "5000", AUTH_LIMIT_CODE: "5000" },
    fileParallelism: false,
    maxWorkers: 1,
    testTimeout: 180_000,
    hookTimeout: 120_000,
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "server-only": fileURLToPath(new URL("./tests/stubs/server-only.ts", import.meta.url)),
    },
  },
});
