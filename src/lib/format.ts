// Dates use the publisher's time zone so they don't shift by a day for viewers abroad.
const TIME_ZONE = 'Asia/Manila'

const dateFmt = new Intl.DateTimeFormat('en-PH', {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  timeZone: TIME_ZONE,
})
const yearFmt = new Intl.DateTimeFormat('en-PH', { year: 'numeric', timeZone: TIME_ZONE })

const toDate = (iso: string) => {
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? null : date
}

/** "Jan 25, 2026", or '' for an invalid date. */
export function formatDate(iso: string): string {
  const date = toDate(iso)
  return date ? dateFmt.format(date) : ''
}

/** Publish year, or NaN for an invalid date. */
export function yearOf(iso: string): number {
  const date = toDate(iso)
  return date ? Number(yearFmt.format(date)) : NaN
}
