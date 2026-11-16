// The API's response shapes, taken from the server routes themselves (Nuxt generates
// InternalApi from server/api), so renaming a field on the server fails typecheck here instead
// of quietly breaking a page.
import type { InternalApi } from 'nitropack/types'

// GET /api/g/[token]: the group page.
export type QuestData = InternalApi['/api/g/:token']['get']
export type QuestStation = QuestData['stations'][number]
export type QuestChallenge = QuestData['challenges'][number]
export type QuestPhoto = QuestData['photos'][number]

// GET /api/gallery: every photo, the same for everyone. The gallery adds this phone's own likes
// and photos from GET /api/gallery/mine.
export type GalleryList = InternalApi['/api/gallery']['get']
export type GalleryMine = InternalApi['/api/gallery/mine']['get']
export type GalleryPhoto = GalleryList['photos'][number] & { liked: boolean, mine: boolean }

// The committee's Hidden photos (/c/hidden), and what Hide, Unhide and Delete for good on
// ticked photos answer (which went, and why the rest didn't).
export type HiddenList = InternalApi['/api/committee/photos/hidden']['get']
export type BatchAnswer = InternalApi['/api/committee/photos/batch']['post']
// PATCH /api/committee/photos/[id]: the photo as a judging action left it. Named, since a
// `/api/committee/photos/${id}` address also matches the two routes above.
export type JudgedPhoto = InternalApi['/api/committee/photos/:id']['patch']

// GET /api/committee/queue: the judge's queue.
export type JudgeQueue = InternalApi['/api/committee/queue']['get']
export type QueuePhoto = JudgeQueue['photos'][number]

// GET /api/committee/overview: the committee home and the scores table.
export type Overview = InternalApi['/api/committee/overview']['get']

// What every challenge picker needs. Each listing above provides at least this.
export type ChallengeOption = Pick<QuestChallenge, 'id' | 'title' | 'type' | 'awardKind'> & { active?: boolean, whoInShot?: string | null, points?: number }

// GET /api/committee/stations/[id]: one station's scores.
export type StationScores = InternalApi['/api/committee/stations/:id']['get']

// GET /api/committee/checklist
export type Checklist = InternalApi['/api/committee/checklist']['get']

// GET /api/committee/labels: animal names, for merging spellings.
export type LabelRow = InternalApi['/api/committee/labels']['get'][number]

// GET /api/scoreboard
export type PublicScoreboard = InternalApi['/api/scoreboard']['get']

// GET /api/groups: the home page's list.
export type GroupLink = InternalApi['/api/groups']['get'][number]

// POST /api/photos/[id]/like
export type LikeResult = InternalApi['/api/photos/:id/like']['post']
