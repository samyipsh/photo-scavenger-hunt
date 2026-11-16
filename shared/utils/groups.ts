// A group's name: its number, and its IC's first name when there is one, so people know who to
// find: "Group 1 (Adam)". The seed, the demo data and the committee's IC form all build it here.
export const MAX_LEADER_LENGTH = 20

export function cleanLeader(value: unknown): string | null {
  if (typeof value !== 'string') return null
  return value.replace(/[()]/g, '').replace(/\s+/g, ' ').trim().slice(0, MAX_LEADER_LENGTH).trim() || null
}

export function groupName(number: number, leader: string | null | undefined): string {
  return leader ? `Group ${number} (${leader})` : `Group ${number}`
}
