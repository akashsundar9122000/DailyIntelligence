/**
 * The light behind the page: three slow orbs of the palette's glows. Drawn
 * and moved entirely in CSS (.atmosphere in src/styles/palettes.css), which
 * also decides whether a palette has one at all -- so this renders the same
 * markup for every reader, and the server never has to know the palette.
 *
 * Decoration only: hidden from assistive technology, never focusable, and
 * still under Calm (`ambient`) and Reduced motion.
 */
export function Atmosphere() {
  return (
    <div aria-hidden className="atmosphere ambient">
      <span className="atmosphere-orb" />
      <span className="atmosphere-orb" />
      <span className="atmosphere-orb" />
    </div>
  );
}
