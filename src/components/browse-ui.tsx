export const TEXT_LINK = 'font-semibold text-maroon underline-offset-4 hover:underline'

/** Screen-reader note for pages with video grids or chip rows (one per page). */
export function GridHint() {
  return (
    <p className="sr-only">
      In video grids and chip rows, the arrow keys move between items; Tab moves on.
    </p>
  )
}
