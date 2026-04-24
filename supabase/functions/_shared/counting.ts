/**
 * Day counting for trips (docs/SPEC.md).
 * TODO: SRT deeming-day rule (transit days, qualifying days, tie-count) is out of scope.
 */

import { isUnitedKingdom, normalizeCountry, sameCountryName } from './country.ts'

export type Person = 'simon' | 'chiara'

export type TripRow = {
  id: string
  person: Person
  departure_country: string
  arrival_country: string
  depart_date: string
  arrive_date: string
  /** For ordering same-calendar-day legs (DB order / logging order). */
  created_at?: string
}

const IN_TRANSIT = '__IN_TRANSIT__' as const

type DayEvent = { trip: TripRow; kind: 'depart' | 'arrive' }

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
  ukMemo: Map<string, string>,
): boolean {
  const loc = locationStringAtEndOfDay(personTrips, date, seedCountry, ukMemo)
  if (loc === IN_TRANSIT) return false
  return isUnitedKingdom(loc)
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
      (t) =>
        t.depart_date === date &&
        sameCountryName(t.departure_country, want),
    )
  ) {
    return true
  }
  if (
    personTrips.some(
      (t) =>
        t.arrive_date === date && sameCountryName(t.arrival_country, want),
    )
  ) {
    return true
  }
  return sameCountryName(countryFromTransitions(personTrips, date, seedCountry), want)
}

export function countDayInCountry(
  date: string,
  country: string,
  personTripsSorted: TripRow[],
  seedCountry: string = SEED_COUNTRY,
  /** Shared when counting a range: avoids recomputing end-of-day state per D. */
  ukMemo: Map<string, string> = new Map(),
): boolean {
  if (isUnitedKingdom(country)) {
    return dayCountsForUnitedKingdom(date, personTripsSorted, seedCountry, ukMemo)
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

function subtractOneDay(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  dt.setUTCDate(dt.getUTCDate() - 1)
  const yy = dt.getUTCFullYear()
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(dt.getUTCDate()).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}

function dayEventsOnDate(trips: TripRow[], d: string): DayEvent[] {
  const out: DayEvent[] = []
  for (const t of trips) {
    if (t.depart_date === d) out.push({ trip: t, kind: 'depart' })
    if (t.arrive_date === d) out.push({ trip: t, kind: 'arrive' })
  }
  return out
}

function sortDayEvents(ev: DayEvent[]): void {
  ev.sort((a, b) => {
    const ca = a.trip.created_at ?? ''
    const cb = b.trip.created_at ?? ''
    if (ca !== cb) return ca.localeCompare(cb)
    if (a.trip.id !== b.trip.id) return a.trip.id.localeCompare(b.trip.id)
    if (a.kind === b.kind) return 0
    return a.kind === 'depart' ? -1 : 1
  })
}

/** Country (or in transit) at end of D after all depart/arrive events on that day, in log order. */
function locationStringAtEndOfDay(
  personTrips: TripRow[],
  d: string,
  seedCountry: string,
  memo: Map<string, string>,
): string {
  const cached = memo.get(d)
  if (cached !== undefined) return cached

  const ev = dayEventsOnDate(personTrips, d)
  if (ev.length === 0) {
    const c = countryFromTransitions(personTrips, d, seedCountry)
    memo.set(d, c)
    return c
  }

  sortDayEvents(ev)
  const prevD = subtractOneDay(d)
  const start = locationStringAtEndOfDay(personTrips, prevD, seedCountry, memo)
  let loc: string = start
  for (const e of ev) {
    if (e.kind === 'depart') {
      loc = IN_TRANSIT
    } else {
      loc = normalizeCountry(e.trip.arrival_country)
    }
  }
  memo.set(d, loc)
  return loc
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
  const ukMemo = new Map<string, string>()

  let days_present = 0
  for (const d of eachIsoDateInclusive(range_start, range_end)) {
    if (countDayInCountry(d, country, personTrips, seedCountry, ukMemo)) {
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
