import { brand } from "@/config/brand";

export type MailContent = {
  subject: string;
  /** The line above everything else: what this message is. */
  heading: string;
  /** Plain paragraphs. Never HTML: every paragraph is escaped on the way out. */
  paragraphs: string[];
  /** A one-time code, shown large and on its own line so it can be read and typed. */
  code?: string;
  action?: { label: string; url: string };
  /** Why the reader is receiving this, and what to do if they did not ask for it. */
  footnote?: string;
};

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/*
 * Email is not the web. A mail client resolves no custom properties, no media
 * queries and no stylesheet, and picks its own background rather than honouring
 * ours. So this is the one file under src/ where colour is written as a literal
 * (it is named in check-tokens' ALLOW list for exactly this reason), at values
 * that read on a light ground.
 */
const INK = "#111827";
const MUTED = "#475467";
const RULE = "#e3e8ef";
const ACCENT = "#2563eb";
const WELL = "#f6f8fb";

export function renderMail(content: MailContent): { html: string; text: string } {
  const paragraphs = content.paragraphs
    .map((p) => `<p style="margin:0 0 16px;color:${MUTED};font-size:15px;line-height:24px">${escapeHtml(p)}</p>`)
    .join("");

  const code = content.code
    ? `<p style="margin:8px 0 24px;padding:16px;background:${WELL};border:1px solid ${RULE};border-radius:10px;color:${INK};font-family:ui-monospace,Menlo,Consolas,monospace;font-size:28px;letter-spacing:6px;text-align:center">${escapeHtml(content.code)}</p>`
    : "";

  const action = content.action
    ? `<p style="margin:8px 0 24px"><a href="${escapeHtml(content.action.url)}" style="display:inline-block;padding:12px 20px;background:${ACCENT};border-radius:10px;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none">${escapeHtml(content.action.label)}</a></p>`
    : "";

  const footnote = content.footnote
    ? `<p style="margin:24px 0 0;padding-top:16px;border-top:1px solid ${RULE};color:${MUTED};font-size:13px;line-height:20px">${escapeHtml(content.footnote)}</p>`
    : "";

  const html =
    `<!doctype html><html lang="en"><body style="margin:0;padding:24px;background:${WELL};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">` +
    `<div style="max-width:520px;margin:0 auto;padding:32px;background:#ffffff;border:1px solid ${RULE};border-radius:14px">` +
    `<p style="margin:0 0 24px;color:${INK};font-size:16px;font-weight:700">${escapeHtml(brand.name)}</p>` +
    `<h1 style="margin:0 0 16px;color:${INK};font-size:22px;line-height:30px">${escapeHtml(content.heading)}</h1>` +
    paragraphs +
    code +
    action +
    footnote +
    `</div></body></html>`;

  const text = [
    brand.name,
    "",
    content.heading,
    "",
    ...content.paragraphs,
    ...(content.code ? ["", content.code] : []),
    ...(content.action ? ["", `${content.action.label}: ${content.action.url}`] : []),
    ...(content.footnote ? ["", content.footnote] : []),
  ].join("\n");

  return { html, text };
}
