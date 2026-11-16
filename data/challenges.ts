// The photo challenge list. Edit here and re-run the seed.
// Points by difficulty: 10 for station photos, 20 for easy finds, 30 for harder finds and
// group shots, 50 for the hornbill and every drama shot.
// IDs are stable: never rename one that has photos. Remove a challenge by setting active: false.
// Flavour lines are exact KJV, in curly quotes, then a spaced en dash and the reference, which
// is kept on one line (\u00A0 after the book). Trailing commas, colons and semicolons are dropped.

// hint is the one-line explanation shown under each title.
// Challenges the engine treats specially: the first group photo ticks the briefing checklist,
// and the two award races collect animals and flower colours.
export const FIRST_PHOTO_CHALLENGE = 'first-group-photo'
export const ANIMALS_CHALLENGE = 'animals'
export const COLOURS_CHALLENGE = 'colours'

// The kinds of challenge, in the order of the group page's tabs. Challenge lists follow it too,
// except that the picker and the gallery's filter put Awards (the two races) first with `order`.
export const CHALLENGE_KINDS = [
  { type: 'station', label: 'Stations' },
  { type: 'spot', label: 'Spot it' },
  { type: 'group', label: 'Group shots' },
  { type: 'drama', label: 'Drama' },
  { type: 'award', label: 'Awards' },
] as const

// The animals suggested when naming an animal for Most animals spotted (those already found are
// left out).
export const ANIMAL_IDEAS = ['swan', 'junglefowl', 'hornbill', 'monitor lizard', 'squirrel', 'dog', 'fish', 'turtle', 'heron', 'kingfisher', 'butterfly', 'dragonfly', 'ant', 'mynah', 'otter']

export interface ChallengeSeed {
  id: string
  type: 'station' | 'spot' | 'group' | 'drama' | 'award'
  title: string
  flavour?: string
  hint?: string
  points: number
  whoInShot?: string
  awardKind?: 'animal' | 'colour'
  // An animal Spot it challenge also adds this animal to the Animals spotted race.
  animal?: string
  active?: boolean
}

