import { describe, expect, it } from 'vitest'

import {
  countDaysInCountry,
  countryFromTransitions,
  resolveRange,
  SEED_COUNTRY,
  sortTripsChronologically,
  type TripRow,
} from '../supabase/functions/_shared/counting.ts'

const simon = (rows: Omit<TripRow, 'person'>[]): TripRow[] =>
  rows.map((r) => ({ ...r, person: 'simon' as const }))

describe('resolveRange', () => {
  it('resolves UK tax year 2026 to 6 Apr 2026 through 5 Apr 2027', () => {
    expect(resolveRange({ type: 'uk_tax_year', year: 2026 })).toEqual({
      start: '2026-04-06',
      end: '2027-04-05',
    })
  })
})

describe('countryFromTransitions', () => {
  it('uses seed before any trip', () => {
    const trips = sortTripsChronologically(simon([]))
    expect(countryFromTransitions(trips, '2026-01-01')).toBe(SEED_COUNTRY)
  })

  it('uses arrival country after trip', () => {
    const trips = sortTripsChronologically(
      simon([
        {
          id: 'a',
          departure_country: 'United Kingdom',
          arrival_country: 'France',
          depart_date: '2026-06-01',
          arrive_date: '2026-06-02',
        },
      ]),
    )
    expect(countryFromTransitions(trips, '2026-06-01')).toBe('United Kingdom')
    expect(countryFromTransitions(trips, '2026-06-02')).toBe('France')
    expect(countryFromTransitions(trips, '2026-06-10')).toBe('France')
  })
})

