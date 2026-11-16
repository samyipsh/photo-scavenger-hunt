// Everything specific to this event lives in data/: this file (name, date, place, timetable,
// stations, groups, help), challenges.ts, guide.ts (the participant guide) and
// types-of-christ.ts (the puzzle's answers, read only by the server). The engine in app/, server/
// and shared/ reads them, so a different event changes these files.
// Only types come from the engine; data/ never runs engine code.
import type { PhotoTimeStyle } from '../shared/utils/photoTime'

export const EVENT = {
  appName: 'Photo Quest',
  dateLabel: 'Sat 14 Nov',
  venue: 'Singapore Botanic Gardens',
  // The scoreboard's reminder of when and where the results are given.
  resultsAt: '12:10 pm',
  resultsPlace: 'Trellis Garden',
  // Who to ask after too many wrong committee passphrases.
  passphraseHelp: 'Alex',
  // Under the gallery's Save button once someone picks more than one batch of photos.
  albumNote: 'We\'ll share an album of every photo after the event.',
}

// Pages and PDFs outside the app (a map, a song sheet), listed under Misc on the Help page after
// the participant guide (data/guide.ts) and Types of Christ. Each opens in a new tab. Always
// shown: only Types of Christ waits for the committee (Manage › Controls).
export const DOCUMENTS: { label: string, url: string }[] = [
  { label: 'This app\'s code on GitHub', url: 'https://github.com/samyipsh/photo-scavenger-hunt' },
]

// The event's clock: every time the app shows is in TIME_ZONE, and every time it reads (the
// timetable below, `?at=`) is at UTC_OFFSET. Keep the two in step: the offset is the one the
// zone has on EVENT_DATE (Singapore has no daylight saving). tests/data.test.ts checks.
export const TIME_ZONE = 'Asia/Singapore'
export const UTC_OFFSET = '+08:00'

// The morning's timetable, in the event's time: back-to-back rounds. Round 1 can be moved on the
// day (the first_round_at setting), and every later round moves with it.
export const EVENT_DATE = '2026-11-14'
// How photo times read until the committee picks otherwise (Manage › Controls): one morning,
// so the time alone ("10:42 am"). 'day' adds the weekday, 'date' the date.
export const PHOTO_TIMES: PhotoTimeStyle = 'time'
export const PLANNED_FIRST_ROUND = '09:45'
export const ROUND_COUNT = 6
export const ROUND_MINUTES = 20
export const SLOT_COUNT = 6
// In demo mode, phones without `?at=` pretend it's EVENT_DATE at this time when the page loads
// (app/composables/useClock.ts), so every visit lands mid-morning: round 2.
export const DEMO_CLOCK = '10:12'

// Scoring (docs/app-plan.md): first of five at a station gets 5 x RANK_SCALE = 300 points, last
// gets 60. The photo quest adds its real points (10 to 80 a challenge), so RANK_SCALE sets how
// much the stations weigh against it. Each award race's leader (tied leaders each) gets its
// AWARD_BONUS, counted in the group's photo points. There's no Most liked photo prize: likes only
// sort the gallery (removed after the outing, docs/app-plan.md).
export const RANK_SCALE = 60
export const AWARD_BONUS = { animals: 300, colours: 200, photos: 100 }

// Stations in rotation order, with pins checked on a walk-through the week before. Backup shelters are not stations. `short` is for tight tables.

export interface StationSeed {
  id: string
  name: string
  slot: number
  short: string
  scored: boolean
  lowerWins?: boolean
  // The line under the station's name. A stop without a fixed spot (the photo walk) says what
  // to do instead, and has no coordinates, so no map pin.
  place: string
  lat: number | null
  lng: number | null
  // What the station IC types in as the group's score.
  scoreHint?: string
}