export const challenges: ChallengeSeed[] = [
  // Station photos: free points for doing the outing.
  { id: 'first-group-photo', type: 'station', title: 'Your group\'s first photo', hint: 'Your whole group, before your first station.', points: 10, whoInShot: 'Whole group' },
  { id: 'speaker', type: 'station', title: 'Photo with the speaker', hint: 'Any photo with the speaker. The all-groups photo counts only for the first group to send it.', points: 10, whoInShot: 'The speaker and at least one of you' },
  { id: 'station-codenames', type: 'station', title: 'Codenames station', hint: 'Your whole group at Codenames.', points: 10, whoInShot: 'Whole group' },
  { id: 'station-mind', type: 'station', title: 'The Mind station', hint: 'Your whole group at The Mind.', points: 10, whoInShot: 'Whole group' },
  { id: 'station-charades', type: 'station', title: 'Broken telephone charades station', hint: 'Your whole group at charades.', points: 10, whoInShot: 'Whole group' },
  { id: 'station-riddles', type: 'station', title: 'Picture riddles station', hint: 'Your whole group at picture riddles.', points: 10, whoInShot: 'Whole group' },
  { id: 'station-poetry', type: 'station', title: 'One-syllable poetry station', hint: 'Your whole group at poetry.', points: 10, whoInShot: 'Whole group' },

  // Spot it: find it and snap it.
  { id: 'swan', type: 'spot', title: 'Swan', hint: 'Any swan, black or white.', points: 50, animal: 'swan' },
  { id: 'rooster', type: 'spot', title: 'Rooster', hint: 'A rooster or any wild chicken.', points: 30, animal: 'rooster' },
  { id: 'hornbill', type: 'spot', title: 'Hornbill', hint: 'The black-and-white bird with a big beak, up in the trees.', points: 50, animal: 'hornbill' },
  { id: 'monitor-lizard', type: 'spot', title: 'Monitor lizard', hint: 'The big lizard, often near the water.', points: 30, animal: 'monitor lizard' },
  { id: 'squirrel', type: 'spot', title: 'Squirrel', hint: 'Any squirrel.', points: 40, animal: 'squirrel' },
  { id: 'dog', type: 'spot', title: 'Dog', hint: 'Someone’s dog. Ask the owner first.', points: 30, animal: 'dog' },
  { id: 'fish', type: 'spot', title: 'Fish', hint: 'Any fish in the lake or a pond.', points: 40, animal: 'fish' },
  { id: 'turtle', type: 'spot', title: 'Turtle', hint: 'A turtle or terrapin, often sunning itself by the lake.', points: 30, animal: 'turtle' },
  { id: 'pigeon', type: 'spot', title: 'Pigeon', hint: 'Any pigeon.', points: 20, animal: 'pigeon' },
  { id: 'spot-ant', type: 'spot', title: 'Ants', hint: 'Any ants. Get up close.', flavour: '“There be four things which are little upon the earth, but they are exceeding wise: The ants are a people not strong, yet they prepare their meat in the summer” – Prov\u00A030:24–25', points: 20, animal: 'ant' },
  { id: 'spider', type: 'spot', title: 'Spider', hint: 'Any spider. A web on its own doesn’t count.', flavour: '“There be four things which are little upon the earth, but they are exceeding wise: … The spider taketh hold with her hands, and is in kings’ palaces.” – Prov\u00A030:24,\u00A028', points: 30, animal: 'spider' },
  { id: 'worm', type: 'spot', title: 'Worm', hint: 'Any worm. Look on damp paths and lawn edges.', points: 30, animal: 'worm' },
  { id: 'orchid', type: 'spot', title: 'Orchid', hint: 'Any orchid flower.', points: 30 },
  { id: 'lily', type: 'spot', title: 'Lily', hint: 'Any lily, including ginger lilies.', flavour: '“Consider the lilies of the field, how they grow; they toil not, neither do they spin” – Matt\u00A06:28', points: 30 },
  { id: 'fruit', type: 'spot', title: 'Fruit or berries on a plant', hint: 'Fruit or berries still on the plant.', points: 30 },
  { id: 'palm', type: 'spot', title: 'Palm tree', hint: 'Any palm tree.', flavour: '“The righteous shall flourish like the palm tree: he shall grow like a cedar in Lebanon.” – Ps\u00A092:12', points: 20 },
  { id: 'pandan', type: 'spot', title: 'Pandan', hint: 'The plant with long, strap-like leaves.', points: 80 },
  { id: 'ferns', type: 'spot', title: 'Ferns', hint: 'Any fern.', points: 20 },
  { id: 'holey-leaves', type: 'spot', title: 'Leaves with holes in them', hint: 'Leaves with holes eaten through them.', points: 20 },
  { id: 'pink-flowers', type: 'spot', title: 'Lots of pink flowers', hint: 'A big patch of pink flowers, with at least 2 of you in it.', points: 60, whoInShot: 'At least 2 of you' },
  { id: 'tiny', type: 'spot', title: 'Flower smaller than 1\u00A0cm', hint: 'A flower under 1\u00A0cm across.', points: 40 },

  // Group shots.
  { id: 'big-tree', type: 'group', title: 'A very large tree', hint: 'At least 1 of you beside a “cedar in Lebanon”.', flavour: '“The righteous shall flourish like the palm tree: he shall grow like a cedar in Lebanon.” – Ps\u00A092:12', points: 40, whoInShot: 'At least one of you' },
  { id: 'vine', type: 'group', title: 'A vine', hint: 'Your whole group abiding in the vine.', flavour: '“Abide in me, and I in you. As the branch cannot bear fruit of itself, except it abide in the vine; no more can ye, except ye abide in me.” – John\u00A015:4', points: 40, whoInShot: 'Whole group' },
  { id: 'shelter', type: 'group', title: 'Under a shelter', hint: 'Your whole group taking shelter, storm or no storm.', points: 40, whoInShot: 'Whole group' },
  { id: 'brick-path', type: 'group', title: 'Red brick path', hint: 'Follow the red brick path, all of you on it.', points: 40, whoInShot: 'Whole group' },
  { id: 'single-file', type: 'group', title: 'Single file on a narrow path', hint: 'Your whole group in single file, keeping to the narrow way.', flavour: '“narrow is the way” – Matt\u00A07:14', points: 40, whoInShot: 'Whole group' },
  { id: 'spread-out', type: 'group', title: 'Spread out 1\u00A0m apart', hint: 'A decently aesthetic shot of all of you, each at least 1\u00A0m apart.', points: 50, whoInShot: 'Whole group except the photographer' },
  { id: 'lying-grass', type: 'group', title: 'Green pastures beside still waters', hint: 'Beside still water.', flavour: '“The LORD is my shepherd; I shall not want. He maketh me to lie down in green pastures: he leadeth me beside the still waters.” – Ps\u00A023:1–2', points: 40 },
  { id: 'lake-trees', type: 'group', title: 'Trees by the lake', hint: 'At least 1 of you planted by the rivers of water (the lake will do).', flavour: '“like a tree planted by the rivers of water” – Ps\u00A01:3', points: 40, whoInShot: 'At least one of you' },
  { id: 'bougainvillea', type: 'group', title: 'Bougainvillea', hint: 'Your whole group with the bougainvillea on the photo walk.', points: 40, whoInShot: 'Whole group' },
  { id: 'reflection', type: 'group', title: 'Group reflection', hint: 'Your whole group, all in one reflection. The still water at Eco-Lake may work.', points: 40, whoInShot: 'Whole group' },

  // Drama: optional, worth the most.
  { id: 'flower-fadeth', type: 'drama', title: 'The flower fadeth', hint: 'Mourn over a dead leaf or wilted flower.', flavour: '“The grass withereth, the flower fadeth: but the word of our God shall stand for ever.” – Isa\u00A040:8', points: 80 },
  { id: 'floor-lava', type: 'drama', title: 'Floor is lava', hint: 'Everyone off the floor and holding still: standing, sitting or lying on something above it. A mid-air jump doesn’t count.', points: 80, whoInShot: 'Whole group' },
  { id: 'mid-air', type: 'drama', title: 'Mid-air jump', hint: 'Your whole group in the air at once.', points: 80 },
  { id: 'monkeying', type: 'drama', title: 'Monkeying around', hint: 'At least 2 of you hanging from something. Don’t get in trouble pls.', points: 80, whoInShot: 'At least 2 of you' },

  // Awards: each entry is its own photo, counted for the award races.
  { id: 'animals', type: 'award', title: 'Animals spotted', hint: 'Every different animal counts once. Name each one.', points: 0, awardKind: 'animal' },
  { id: 'colours', type: 'award', title: 'Flower colours', hint: 'Every different flower colour counts once, up to 9.', points: 0, awardKind: 'colour' },
]
