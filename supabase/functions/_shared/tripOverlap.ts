/**
 * Date-range overlap for the same person (plain ISO date strings, no timezones).
 * Used to warn when a new trip's interval [depart, arrive] hits another row.
 */
export function tripRangesOverlap(
  a: { depart_date: string; arrive_date: string },
  b: { depart_date: string; arrive_date: string },
): boolean {
  return a.depart_date <= b.arrive_date && b.depart_date <= a.arrive_date
}
