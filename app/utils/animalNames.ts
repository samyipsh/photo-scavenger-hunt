import { nameWords } from './judging'

// Animal names as people type them: how near a name is to what's typed (to rank suggestions),
// the Spot it challenge a name means (a photo there earns its points and still counts for
// Animals spotted), and names that are probably someone's misspelling. Kept pure for the tests.

// A name as words to compare, lower case and singular: "Monitor lizards" is "monitor lizard".
export const nameKey = (s: string) => nameWords(s).join(' ')

// True when one letter added, dropped or changed turns one into the other.
export function oneLetterOff(a: string, b: string) {
  if (a === b || Math.abs(a.length - b.length) > 1) return false
  let i = 0
  while (i < a.length && a[i] === b[i]) i++
  return a.slice(i + 1) === b.slice(i + 1) || a.slice(i) === b.slice(i + 1) || a.slice(i + 1) === b.slice(i)
}

// How near a name is to what's typed, nearest first: 0 the same; 1 it starts that way, or one of
// its words does ("liz" for Monitor lizard); 2 one letter off, also partway through ("kingfisj"
// for Kingfisher); 3 the typed name ends with it ("black swan" for Swan). Null: not near.
export function nameCloseness(typed: string, name: string): 0 | 1 | 2 | 3 | null {
  const t = nameKey(typed)
  const n = nameKey(name)
  if (!t || !n) return null
  if (t === n) return 0
  if (n.startsWith(t) || n.split(' ').some(w => w.startsWith(t))) return 1
  if (t.length >= 3 && oneLetterOff(t, n)) return 2
  if (t.length >= 4 && [t.length - 1, t.length, t.length + 1].some(len => len < n.length && oneLetterOff(t, n.slice(0, len)))) return 2
  if (t.endsWith(` ${n}`)) return 3
  return null
}

// A Spot it challenge that is an animal, with every name that means it: its animal, and each
// half of a title like "Pigeon or dove".
export interface SpotAnimal { id: string, title: string, points: number, names: string[] }
export function spotAnimals(challenges: { id: string, title: string, type: string, points?: number, animal?: string | null, active?: boolean }[]): SpotAnimal[] {
  return challenges
    .filter(c => c.type === 'spot' && c.animal && c.active !== false)
    .map(c => ({
      id: c.id,
      title: c.title,
      points: c.points ?? 0,
      names: [...new Set([c.animal!, ...c.title.split(/\s+or\s+/i)].map(nameKey).filter(Boolean))],
    }))
}

// The Spot it challenge an animal name means: "Hornbill", "Dove", "Black swan" (any swan counts),
// or one letter off a longer name ("Hornbil").
export function spotItFor(name: string, spots: SpotAnimal[]): SpotAnimal | null {
  const t = nameKey(name)
  if (!t) return null
  return spots.find(s => s.names.some(n => t === n || t.endsWith(` ${n}`)))
    ?? spots.find(s => s.names.some(n => n.length >= 5 && oneLetterOff(t, n)))
    ?? null
}

// One letter off a name the event knows ("hornbil" for hornbill): probably a misspelling, so it
// isn't offered as a name to use.
export function likelyMisspelling(name: string, known: string[]) {
  const t = nameKey(name)
  return t.length >= 4 && !known.includes(t) && known.some(k => oneLetterOff(t, k))
}

// The known name a name was probably meant to be: one it starts ("Horn" for Hornbill) or is one
// letter off ("Squirel"). Nothing when it already is one, or when none is near.
export function likelyFix(name: string, known: string[]) {
  let best: { name: string, near: number } | null = null
  for (const k of known) {
    const near = nameCloseness(name, k)
    if ((near === 1 || near === 2) && (!best || near < best.near)) best = { name: k, near }
  }
  return known.some(k => nameCloseness(name, k) === 0) ? null : best?.name ?? null
}

// Suggestions ranked by how near they are to what's typed, nearest first, without the ones that
// aren't near. Nothing typed: all of them, as they came.
export function rankNames<T>(typed: string, items: T[], namesOf: (item: T) => string[]) {
  if (!nameKey(typed)) return items
  return items
    .map((item, i) => ({ item, i, near: Math.min(...namesOf(item).map(n => nameCloseness(typed, n) ?? 9)) }))
    .filter(x => x.near < 9)
    .sort((a, b) => a.near - b.near || a.i - b.i)
    .map(x => x.item)
}
