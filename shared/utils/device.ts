// A short code for a phone, shown on its blocked notice and in the committee's list, so the
// lead can match the person asking to the right row.
// Letters only, none that look like a digit or each other in sunlight (no B, D, G, I, O, Q, S, Z).
const LETTERS = 'ACEFHJKLMNPRTUWX'

export function deviceCode(deviceId: string): string {
  return [...deviceId.replace(/-/g, '').slice(0, 4)].map(c => LETTERS[Number.parseInt(c, 16)] ?? 'X').join('')
}
