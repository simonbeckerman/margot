/**
 * Day counting for trips (docs/SPEC.md).
 * TODO: SRT deeming-day rule (transit days, qualifying days, tie-count) is out of scope.
 */

import { isUnitedKingdom, normalizeCountry } from './country.ts'

export type Person = 'simon' | 'chiara'

export type TripRow = {
  id: string
  person: Person
  departure_country: string
  arrival_country: string
  depart_date: string
  arrive_date: string
}

export type RangeInput =
  | { type: 'uk_tax_year'; year: number }
  | { type: 'calendar_year'; year: number }
  | { type: 'custom'; start: string; end: string }

export const SEED_COUNTRY = 'United Kingdom'

export function resolveRange(range: RangeInput): { start: string; end: string } {
  if (range.type === 'uk_tax_year') {
    const y = range.year
    return { start: `${y}-04-06`, end: `${y + 1}-04-05` }
  }
  if (range.type === 'calendar_year') {
    const y = range.year
    return { start: `${y}-01-01`, end: `${y}-12-31` }
  }
  return { start: range.start, end: range.end }
}

function compareIsoDate(a: string, b: string): number {
  if (a < b) return -1
  if (a > b) return 1
  return 0
}

export function sortTripsChronologically(trips: TripRow[]): TripRow[] {
  return [...trips].sort((x, y) => {
    const c = compareIsoDate(x.arrive_date, y.arrive_date)
    if (c !== 0) return c
    const d = compareIsoDate(x.depart_date, y.depart_date)
    if (d !== 0) return d
    return x.id.localeCompare(y.id)
  })
}

/** Country after processing all trips with arrive_date <= D (before any trips: seed). */
export function countryFromTransitions(
  sortedPersonTrips: TripRow[],
  date: string,
  seedCountry: string = SEED_COUNTRY,
): string {
  const candidates = sortedPersonTrips.filter((t) => t.arrive_date <= date)
  if (candidates.length === 0) return normalizeCountry(seedCountry)
  const latest = [...candidates].sort((x, y) => {
    const c = compareIsoDate(y.arrive_date, x.arrive_date)
    if (c !== 0) return c
    const d = compareIsoDate(y.depart_date, x.depart_date)
    if (d !== 0) return d
    return y.id.localeCompare(x.id)
  })[0]
  return normalizeCountry(latest.arrival_country)
}

function tripsForPerson(trips: TripRow[], person: Person): TripRow[] {
  return sortTripsChronologically(trips.filter((t) => t.person === person))
}

function dayCountsForUnitedKingdom(
  date: string,
  personTrips: TripRow[],
  seedCountry: string,
): boolean {
  if (
    personTrips.some(
      (t) => t.depart_date === date && isUnitedKingdom(t.departure_country),
    )
  ) {
    return false
  }
  if (
    personTrips.some(
      (t) => t.arrive_date === date && isUnitedKingdom(t.arrival_country),
    )
  ) {
    return true
  }
  return isUnitedKingdom(countryFromTransitions(personTrips, date, seedCountry))
}

function dayCountsForOtherCountry(
  date: string,
  country: string,
  personTrips: TripRow[],
  seedCountry: string,
): boolean {
  const want = normalizeCountry(country)
  if (isUnitedKingdom(want)) {
    throw new Error('Use UK rule for United Kingdom')
  }
  if (
    personTrips.some(
      (t) => t.depart_date === date && normalizeCountry(t.departure_country) === want,
    )
  ) {
    return true
  }
  if (
    personTrips.some(
      (t) => t.arrive_date === date && normalizeCountry(t.arrival_country) === want,
    )
  ) {
    return true
  }
  return normalizeCountry(countryFromTransitions(personTrips, date, seedCountry)) === want
}

export function countDayInCountry(
  date: string,
  country: string,
  personTripsSorted: TripRow[],
  seedCountry: string = SEED_COUNTRY,
): boolean {
  if (isUnitedKingdom(country)) {
    return dayCountsForUnitedKingdom(date, personTripsSorted, seedCountry)
  }
  return dayCountsForOtherCountry(date, country, personTripsSorted, seedCountry)
}

function* eachIsoDateInclusive(start: string, end: string): Generator<string> {
  if (compareIsoDate(start, end) > 0) return
  let cur = start
  while (true) {
    yield cur
    if (cur === end) break
    cur = addOneDay(cur)
  }
}

function addOneDay(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  dt.setUTCDate(dt.getUTCDate() + 1)
  const yy = dt.getUTCFullYear()
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(dt.getUTCDate()).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}

export type CountResult = {
  days_present: number
  method: 'uk_midnight' | 'inclusive_presence'
  range_start: string
  range_end: string
  trips_considered: string[]
}

export function countDaysInCountry(
  person: Person,
  country: string,
  range: RangeInput,
  allTrips: TripRow[],
  seedCountry: string = SEED_COUNTRY,
): CountResult {
  const { start: range_start, end: range_end } = resolveRange(range)
  if (compareIsoDate(range_start, range_end) > 0) {
    throw new Error('Invalid range: start after end')
  }

  const personTrips = tripsForPerson(allTrips, person)
  const method = isUnitedKingdom(country) ? 'uk_midnight' : 'inclusive_presence'

  let days_present = 0
  for (const d of eachIsoDateInclusive(range_start, range_end)) {
    if (countDayInCountry(d, country, personTrips, seedCountry)) {
      days_present++
    }
  }

  const trips_considered = personTrips
    .filter(
      (t) =>
        t.arrive_date <= range_end ||
        (t.depart_date >= range_start && t.depart_date <= range_end),
    )
    .map((t) => t.id)
    .sort()

  return {
    days_present,
    method,
    range_start,
    range_end,
    trips_considered,
  }
}
