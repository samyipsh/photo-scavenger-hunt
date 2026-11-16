import { describe, expect, it } from 'vitest'
import { refusalLine } from '../server/utils/refusalLog'

describe('refusalLine', () => {
  it('keeps the code, status and message of a refusal', () => {
    expect(refusalLine({ statusCode: 422, statusMessage: 'Already sent for Flower colours.', data: { code: 'already-sent', photoId: 'x' } }, { route: 'POST /api/g/:token/photos/:id/start', group: 'g2' }))
      .toEqual({ refusal: 'already-sent', status: 422, reason: 'Already sent for Flower colours.', route: 'POST /api/g/:token/photos/:id/start', group: 'g2' })
  })

  it('says "none" for a refusal without a code', () => {
    expect(refusalLine({ statusCode: 401, statusMessage: 'Committee sign-in needed' }))
      .toEqual({ refusal: 'none', status: 401, reason: 'Committee sign-in needed' })
  })

  it('leaves out failures and anything that is not a refusal', () => {
    expect(refusalLine({ statusCode: 500, statusMessage: 'Boom' })).toBeNull()
    expect(refusalLine({ statusCode: 503 })).toBeNull()
    expect(refusalLine({})).toBeNull()
  })
})