describe('countDaysInCountry', () => {
  it('UK: single trip out, depart UK day does not count; no trips earlier uses seed UK', () => {
    const trips = simon([
      {
        id: 't1',
        departure_country: 'United Kingdom',
        arrival_country: 'France',
        depart_date: '2026-06-01',
        arrive_date: '2026-06-02',
      },
    ])
    const uk = countDaysInCountry(
      'simon',
      'United Kingdom',
      { type: 'custom', start: '2026-05-30', end: '2026-06-03' },
      trips,
    )
    expect(uk.method).toBe('uk_midnight')
    expect(uk.days_present).toBe(2)
    expect(uk.range_start).toBe('2026-05-30')
    expect(uk.range_end).toBe('2026-06-03')
    const june1 = countDaysInCountry(
      'simon',
      'United Kingdom',
      { type: 'custom', start: '2026-06-01', end: '2026-06-01' },
      trips,
    )
    expect(june1.days_present).toBe(0)
  })

  it('UK: arrive UK on day counts', () => {
    const trips = simon([
      {
        id: 't1',
        departure_country: 'France',
        arrival_country: 'United Kingdom',
        depart_date: '2026-08-01',
        arrive_date: '2026-08-01',
      },
    ])
    const one = countDaysInCountry(
      'simon',
      'United Kingdom',
      { type: 'custom', start: '2026-08-01', end: '2026-08-01' },
      trips,
    )
    expect(one.days_present).toBe(1)
  })

  it('non-UK: inclusive presence uses depart and arrive endpoints', () => {
    const trips = simon([
      {
        id: 't1',
        departure_country: 'United Kingdom',
        arrival_country: 'France',
        depart_date: '2026-06-01',
        arrive_date: '2026-06-02',
      },
    ])
    const fr = countDaysInCountry(
      'simon',
      'France',
      { type: 'custom', start: '2026-06-01', end: '2026-06-04' },
      trips,
    )
    expect(fr.method).toBe('inclusive_presence')
    expect(fr.days_present).toBe(3)
  })

  it('same calendar day: UK to Israel, Israel counts, UK does not (midnight test)', () => {
    const trips = simon([
      {
        id: 's1',
        departure_country: 'United Kingdom',
        arrival_country: 'Israel',
        depart_date: '2026-09-20',
        arrive_date: '2026-09-20',
      },
    ])
    const uk = countDaysInCountry(
      'simon',
      'United Kingdom',
      { type: 'custom', start: '2026-09-20', end: '2026-09-20' },
      trips,
    )
    expect(uk.days_present).toBe(0)
    const il = countDaysInCountry(
      'simon',
      'Israel',
      { type: 'custom', start: '2026-09-20', end: '2026-09-20' },
      trips,
    )
    expect(il.days_present).toBe(1)
  })

  it('Israel: arrival calendar day counts; UK does not count UK depart day (same leg)', () => {
    const trips = simon([
      {
        id: 't1',
        departure_country: 'United Kingdom',
        arrival_country: 'Israel',
        depart_date: '2026-04-05',
        arrive_date: '2026-04-06',
      },
    ])
    const ukDepartDayOnly = countDaysInCountry(
      'simon',
      'United Kingdom',
      { type: 'custom', start: '2026-04-05', end: '2026-04-05' },
      trips,
    )
    expect(ukDepartDayOnly.days_present).toBe(0)
    const ilArriveDayOnly = countDaysInCountry(
      'simon',
      'Israel',
      { type: 'custom', start: '2026-04-06', end: '2026-04-06' },
      trips,
    )
    expect(ilArriveDayOnly.method).toBe('inclusive_presence')
    expect(ilArriveDayOnly.days_present).toBe(1)
  })

  it('range before any trips counts seed country for UK', () => {
    const trips = simon([])
    const uk = countDaysInCountry(
      'simon',
      'United Kingdom',
      { type: 'custom', start: '2026-01-01', end: '2026-01-05' },
      trips,
    )
    expect(uk.days_present).toBe(5)
  })

  it('same-day depart and arrive same country: does not throw', () => {
    const trips = simon([
      {
        id: 'weird',
        departure_country: 'France',
        arrival_country: 'France',
        depart_date: '2026-03-01',
        arrive_date: '2026-03-01',
      },
    ])
    expect(() =>
      countDaysInCountry(
        'simon',
        'France',
        { type: 'custom', start: '2026-03-01', end: '2026-03-01' },
        trips,
      ),
    ).not.toThrow()
  })

  it('UK: boundary around departure day near tax year end', () => {
    const trips = simon([
      {
        id: 'cross',
        departure_country: 'United Kingdom',
        arrival_country: 'Israel',
        depart_date: '2026-04-05',
        arrive_date: '2026-04-06',
      },
    ])
    const uk = countDaysInCountry(
      'simon',
      'United Kingdom',
      { type: 'custom', start: '2026-04-04', end: '2026-04-06' },
      trips,
    )
    expect(uk.days_present).toBe(1)
  })

  it('multiple trips in one year', () => {
    const trips = simon([
      {
        id: 'a',
        departure_country: 'United Kingdom',
        arrival_country: 'France',
        depart_date: '2026-02-01',
        arrive_date: '2026-02-02',
      },
      {
        id: 'b',
        departure_country: 'France',
        arrival_country: 'United Kingdom',
        depart_date: '2026-07-10',
        arrive_date: '2026-07-11',
      },
    ])
    const fr = countDaysInCountry(
      'simon',
      'France',
      { type: 'calendar_year', year: 2026 },
      trips,
    )
    expect(fr.days_present).toBeGreaterThan(10)
    const uk = countDaysInCountry(
      'simon',
      'United Kingdom',
      { type: 'calendar_year', year: 2026 },
      trips,
    )
    expect(uk.method).toBe('uk_midnight')
    expect(uk.days_present).toBeGreaterThan(100)
  })

  it('Italy: arrival day counts (same inclusive rule as Israel)', () => {
    const trips = simon([
      {
        id: 'it1',
        departure_country: 'United Kingdom',
        arrival_country: 'Italy',
        depart_date: '2026-05-10',
        arrive_date: '2026-05-11',
      },
    ])
    const italy = countDaysInCountry(
      'simon',
      'italy',
      { type: 'custom', start: '2026-05-11', end: '2026-05-11' },
      trips,
    )
    expect(italy.method).toBe('inclusive_presence')
    expect(italy.days_present).toBe(1)
  })

  it('rejects custom range with start after end', () => {
    expect(() =>
      countDaysInCountry(
        'simon',
        'United Kingdom',
        { type: 'custom', start: '2026-06-10', end: '2026-06-01' },
        simon([]),
      ),
    ).toThrow(/Invalid range/)
  })

  it('same day: London to Paris to London, two legs: D counts 1 UK at end of day if return is logged after outbound', () => {
    const trips = simon([
      {
        id: 'out',
        departure_country: 'United Kingdom',
        arrival_country: 'France',
        depart_date: '2026-03-10',
        arrive_date: '2026-03-10',
        created_at: '2026-03-10T08:00:00.000Z',
      },
      {
        id: 'back',
        departure_country: 'France',
        arrival_country: 'United Kingdom',
        depart_date: '2026-03-10',
        arrive_date: '2026-03-10',
        created_at: '2026-03-10T18:00:00.000Z',
      },
    ])
    const uk = countDaysInCountry(
      'simon',
      'United Kingdom',
      { type: 'custom', start: '2026-03-10', end: '2026-03-10' },
      trips,
    )
    expect(uk.days_present).toBe(1)
  })

  it('same day: London to Paris only (one leg, no return), D is not a UK day', () => {
    const trips = simon([
      {
        id: 'one',
        departure_country: 'United Kingdom',
        arrival_country: 'France',
        depart_date: '2026-07-15',
        arrive_date: '2026-07-15',
      },
    ])
    const uk = countDaysInCountry(
      'simon',
      'United Kingdom',
      { type: 'custom', start: '2026-07-15', end: '2026-07-15' },
      trips,
    )
    expect(uk.days_present).toBe(0)
  })

  it('two days: depart UK D1, arrive back in UK D2 on separate two legs', () => {
    const trips = simon([
      {
        id: 'a',
        departure_country: 'United Kingdom',
        arrival_country: 'France',
        depart_date: '2026-08-10',
        arrive_date: '2026-08-10',
      },
      {
        id: 'b',
        departure_country: 'France',
        arrival_country: 'United Kingdom',
        depart_date: '2026-08-11',
        arrive_date: '2026-08-11',
      },
    ])
    const d1 = countDaysInCountry(
      'simon',
      'United Kingdom',
      { type: 'custom', start: '2026-08-10', end: '2026-08-10' },
      trips,
    )
    const d2 = countDaysInCountry(
      'simon',
      'United Kingdom',
      { type: 'custom', start: '2026-08-11', end: '2026-08-11' },
      trips,
    )
    expect(d1.days_present).toBe(0)
    expect(d2.days_present).toBe(1)
  })

  it('no trips: Israel count is zero in a custom window', () => {
    const z = countDaysInCountry(
      'simon',
      'Israel',
      { type: 'custom', start: '2026-01-01', end: '2026-01-10' },
      simon([]),
    )
    expect(z.days_present).toBe(0)
    expect(z.method).toBe('inclusive_presence')
  })

  it('query window fully inside a long in-air leg: UK before arrival still uses seed/transition', () => {
    const trips = simon([
      {
        id: 'leg',
        departure_country: 'United Kingdom',
        arrival_country: 'United States',
        depart_date: '2026-06-01',
        arrive_date: '2026-06-08',
      },
    ])
    const uk = countDaysInCountry(
      'simon',
      'United Kingdom',
      { type: 'custom', start: '2026-06-03', end: '2026-06-04' },
      trips,
    )
    expect(uk.days_present).toBe(2)
  })

  it('countDays: uk_tax_year with no trip rows (seed UK for full tax year window)', () => {
    const r = countDaysInCountry('simon', 'United Kingdom', { type: 'uk_tax_year', year: 2026 }, simon([]))
    expect(r.method).toBe('uk_midnight')
    expect(r.range_start).toBe('2026-04-06')
    expect(r.range_end).toBe('2027-04-05')
    expect(r.days_present).toBe(365)
  })

  it('chiara trips do not affect simon counts', () => {
    const trips: TripRow[] = [
      {
        id: 'c',
        person: 'chiara',
        departure_country: 'United Kingdom',
        arrival_country: 'France',
        depart_date: '2026-01-10',
        arrive_date: '2026-01-11',
      },
    ]
    const uk = countDaysInCountry(
      'simon',
      'United Kingdom',
      { type: 'custom', start: '2026-01-15', end: '2026-01-20' },
      trips,
    )
    expect(uk.days_present).toBe(6)
  })
})
