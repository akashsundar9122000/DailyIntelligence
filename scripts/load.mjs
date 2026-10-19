#!/usr/bin/env node
/**
 * A small load test: N concurrent clients, each requesting the given paths in
 * turn for D seconds, then requests per second, latency percentiles and every
 * status that was not 2xx. Against a LOCAL production build by default --
 * pointing it at the deployed site spends real function time and would trip
 * the rate limits it is meant to measure around.
 *
 *   pnpm build && pnpm start &   (or any running build)
 *   node scripts/load.mjs --base http://127.0.0.1:4610 --concurrency 20 --seconds 20 / /login /sources /api/health
 */
const args = process.argv.slice(2);
const option = (name, fallback) => {
  const at = args.indexOf(`--${name}`);
  return at >= 0 ? args.splice(at, 2)[1] : fallback;
};
const base = option("base", "http://127.0.0.1:4610");
const concurrency = Number(option("concurrency", "20"));
const seconds = Number(option("seconds", "20"));
const paths = args.length ? args : ["/", "/login", "/sources", "/api/health"];

const latencies = [];
const statuses = new Map();
const deadline = Date.now() + seconds * 1000;

async function client(id) {
  let turn = id;
  while (Date.now() < deadline) {
    const path = paths[turn++ % paths.length];
    const started = performance.now();
    try {
      // A distinct address per client, so one client's rate limit is not everyone's.
      const response = await fetch(`${base}${path}`, { headers: { "x-real-ip": `198.51.100.${(id % 250) + 1}` } });
      await response.arrayBuffer();
      statuses.set(response.status, (statuses.get(response.status) ?? 0) + 1);
    } catch {
      statuses.set("error", (statuses.get("error") ?? 0) + 1);
    }
    latencies.push(performance.now() - started);
  }
}

await Promise.all(Array.from({ length: concurrency }, (_, id) => client(id)));
latencies.sort((a, b) => a - b);
const at = (p) => Math.round(latencies[Math.min(latencies.length - 1, Math.floor((p / 100) * latencies.length))]);
console.log(`${latencies.length} requests in ${seconds}s from ${concurrency} clients: ${Math.round(latencies.length / seconds)}/s`);
console.log(`latency ms  p50 ${at(50)}  p95 ${at(95)}  p99 ${at(99)}  max ${Math.round(latencies.at(-1))}`);
console.log(`statuses    ${[...statuses.entries()].map(([status, count]) => `${status}: ${count}`).join("  ")}`);
