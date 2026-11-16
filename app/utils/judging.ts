// The reject reasons that fit a photo's challenge, shared by the judge queue and the gallery.
export function rejectReasons(challenge: { whoInShot: string | null } | null): string[] {
  const who = challenge?.whoInShot
  return [
    'Doesn\'t match the challenge',
    ...(who ? [who.startsWith('Whole group') ? 'Not everyone in the photo' : `Needs ${who.toLowerCase()}`] : []),
    'Can\'t see it clearly',
  ]
}

// Words of a name, lower case and singular, for comparing a hint with its title.
export const nameWords = (s: string) => (s.toLowerCase().match(/[a-z]+/g) ?? [])
  .map(w => w.endsWith('ies') ? `${w.slice(0, -3)}y` : w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w)
  .filter(w => w.length > 1)

// A hint shows to a judge only when it says more than the title and who must be in it:
// "Any squirrel." under "Squirrel" goes, "Any lily, including ginger lilies." stays. Besides
// the small words, some only describe without narrowing what counts, so they don't keep a hint
// on screen: "Fruit or berries still on the plant." under "Fruit or berries on a plant", "Any
// swan, black or white." under "Swan".
const FILLER = new Set(['any', 'an', 'the', 'your', 'of', 'or', 'and', 'in', 'on', 'at', 'with', 'you', 'all', 'still', 'black', 'white'])
export function hintAddsSomething(c: { title: string, hint?: string | null, whoInShot?: string | null }) {
  if (!c.hint) return false
  const known = new Set(nameWords(`${c.title} ${c.whoInShot ?? ''}`))
  return nameWords(c.hint).some(w => !FILLER.has(w) && !known.has(w))
}