export const stations: StationSeed[] = [
  { id: 'codenames', name: 'Codenames', short: 'Codenames', slot: 1, scored: true, scoreHint: 'Your agents over up to 3 grids, 4 clues a grid. Enemy agent −1. The assassin makes that grid 0. Each grid never below 0.', place: 'Trellis Garden gazebo', lat: 1.32121, lng: 103.81537 },
  { id: 'mind', name: 'The Mind', short: 'The Mind', slot: 2, scored: true, scoreHint: 'The highest level cleared.', place: 'Eco-Lake north‑east gazebo', lat: 1.32183, lng: 103.81689 },
  { id: 'charades', name: 'Broken telephone charades', short: 'Charades', slot: 3, scored: true, scoreHint: 'Number of correct guesses. Near-matches count.', place: 'Eco-Lake east gazebo and lawn', lat: 1.32114, lng: 103.81747 },
  { id: 'riddles', name: 'Picture riddles', short: 'Riddles', slot: 4, scored: true, scoreHint: 'Riddles solved. Half a point for one solved with the hint.', place: 'Eco-Lake south gazebo', lat: 1.32082, lng: 103.81644 },
  { id: 'poetry', name: 'One-syllable poetry', short: 'Poetry', slot: 5, scored: true, scoreHint: 'Total card points: 1 or 3 per card.', place: 'Ethnobotany Garden shelter', lat: 1.31997, lng: 103.81591 },
  { id: 'walk', name: 'Photo walk', short: 'Photo walk', slot: 6, scored: false, place: 'Roam anywhere and take photos', lat: null, lng: null },
]

// Where everyone gathers after the last round for the roundup. The rotation card heads that
// stop `title` and says `note` under it; `short` is for the "Next" line in the last round.
export const END_POINT = { name: 'Trellis Garden gazebo', short: 'Trellis Garden', title: 'Roundup', note: 'Finish your puzzle card, then lunch.', lat: 1.32121, lng: 103.81537 }

// Group n starts at slot n, matching the Participant guide's table. With fewer groups than slots,
// each station has one round with no group. Lowering it and reseeding removes the extra groups
// (scripts/seed.ts).
export const GROUP_COUNT = 5

// Each group's IC, a participant, shown as "Group 1 (Adam)" so people know who to find. These
// are only the starting names for a fresh database: the committee sets the real ones in the app
// (Manage, Groups tab), and a later seed keeps those.
export const GROUP_LEADERS: Record<number, string> = {
  1: 'Adam',
  2: 'Beth',
  3: 'Carl',
  4: 'Dennis',
  5: 'Evelyn',
}

// The committee on the Need help page, from the Day plan's "Who does what". `station` is a
// station id above; `role` is for someone without one. `phone`, a Singapore mobile number
// (8 digits), shows as plain text people can copy. Anyone with the app link sees it, so list a
// number only with that person's OK. The person with a number comes first.
export const HELP_CONTACTS: { name: string, phone: string, station?: string, role?: string }[] = [
  { name: 'Alex', phone: '', station: 'codenames' },
  { name: 'Priya', phone: '', role: 'Carries a first-aid kit' },
  { name: 'Ben', phone: '', station: 'mind' },
  { name: 'Mei', phone: '', station: 'charades' },
  { name: 'Jordan', phone: '', station: 'riddles' },
  { name: 'Siti', phone: '', station: 'poetry' },
]
export const MEETING_POINT = 'the Trellis Garden gazebo'
// The number the Help page's "Emergency?" row calls.
export const EMERGENCY_NUMBER = '995'

// The committee's briefing checklist. Ticks are shared by every committee phone. An item with
// `auto` is worked out by the app instead of ticked.
export const BRIEFING_CHECKLIST: { id: string, label: string, auto?: 'first-photos' }[] = [
  { id: 'app-link', label: 'App link sent to every group' },
  { id: 'first-photos', label: 'Every group has sent its first photo', auto: 'first-photos' },
  { id: 'puzzle-cards', label: 'Puzzle cards, pencils and each group\'s first hint and Type of Christ handed out' },
  { id: 'rules-cards', label: 'Rules cards handed out' },
  // The photos made the morning fun, but before they started people talked more and were more
  // relaxed (14 Nov 2026). Say so at the briefing.
  { id: 'enjoy', label: 'Told everyone to enjoy the moment together: the photos are for memories, not just points' },
  { id: 'drinks', label: '100 Plus handed out' },
  { id: 'station-ics', label: 'Station ICs at their stations with their kit' },
  { id: 'round-times', label: 'Round times match the real start' },
]
