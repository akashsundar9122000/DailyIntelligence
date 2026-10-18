import { isIP } from "node:net";

/**
 * Whether an address is one on the public internet.
 *
 * A webhook makes THIS server send a request to an address a user typed. Left
 * unchecked, that is a way to reach things only the server can reach: its own
 * loopback, the private network it sits in, and the cloud metadata service
 * that hands out its credentials. So a delivery goes only to an address that
 * is none of those -- decided on the resolved address, not on the hostname,
 * because a public name can be made to resolve to a private address.
 */
function v4(address: string): number[] | null {
  const parts = address.split(".").map((part) => (/^\d{1,3}$/.test(part) ? Number.parseInt(part, 10) : Number.NaN));
  return parts.length === 4 && parts.every((part) => part >= 0 && part <= 255) ? parts : null;
}

function publicV4([a, b]: number[]): boolean {
  if (a === 0 || a === 10 || a === 127) return false; // "this" network, private, loopback
  if (a === 100 && b! >= 64 && b! <= 127) return false; // carrier-grade NAT
  if (a === 169 && b === 254) return false; // link-local, including the metadata service
  if (a === 172 && b! >= 16 && b! <= 31) return false; // private
  if (a === 192 && (b === 168 || b === 0)) return false; // private; protocol assignments and documentation
  if (a === 198 && (b === 18 || b === 19 || b === 51)) return false; // benchmarking; documentation
  if (a === 203 && b === 0) return false; // documentation
  if (a! >= 224) return false; // multicast and reserved
  return true;
}

/**
 * IPv4 only, on purpose. An IPv6 address can carry an IPv4 one inside it in
 * half a dozen ways (mapped, compatible, NAT64, 6to4, Teredo), each with more
 * than one spelling, and a check that reads the TEXT of an address can be
 * walked past by any spelling it did not think of: `64:ff9b::a9fe:a9fe` is the
 * metadata service. Until addresses are classified from their bytes, nothing
 * is sent to an IPv6 address at all. A name that resolves to one, even beside
 * a public IPv4 address, is refused.
 */
export function isPublicAddress(address: string): boolean {
  return isIP(address) === 4 && publicV4(v4(address)!);
}

export type WebhookUrl = { ok: true; url: URL } | { ok: false; error: string };

/** What a webhook address must look like before it is even resolved. */
export function readWebhookUrl(text: string): WebhookUrl {
  let url: URL;
  try {
    url = new URL(text.trim());
  } catch {
    return { ok: false, error: "Enter a full address, beginning https://." };
  }
  if (url.protocol !== "https:") return { ok: false, error: "The address must begin https://. Events are not sent over an unencrypted connection." };
  if (url.username || url.password) return { ok: false, error: "The address must not contain a user name or a password." };
  if (url.port && url.port !== "443") return { ok: false, error: "The address must use the standard port." };
  const host = url.hostname.replace(/^\[|\]$/g, "");
  // A literal address is checked now; a name is checked when it is resolved, every time.
  if (isIP(host) !== 0 && !isPublicAddress(host)) return { ok: false, error: "That address is not on the public internet." };
  if (!host.includes(".") && isIP(host) === 0) return { ok: false, error: "Enter a full host name, such as example.com." };
  if (/(^|\.)(localhost|local|internal|lan|home|corp)$/i.test(host)) return { ok: false, error: "That address is not on the public internet." };
  return { ok: true, url };
}
