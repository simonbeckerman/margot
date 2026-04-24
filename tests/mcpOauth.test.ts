import { describe, expect, it } from 'vitest'

import { verifyPkceS256 } from '../supabase/functions/_shared/mcpOauth.ts'

/**
 * Regression: verifyPkceS256 used to call `crypto.subtle.timingSafeEqual`,
 * which does not exist on WHATWG Web Crypto (Deno Edge threw at runtime,
 * so every Claude custom-connector token exchange failed with
 * `invalid_grant`). Keep at least one round-trip test so the PKCE path is
 * executed in CI.
 */
describe('verifyPkceS256', () => {
  // Hard-coded vector from RFC 7636 Appendix B.
  const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk'
  const challenge = 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM'

  it('accepts a matching verifier and challenge', async () => {
    expect(await verifyPkceS256(verifier, challenge)).toBe(true)
  })

  it('rejects a mismatching verifier', async () => {
    expect(await verifyPkceS256('not-the-right-verifier-not-the-right-verifier', challenge)).toBe(
      false,
    )
  })

  it('rejects a differently-sized challenge without throwing', async () => {
    expect(await verifyPkceS256(verifier, 'short')).toBe(false)
  })
})
