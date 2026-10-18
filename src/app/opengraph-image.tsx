import { ImageResponse } from "next/og";

import { brand } from "@/config/brand";
import { markSvg } from "@/lib/brand/mark-geometry";

export const alt = `${brand.name}: ${brand.tagline}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/*
 * The link-preview image, laid out as a front page. Drawn by an image renderer
 * that understands neither CSS custom properties nor a stylesheet, so this is
 * the one page file where colours are written as literals; it is named in
 * check-tokens' ALLOW list. The values are the day edition's.
 */
const PAPER = "#f3f0e8";
const INK = "#141311";
const MUTED = "#5c574d";
const RED = "#c8102e";

const MARK = `data:image/svg+xml;base64,${Buffer.from(markSvg({ ink: INK, signal: RED, size: 120 })).toString("base64")}`;

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", padding: "56px 72px", background: PAPER, color: INK }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 20, letterSpacing: 3, color: MUTED, textTransform: "uppercase", fontWeight: 700 }}>
          <span>India &amp; World Edition</span>
          <span>Every fifteen minutes</span>
        </div>
        <div style={{ display: "flex", height: 4, background: INK, marginTop: 14 }} />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 24, padding: "22px 0" }}>
          <img src={MARK} width={84} height={84} alt="" />
          <div style={{ fontSize: 76, fontWeight: 800, letterSpacing: -1 }}>{brand.name}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          <div style={{ display: "flex", height: 4, background: INK }} />
          <div style={{ display: "flex", height: 1, background: INK }} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", marginTop: 40, gap: 18 }}>
          <div style={{ fontSize: 22, letterSpacing: 3, color: RED, fontWeight: 700, textTransform: "uppercase" }}>{brand.tagline}</div>
          <div style={{ fontSize: 64, fontWeight: 800, lineHeight: 1.04, letterSpacing: -1.5 }}>The news, with its sources showing.</div>
        </div>
      </div>
    ),
    size,
  );
}
