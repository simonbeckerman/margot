/** Normalize user-supplied country strings for storage and comparison (see docs/PROJECT.md). */

const UK_ALIASES = new Set([
  'uk',
  'gb',
  'great britain',
  'united kingdom',
])

export function normalizeCountry(raw: string): string {
  const t = raw.trim()
  if (t.length === 0) return t
  const key = t.toLowerCase().replaceAll('.', '')
  if (UK_ALIASES.has(key)) return 'United Kingdom'
  return t
}

export function isUnitedKingdom(country: string): boolean {
  return normalizeCountry(country) === 'United Kingdom'
}
