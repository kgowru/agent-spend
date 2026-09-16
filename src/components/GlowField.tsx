/**
 * Decorative ambient light behind the hero.
 *
 * Three colored blobs, one per bolt in the app icon, arranged 120 degrees apart
 * around a point over the hero's copy. The wrapper rotates the whole triad
 * slowly while each blob breathes on its own clock, so the field is always
 * moving without any single element making an obvious loop.
 *
 * All the styling lives in globals.css under `.glow-*`, because the falloff
 * needs a nine-stop gradient to avoid a visible circular seam and that does not
 * belong inline.
 *
 * `className` is there to set `--glow-x`, which is where the field is centred
 * across the section. It defaults to the middle; the hero moves it left of
 * centre once the copy takes the left column.
 */
export function GlowField({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}
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
