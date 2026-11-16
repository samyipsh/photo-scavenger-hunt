import { normaliseLabel } from '#shared/utils/scoring'

// "swan" as "Swan": the first letter capitalised, the rest left as it is.
export const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

// What a photo is called wherever it's shown: its challenge's title, or for a race photo the
// animal or colour, "Swan", "Monitor lizard", "White flower"; "Just a photo" without a challenge.
// The name is read as the scoreboard counts it, so "black Swan" is "Black swan" on every screen.
export function photoName(challenge: { title: string, awardKind?: string | null } | null | undefined, label: string | null | undefined): string {
  if (!challenge) return 'Just a photo'
  if (challenge.awardKind && label) return `${capitalise(normaliseLabel(label))}${challenge.awardKind === 'colour' ? ' flower' : ''}`
  return challenge.title
}
