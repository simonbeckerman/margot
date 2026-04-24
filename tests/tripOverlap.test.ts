import { describe, expect, it } from 'vitest'

import { tripRangesOverlap } from '../supabase/functions/_shared/tripOverlap.ts'

describe('tripRangesOverlap', () => {
  it('does not count adjacent non-overlapping legs', () => {
    const a = { depart_date: '2026-01-01', arrive_date: '2026-01-02' }
    const b = { depart_date: '2026-01-03', arrive_date: '2026-01-04' }
    expect(tripRangesOverlap(a, b)).toBe(false)
  })

  it('counts a shared day as overlap', () => {
    const a = { depart_date: '2026-01-01', arrive_date: '2026-01-03' }
    const b = { depart_date: '2026-01-03', arrive_date: '2026-01-04' }
    expect(tripRangesOverlap(a, b)).toBe(true)
  })
})
