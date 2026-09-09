/**
 * Decorative ambient light behind the hero.
 *
 * Three colored blobs, one per bolt in the app icon, arranged 120 degrees apart
 * around the icon's centre. The wrapper rotates the whole triad slowly while
 * each blob breathes on its own clock, so the field is always moving without
 * any single element making an obvious loop.
 *
 * All the styling lives in globals.css under `.glow-*`, because the falloff
 * needs a nine-stop gradient to avoid a visible circular seam and that does not
 * belong inline.
 */
export function GlowField() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      <div className="glow-wash" />
      <div className="glow-orbit">
        <div className="glow-blob glow-blob-teal" />
        <div className="glow-blob glow-blob-blue" />
        <div className="glow-blob glow-blob-orange" />
      </div>
    </div>
  );
}
