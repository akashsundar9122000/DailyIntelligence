/**
 * The mark's geometry, in one place, so the inline component, the static SVG
 * files and the raster icons are the same drawing and cannot drift.
 *
 * A 64-unit square. A solid D (the daily paper) with three things cut out of
 * it: a globe's window, two orbit arcs (the signal going out) and three rising
 * bars (the ranking). The globe sits in the window as a solid disc with its
 * equator and meridians cut out. One ink, so it prints in any single colour;
 * the only colour is the signal dot, which is the spot red.
 *
 * The cut-outs are real holes -- subpaths under the even-odd fill rule -- not
 * masks and not paper-coloured shapes on top. A paper-coloured shape is right
 * on paper and wrong on everything else; a mask needs literal white and black,
 * which is a colour outside the tokens. Under even-odd, two holes that overlap
 * fill back in, so no two holes here overlap: the equator is drawn as the
 * segments BETWEEN the meridians, and the central meridian stops short of the
 * curved ones at the poles.
 */
export const MARK_VIEWBOX = "0 0 64 64";

const r = (n: number) => Math.round(n * 100) / 100;

/** A filled circle as a subpath. */
function circle(cx: number, cy: number, radius: number): string {
  return `M${r(cx - radius)} ${cy}a${radius} ${radius} 0 1 0 ${r(radius * 2)} 0a${radius} ${radius} 0 1 0 ${r(-radius * 2)} 0z`;
}

/** A filled ellipse as a subpath. */
function ellipse(cx: number, cy: number, rx: number, ry: number): string {
  return `M${r(cx - rx)} ${cy}a${rx} ${ry} 0 1 0 ${r(rx * 2)} 0a${rx} ${ry} 0 1 0 ${r(-rx * 2)} 0z`;
}

function rect(x: number, y: number, width: number, height: number): string {
  return `M${r(x)} ${r(y)}h${r(width)}v${r(height)}h${r(-width)}z`;
}

/**
 * A round-capped arc band: the outline of a stroke of `width` along a circle of
 * radius `radius`, from -angle to +angle degrees either side of 3 o'clock.
 */
function arcBand(cx: number, cy: number, radius: number, angle: number, width: number): string {
  const half = width / 2;
  const outer = radius + half;
  const inner = radius - half;
  const a = (angle * Math.PI) / 180;
  const point = (rad: number, sign: number) => [r(cx + rad * Math.cos(a)), r(cy + sign * rad * Math.sin(a))];
  const [ox1, oy1] = point(outer, -1);
  const [ox2, oy2] = point(outer, 1);
  const [ix2, iy2] = point(inner, 1);
  const [ix1, iy1] = point(inner, -1);
  return `M${ox1} ${oy1}A${outer} ${outer} 0 0 1 ${ox2} ${oy2}A${half} ${half} 0 0 1 ${ix2} ${iy2}A${inner} ${inner} 0 0 0 ${ix1} ${iy1}A${half} ${half} 0 0 1 ${ox1} ${oy1}z`;
}

const CX = 30;
const CY = 32;
const GLOBE_DISC = 8.6;
const LINE = 1.5;
const MERIDIAN_RX = 3.9;
// The band's outer edge meets the rim at the poles and never crosses it: a hole outside the disc is ink.
const MERIDIAN_RY = GLOBE_DISC - LINE / 2;

/** The D, with the window, the orbits and the bars as holes. */
export const D_PATH = [
  "M8 6h22c14.36 0 26 11.64 26 26S44.36 58 30 58H8z",
  circle(CX, CY, 12),
  arcBand(CX, CY, 16, 50, 2.8),
  arcBand(CX, CY, 20, 38, 2.8),
  rect(10.4, 49, 2.8, 5),
  rect(14.6, 46.5, 2.8, 7.5),
  rect(18.8, 44, 2.8, 10),
].join("");

/*
 * The globe: a disc with a curved meridian band (an outer ellipse and an inner
 * one), a straight central meridian, and the equator in the three gaps the
 * meridians leave. Under even-odd the inner ellipse refills the band's middle,
 * which is exactly the disc we want there.
 */
const halfLine = LINE / 2;
const equatorY = CY - halfLine;
// Where the equator's edges meet the disc's rim, so its outer segments end exactly at the circle.
const leftEdge = CX - Math.sqrt(GLOBE_DISC * GLOBE_DISC - halfLine * halfLine);
const bandOuter = CX - MERIDIAN_RX - halfLine;
const bandInner = CX - MERIDIAN_RX + halfLine;
const centre = CX - halfLine;
export const GLOBE_PATH = [
  circle(CX, CY, GLOBE_DISC),
  ellipse(CX, CY, MERIDIAN_RX + halfLine, MERIDIAN_RY + halfLine),
  ellipse(CX, CY, MERIDIAN_RX - halfLine, MERIDIAN_RY - halfLine),
  // The central meridian, stopped short of where the curved band meets it at the poles.
  rect(centre, CY - 6.8, LINE, 13.6),
  // The equator, in the gaps between the meridians, mirrored either side of centre.
  rect(leftEdge, equatorY, bandOuter - leftEdge, LINE),
  rect(bandInner, equatorY, centre - bandInner, LINE),
  rect(CX + halfLine, equatorY, centre - bandInner, LINE),
  rect(CX + MERIDIAN_RX + halfLine, equatorY, bandOuter - leftEdge, LINE),
].join("");

/** The signal dot, at the start of the outer orbit. */
export const SIGNAL = { cx: 44.4, cy: 15.2, r: 4.2 };

/** A standalone SVG document of the mark, in the given ink, for the static files and icons. */
export function markSvg({ ink, signal, background, size = 64, inset = 0 }: { ink: string; signal: string; background?: string; size?: number; inset?: number }): string {
  const scale = (64 - inset * 2) / 64;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${MARK_VIEWBOX}" width="${size}" height="${size}">${background ? `<rect width="64" height="64" fill="${background}"/>` : ""}<g transform="translate(${inset} ${inset}) scale(${scale})"><path fill="${ink}" fill-rule="evenodd" d="${D_PATH}"/><path fill="${ink}" fill-rule="evenodd" d="${GLOBE_PATH}"/><circle cx="${SIGNAL.cx}" cy="${SIGNAL.cy}" r="${SIGNAL.r}" fill="${signal}"/></g></svg>\n`;
}
