import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

/**
 * A certificate for the stand-in push service, made once per run.
 *
 * The web-push library speaks HTTPS only, as every real push service does, so
 * the stand-in must too. The suite's server is told to trust this one
 * certificate (NODE_EXTRA_CA_CERTS in playwright.config.ts) and nothing else
 * changes: no product code knows it is under test. Valid for 127.0.0.1 only,
 * for two days, and kept in the system's temporary folder, never in the repository.
 */
function make(): { cert: string; key: string } {
  if (process.env.E2E_PUSH_CERT && process.env.E2E_PUSH_KEY && existsSync(process.env.E2E_PUSH_CERT)) return { cert: process.env.E2E_PUSH_CERT, key: process.env.E2E_PUSH_KEY };
  // Not under test-results: Playwright empties that folder when a run starts, after this has run.
  const dir = path.join(tmpdir(), "daily-intelligence-e2e-push-tls");
  mkdirSync(dir, { recursive: true });
  const cert = path.join(dir, "cert.pem");
  const key = path.join(dir, "key.pem");
  execFileSync("openssl", [
    "req", "-x509", "-newkey", "ec", "-pkeyopt", "ec_paramgen_curve:prime256v1", "-nodes", "-days", "2",
    "-subj", "/CN=127.0.0.1", "-addext", "subjectAltName=IP:127.0.0.1", "-keyout", key, "-out", cert,
  ], { stdio: "ignore" });
  process.env.E2E_PUSH_CERT = cert;
  process.env.E2E_PUSH_KEY = key;
  return { cert, key };
}

export const PUSH_TLS = make();
export const PUSH_STUB_PORT = 4598;
