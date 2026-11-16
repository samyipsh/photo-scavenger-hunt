<script setup lang="ts">
import { ANIMALS_CHALLENGE, CHALLENGE_KINDS, COLOURS_CHALLENGE } from '~~/data/challenges'
import { FLOWER_COLOURS } from '#shared/utils/awards'
import { AWARD_BONUS, EVENT } from '~~/data/event'
import { computed, ref } from 'vue'
import { useElementSize } from '@vueuse/core'
import { deviceCode } from '#shared/utils/device'
import { animalFor } from '#shared/utils/scoring'
import { CameraIcon, ChevronRightIcon, FlowerIcon, ImageUpIcon, ImagesIcon, LinkIcon, LockIcon, PawPrintIcon, RefreshCwIcon, SmartphoneIcon, TrophyIcon, UsersIcon, WifiOffIcon, XIcon } from '@lucide/vue'
import { NuxtLink } from '#components'
import { toast } from 'vue-sonner'
import type { PublicScoreboard, QuestChallenge, QuestData } from '~/types/api'
import type { ChallengeStatus } from '~/types/quest'
import { type Draft, PHOTO_DRAFT, SHOT_DRAFT, type UploadItem } from '~/composables/useUploadQueue'
import { photoName } from '~/utils/photoName'

const route = useRoute()
const token = computed(() => String(route.params.token))
const now = useClock()
// The public demo says where a visitor's photos go.
const demo = useDemo()

// Deep, because the photo view changes the photos it shows in place (a like, a new challenge)
// and the page should follow at once.
// A refresh that fails keeps the page as it was (useLastGood), with a line saying so.
const { data: fresh, error, refresh, status } = await useFetch<QuestData>(() => `/api/g/${token.value}`, { lazy: true, deep: true, timeout: 15_000, headers: { 'x-device-id': deviceId() } })
const data = useLastGood(fresh, error)
// The public scoreboard (cached on the server): where this group stands in each award race.
const { data: freshBoard, error: boardError, refresh: refreshBoard, status: boardStatus } = useFetch<PublicScoreboard>('/api/scoreboard', { lazy: true, timeout: 15_000 })
const board = useLastGood(freshBoard, boardError)
useVisibleInterval(() => {
  refresh()
  refreshBoard()
}, 30_000)
// Photo points as everyone sees them: the challenges' points (live, from the group's own photos)
// plus the prize for each award race the group leads (from the public scoreboard).
// While the public scores are locked, the locked total, so it matches the scoreboard's breakdown.
const photoPoints = computed(() => {
  const mine = board.value?.groups.find(g => g.id === data.value?.group.id)
  if (board.value?.frozenAt && mine) return mine.photoTotal
  return (data.value?.totals.points ?? 0) + (mine?.awardBonus ?? 0)
})

useHead({ title: computed(() => data.value ? `${data.value.group.name} · ${EVENT.appName}` : EVENT.appName) })

// Remember this phone's group for the home page's "Continue as" button.
watch(() => data.value?.group, (g) => {
  if (g && !g.hidden) rememberMyGroup({ token: token.value, name: g.name, id: g.id })
}, { immediate: true })
// A link that doesn't work any more: stop offering it as this phone's group.
watch(() => error.value?.statusCode, (code) => {
  if (code === 404) forgetMyGroup(token.value)
}, { immediate: true })

const challengeById = computed(() => new Map((data.value?.challenges ?? []).map(c => [c.id, c])))
const titleFor = (item: UploadItem) => item.challengeId ? (challengeById.value.get(item.challengeId)?.title ?? 'Photo') : 'Just a photo'
// Where a photo went: "Swan", "Kingfisher", "Orange flower", or null for just a photo.
function placeName(challengeId: string | null, label: string | null) {
  const c = challengeId ? challengeById.value.get(challengeId) : null
  return c ? photoName(c, label) : null
}
// "Swan photo", "Kingfisher photo", "Orange flower photo", or just "Photo". A challenge that's
// already a photo keeps its own name ("Your group's first photo", "Photo with the speaker").
function photoTitle(challengeId: string | null, label: string | null) {
  const name = placeName(challengeId, label)
  if (!name) return 'Photo'
  return /\bphoto\b/i.test(name) ? name : `${name} photo`
}
// What the last finished upload was. Kept for the app's life, like the queue, and read from the
// group's photos once they've reloaded, so the done line is still right after a trip to the
// gallery.
const last = useState('quest-last-upload', () => ({ title: '', loose: false }))
// A photo sent can change an award race: the scoreboard is asked again straight away, and once
// more after the server's 10 s cache, so the standing and prize catch up with the count.
let boardTimer: ReturnType<typeof setTimeout> | undefined
const queue = useUploadQueue(() => token.value, (item) => {
  refresh()
  refreshBoard()
  clearTimeout(boardTimer)
  boardTimer = setTimeout(() => refreshBoard(), 11_000)
  last.value = { title: photoTitle(item.challengeId, item.label), loose: !item.challengeId }
})
onBeforeUnmount(() => clearTimeout(boardTimer))
const lastInfo = computed(() => {
  const done = queue.lastDone.value
  const p = done ? data.value?.photos.find(x => x.id === done.id) : undefined
  return p ? { title: photoTitle(p.challengeId, p.label), loose: !p.challengeId } : last.value
})

// The photo was already sent as "just a photo": use that one for the challenge instead. The done
// line then shows that photo (`thumb`) and opens it.
const claimed = ref<{ text: string, at: number, thumb?: string, photoId: string } | null>(null)
async function claim(item: UploadItem) {
  const photoId = item.refusal?.photoId
  if (!photoId) return
  try {
    await $fetch(`/api/g/${token.value}/photos/${photoId}/claim`, {
      method: 'POST',
      body: { challengeId: item.challengeId, label: item.label },
      headers: { 'x-device-id': deviceId() },
    })
    queue.forget(item)
    claimed.value = { text: `${photoTitle(item.challengeId, item.label)} sent`, at: Date.now(), thumb: data.value?.photos.find(p => p.id === photoId)?.thumbUrl, photoId }
    refresh()
  }
  catch (err) {
    item.error = errorText(err)
    item.refusal = null
  }
}

// A photo the phone couldn't read: drop it and reopen the same challenge to pick another (or,
// for just a photo, the phone's photos, unless a photo is waiting to be added).
function replaceFailed(item: UploadItem) {
  const c = item.challengeId ? challengeById.value.get(item.challengeId) ?? null : null
  queue.forget(item)
  if (c) openSheet(c)
  else quickShoot(quickInput.value)
}

const TABS = CHALLENGE_KINDS
// The kind tiles: two rows on one grid, so their edges line up, and the placeholder uses the same
// grid, so nothing moves when the page arrives. The second row has one kind more; the first
// row's last tile spans what's left. Five kinds: the first row is two halves (half the width
// less half the 6 px gap), and Awards, last, is a trophy in a narrow tile, which leaves "Group
// shots 10/10" and "Drama 4/4" room at 360 px. Other sets get equal columns.
const firstRowTabs = Math.floor(TABS.length / 2)
const tabColumns = TABS.length - firstRowTabs
const tabGrid = {
  gridTemplateColumns: TABS.length === 5 ? 'calc(50% - 0.1875rem) minmax(0,1fr) 3.5rem' : `repeat(${tabColumns}, minmax(0,1fr))`,
}
const tabSpan = (i: number) => i === firstRowTabs - 1 ? { gridColumn: `span ${tabColumns - firstRowTabs + 1}` } : undefined
// The tab comes back where the phone left it, so a group hunting Spot it doesn't start over.
const TAB_KEY = computed(() => `pq-tab-${token.value}`)
const tab = ref<string>('station')
onMounted(() => {
  try {
    const saved = localStorage.getItem(TAB_KEY.value)
    if (saved && CHALLENGE_KINDS.some(k => k.type === saved)) tab.value = saved
  }
  catch {}
})
watch(tab, (t) => {
  try {
    localStorage.setItem(TAB_KEY.value, t)
  }
  catch {}
})

function statusOf(c: QuestChallenge): { status: ChallengeStatus, reason: string | null } {
  if (queue.pending.value.some(i => i.challengeId === c.id)) return { status: 'uploading', reason: null }
  const mine = (data.value?.photos ?? []).filter(p => p.challengeId === c.id)
  if (mine.some(p => p.verdict !== 'rejected')) return { status: 'counts', reason: null }
  const rejected = mine.find(p => p.verdict === 'rejected')
  if (rejected) return { status: 'rejected', reason: rejected.rejectReason }
  return { status: 'todo', reason: null }
}

// Challenges this group already has, marked "Done" in the challenge picker.
const doneIds = computed(() => (data.value?.challenges ?? []).filter(c => c.type !== 'award' && statusOf(c).status === 'counts').map(c => c.id))
const byType = (type: string) => (data.value?.challenges ?? []).filter(c => c.type === type)
const doneCount = (type: string) => byType(type).filter(c => statusOf(c).status === 'counts').length

// Each kind's list keeps the challenges in their own order (Stations starts with the group's
// first photo); done ones stay where they are, highlighted.
interface Row { c: QuestChallenge, status: ChallengeStatus, reason: string | null }
const listOf = (type: string): Row[] => byType(type).map(c => ({ c, ...statusOf(c) }))

// Sheet for a challenge, or for "just a photo" when challenge is null.
const sheetOpen = ref(false)
const sheetChallenge = ref<QuestChallenge | null>(null)
function openSheet(c: QuestChallenge | null) {
  sheetChallenge.value = c
  sheetOpen.value = true
}
// A challenge's own photos. The animals race also has every photo that adds an animal to it (the
// server works that out by the scoreboard's rule): a swan sent for Swan counts there too, so the
// race's photos match its count.
const sheetPhotos = computed(() => {
  const c = sheetChallenge.value
  if (!c) return []
  return (data.value?.photos ?? []).filter(p => p.challengeId === c.id || (c.awardKind === 'animal' && !!p.animal))
})
// The photo view opens on a challenge's photos (from its sheet), or on all of the group's (the
// done line, or a group whose photos don't count).
const viewSource = ref<'sheet' | 'all'>('sheet')
const viewPhotos = computed(() => viewSource.value === 'all' ? (data.value?.photos ?? []) : sheetPhotos.value)
// The view follows a photo, not a place in the list: the page refreshes every 30 s, and a
// groupmate's new photo arriving in front mustn't swap the one on show.
const viewId = ref<string | null>(null)
const viewIndex = computed<number | null>({
  get: () => {
    const i = viewId.value ? viewPhotos.value.findIndex(p => p.id === viewId.value) : -1
    return i >= 0 ? i : null
  },
  set: (i) => { viewId.value = i === null ? null : viewPhotos.value[i]?.id ?? null },
})
// A photo moved out of the list on show makes way for the next; after the last, the view closes.
watch(viewPhotos, (list, before) => {
  if (!viewId.value || list.some(p => p.id === viewId.value)) return
  const at = Math.max(0, (before ?? []).findIndex(p => p.id === viewId.value))
  viewId.value = list.length ? list[Math.min(at, list.length - 1)]!.id : null
}, { flush: 'sync' })
function openViewer(source: 'sheet' | 'all', i: number) {
  viewSource.value = source
  viewIndex.value = i
}
function viewPhoto(id: string) {
  const i = sheetPhotos.value.findIndex(p => p.id === id)
  if (i >= 0) openViewer('sheet', i)
}
watch(viewIndex, (i, before) => {
  if (i === null && before !== null) refresh()
})
const { loggedIn, user, fetch: fetchSession } = useUserSession()
onMounted(() => fetchSession())
const isCommittee = computed(() => loggedIn.value && (user.value as { role?: string } | null)?.role === 'committee')
// Photos still sending to the sheet's challenge; for the animals race, to a Spot it animal too
// ("Send for Hornbill"), as they'll show there once sent.
const sheetUploading = computed(() => {
  const c = sheetChallenge.value
  const addsAnimal = (i: UploadItem) => !!i.challengeId && !!animalFor({ label: i.label, verdict: 'pending', removed: false }, challengeById.value.get(i.challengeId))
  return queue.pending.value.filter(i => i.challengeId === (c?.id ?? null) || (c?.awardKind === 'animal' && addsAnimal(i)))
})
// Photos taken but not sent yet (an animal or flower not yet named, a photo from "Take a photo"
// not yet added, one still in the full-screen check): the upload strip offers to finish them.
const drafts = useDrafts(() => token.value)
function finishDraft(challengeId: string) {
  if (challengeId === PHOTO_DRAFT) {
    reviewOpen.value = true
    return
  }
  if (challengeId === SHOT_DRAFT) {
    shotOpen.value = true
    return
  }
  const c = challengeById.value.get(challengeId)
  if (c) openSheet(c)
}

// "Take a photo" and one photo from the phone wait in a sheet to be checked, given a challenge
// if there is one, and added; while one waits, both buttons open it, so a new photo never
// replaces it unseen. Several photos from the phone go straight in as just a photo. A group
// whose photos don't count has nothing to choose, so its photos go straight in too (from the
// camera, once looked at: see `shoot`).
const reviewOpen = ref(false)
const photoDraft = computed(() => drafts.get(PHOTO_DRAFT))
const quickInput = ref<HTMLInputElement>()
const quickCamera = ref<HTMLInputElement>()
function quickShoot(input: HTMLInputElement | undefined) {
  if (photoDraft.value && !data.value?.group.hidden) reviewOpen.value = true
  else input?.click()
}
function onReviewSend(file: File, target: { challengeId: string | null, label: string | null }) {
  queue.add([file], target)
}
const pickNote = ref('')
let pickNoteTimer: ReturnType<typeof setTimeout> | undefined
// Several picked photos go in the queue, up to what the group has left: the server refuses
// anything past its limits, and one refusal per photo would bury the page.
function onQuickPick(e: Event) {
  const input = e.target as HTMLInputElement
  const files = [...(input.files ?? [])]
  input.value = ''
  if (!files.length || !data.value) return
  if (files.length === 1 && !data.value.group.hidden) {
    // One already waiting is never replaced: it opens instead (this one is still on the phone).
    // A photo from the camera can be taken again there, and asks before it's discarded.
    if (!photoDraft.value) drafts.hold(PHOTO_DRAFT, 'photo', files[0]!, { camera: input === quickCamera.value })
    reviewOpen.value = true
    return
  }
  const queued = queue.pending.value
  const loose = data.value.photos.filter(p => !p.challengeId).length + queued.filter(i => !i.challengeId).length
  const room = Math.max(0, Math.min(data.value.maxJustAPhoto - loose, data.value.maxPhotos - data.value.totals.photoCount - queued.length))
  queue.add(files.slice(0, room), { challengeId: null, label: null })
  if (files.length > room) {
    pickNote.value = room === 0
      ? `Your group has reached ${data.value.maxJustAPhoto} photos without a challenge.`
      : `Added ${room} of ${files.length}. That's your group's limit.`
    clearTimeout(pickNoteTimer)
    pickNoteTimer = setTimeout(() => { pickNote.value = '' }, 8000)
  }
}

// A race photo that's really a Spot it animal comes with that challenge instead.
function onPick(files: File[], label: string | null, challengeId?: string) {
  const c = sheetChallenge.value
  queue.add(files, challengeId ? { challengeId, label: null } : { challengeId: c?.id ?? null, label })
}

// A name for photo credits is never asked before a photo: the photo goes first, and the done
// line offers the name until this phone gives one or skips it.
const uploader = useUploaderName()

const animalsChallenge = computed(() => data.value?.challenges.find(c => c.awardKind === 'animal') ?? null)
const coloursChallenge = computed(() => data.value?.challenges.find(c => c.awardKind === 'colour') ?? null)
const nearCap = computed(() => data.value && data.value.totals.photoCount >= data.value.maxPhotos - 20)
const atCap = computed(() => data.value && data.value.totals.photoCount >= data.value.maxPhotos)
const blocked = computed(() => !!data.value?.blocked)
const myCode = deviceCode(deviceId())
const canUpload = computed(() => !!data.value?.uploadsOpen && !atCap.value && !blocked.value)
// Why a challenge sheet can't send, in the words of the page's banner.
const cantSend = computed(() => {
  if (!data.value || canUpload.value) return null
  if (!data.value.uploadsOpen) return { title: 'Uploads are closed' }
  if (blocked.value) return { title: 'This phone can\'t send photos', detail: `Show a committee member this code: ${myCode}` }
  return { title: `Your group has reached ${data.value.maxPhotos} photos` }
})

// "How it works" over the page until this phone closes it, for every group link it opens. The
// group's first photo is explained at the briefing, and is the first row under Stations.
const HOW_KEY = 'pq-how-closed'
const howClosed = ref(false)
try {
  howClosed.value = localStorage.getItem(HOW_KEY) === '1'
}
catch {}
function closeHow() {
  howClosed.value = true
  try {
    localStorage.setItem(HOW_KEY, '1')
  }
  catch {}
}

// The Awards tab: each race with this group's count, from its own photos so a new one shows at
// once, and where that stands against the other groups on the public scoreboard (not while
// it's locked for the reveal).
type Standing = PublicScoreboard['groups'][number]
// Standing, and so whether the prize shows as held, comes from the same scoreboard snapshot as the
// prizes counted in the header's photo points, so the two never disagree between refreshes.
function standing(value: (g: Standing) => number, live: number) {
  const b = board.value
  if (!b || b.frozenAt || !data.value) return null
  const me = b.groups.find(g => g.id === data.value!.group.id)
  const mine = me ? value(me) : live
  const others = b.groups.filter(g => g.id !== data.value!.group.id)
  const best = Math.max(0, ...others.map(value))
  if (mine === 0 && best === 0) return null
  if (mine >= best) return { leads: true, text: mine > best ? 'Leading' : 'Joint lead' }
  // Just the gap: it fits beside the prize at 360 px, and the scoreboard names who's ahead.
  return { leads: false, text: `${best - mine} behind` }
}
// `of` is the muted unit after a count ("of 9"); `bonus` the race's prize; `race` is set for the
// two races sent from the camera.
interface Race { key: keyof typeof AWARD_BONUS, title: string, count: number, of: string, bonus: number, held: boolean, standing: ReturnType<typeof standing>, to: string | null, race: { challenge: QuestChallenge, kind: 'animal' | 'colour', add: string } | null }
// Whether the group holds a race's prize, from the same scoreboard snapshot as the prizes counted
// in the header's photo points, even while the scores are locked: solid means counted.
const holds = (key: keyof typeof AWARD_BONUS) => !!data.value && !!board.value?.awardLeaders[key]?.includes(data.value.group.id)
const races = computed((): Race[] => {
  const d = data.value
  if (!d) return []
  const t = d.totals
  const photosOf = (challenge?: string) => `/gallery?group=${d.group.id}${challenge ? `&challenge=${challenge}` : ''}`
  return [
    ...(animalsChallenge.value
      ? [{ key: 'animals' as const, title: 'Most animals spotted', count: t.animals.length, of: '', bonus: AWARD_BONUS.animals, held: holds('animals'), standing: standing(g => g.animals.length, t.animals.length), to: t.animals.length ? photosOf(ANIMALS_CHALLENGE) : null, race: { challenge: animalsChallenge.value, kind: 'animal' as const, add: 'Add an animal' } }]
      : []),
    ...(coloursChallenge.value
      ? [{ key: 'colours' as const, title: 'Most flower colours', count: t.colours.length, of: `of ${FLOWER_COLOURS.length}`, bonus: AWARD_BONUS.colours, held: holds('colours'), standing: standing(g => g.colours.length, t.colours.length), to: t.colours.length ? photosOf(COLOURS_CHALLENGE) : null, race: { challenge: coloursChallenge.value, kind: 'colour' as const, add: 'Add a flower colour' } }]
      : []),
    { key: 'photos', title: 'Most photos', count: t.photoCount, of: '', bonus: AWARD_BONUS.photos, held: holds('photos'), standing: standing(g => g.photoCount, t.photoCount), to: t.photoCount ? photosOf() : null, race: null },
  ]
})
// The two races sent from the camera, as rows on top of Spot it.
const cameraRaces = computed(() => races.value.flatMap(r => r.race ? [{ ...r, race: r.race }] : []))
// What a race's faint chevron says when it has nothing to open yet.
const NO_PHOTOS_YET = 'No photos yet'

// A challenge's camera (from its sheet) and a hidden group's show the photo full screen first
// (QuestShotReview), to be sent, cropped, taken again or discarded. It lives here, not in the
// challenge's sheet, so the photo survives that sheet closing. A hidden group's photo goes in as
// just a photo. The bottom bar's camera has its own look, the New photo sheet.
// The photo in the check is a draft on the phone (SHOT_DRAFT) with the challenge it's for, so it
// outlives the tab; while one waits, those cameras open it instead, so a new photo never
// replaces it unseen.
// A race's photo (an animal or a flower) skips the check and waits in that race's sheet to be
// named: naming it is the look before it goes, and its thumbnail opens it full screen to crop.
// A race's camera on Awards opens the camera straight away, since a kingfisher won't wait; the
// "Any animal" and "Any flower" rows on Spot it open the sheet first, like every challenge row,
// so a photo already on the phone can be used too.
const shot = ref<{ take: (challengeId: string | null) => void }>()
const shotOpen = ref(false)
const shotDraft = computed(() => drafts.get(SHOT_DRAFT))
// While the camera is open, before there's a draft: the challenge the new photo is for.
const shotTarget = ref<string | null>(null)
const shotFor = computed(() => {
  const id = shotDraft.value ? shotDraft.value.pick?.challengeId ?? null : shotTarget.value
  return id ? challengeById.value.get(id) ?? null : null
})
// How the check names it: as the row that was tapped, with its points.
const shotLabel = computed(() => {
  const c = shotFor.value
  return { title: c?.title ?? 'Just a photo', points: c?.points, earned: !!c && statusOf(c).status === 'counts' }
})
// The strip names a photo waiting in the check by what it's for ("Finish Hornbill photo"), so it
// never reads the same as the New photo sheet's "Finish photo".
function draftName(d: Draft) {
  if (d.challengeId !== SHOT_DRAFT) return null
  const c = d.pick ? challengeById.value.get(d.pick.challengeId) : null
  if (!c) return null
  return photoTitle(c.id, null).replace(/^Your\b/, 'your')
}
const raceInput = ref<HTMLInputElement>()
let raceTarget: QuestChallenge | null = null
function shoot(c: QuestChallenge | null) {
  if (c?.awardKind) {
    raceTarget = c
    raceInput.value?.click()
    return
  }
  if (shotDraft.value) {
    shotOpen.value = true
    return
  }
  shotTarget.value = c?.id ?? null
  shot.value?.take(shotTarget.value)
}
function onRaceShot(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  const c = raceTarget
  if (!file || !c?.awardKind) return
  drafts.hold(c.id, c.awardKind === 'colour' ? 'colour' : 'animal', file, { camera: true })
  openSheet(c)
}
function onShot(file: File, challengeId: string | null) {
  queue.add([file], { challengeId, label: null })
  sheetOpen.value = false
}
// An unfinished photo for that race opens instead, so a new one never silently replaces it; the
// camera shows that photo, so it's clear which will happen.
const draftFor = (c: QuestChallenge | null) => c ? drafts.get(c.id) : null
function raceCamera(c: QuestChallenge | null) {
  if (!c) return
  if (drafts.get(c.id)) openSheet(c)
  else shoot(c)
}
// A refusal may mean the committee just blocked this phone: reload to find out. Once the
// banner says so, the matching notices at the bottom would only repeat it.
watch(() => queue.failed.value.length, (n, before) => {
  if (n > (before ?? 0)) refresh()
})
watch([blocked, () => queue.failed.value.length], ([isBlocked, n], [, before]) => {
  if (isBlocked) queue.failed.value.filter(i => i.refusal?.code === 'phone-blocked').forEach(queue.forget)
  // An older success line shouldn't sit under a refusal or the blocked banner.
  if (isBlocked || n > (before ?? 0)) doneCleared.value = Date.now()
})
const doneCleared = ref(0)
const barEl = ref<HTMLElement>()
const { height: barHeight } = useElementSize(barEl, undefined, { box: 'border-box' })
// Closed uploads hide the camera rather than grey it out; the gallery stays.
const showCamera = computed(() => !data.value?.group.hidden && canUpload.value)
const claimedNewer = computed(() => !!claimed.value && claimed.value.at > (queue.lastDone.value?.at ?? 0))
const doneText = computed(() => {
  const done = queue.lastDone.value
  if (Math.max(done?.at ?? 0, claimed.value?.at ?? 0) <= doneCleared.value) return ''
  if (claimedNewer.value) return claimed.value!.text
  if (!done) return ''
  // Say where photos without a challenge went, so nobody thinks they earned challenge points.
  if (lastInfo.value.loose) return done.count > 1 ? `${done.count} photos added to gallery` : 'Added to gallery'
  return done.count > 1 ? `${done.count} photos sent` : `${lastInfo.value.title} sent`
})
const doneAt = computed(() => Math.max(queue.lastDone.value?.at ?? 0, claimed.value?.at ?? 0))
// The done line's photo: the one just sent (its thumbnail kept from sending), or the one just
// placed under a challenge.
const doneThumb = computed(() => {
  const done = queue.lastDone.value
  if (claimedNewer.value) return claimed.value!.thumb
  return done?.previewUrl ?? data.value?.photos.find(p => p.id === done?.id)?.thumbUrl
})
// A lone photo's done line opens it full size, among the group's photos (after one more refresh
// if the page hasn't got it yet).
const donePhotoId = computed(() => {
  const done = queue.lastDone.value
  return claimedNewer.value ? claimed.value!.photoId : done?.count === 1 ? done.id : null
})
async function viewDone() {
  const id = donePhotoId.value
  const at = () => (data.value?.photos ?? []).findIndex(p => p.id === id)
  if (id && at() < 0) await refresh()
  if (id && at() >= 0) openViewer('all', at())
}
</script>

<template>
  <div class="mx-auto min-h-dvh max-w-lg px-4 pt-2" :style="{ paddingBottom: `${(barHeight || 136) + 24}px` }">
    <!-- A broken or mistyped group link (the app says 404), or no answer at all: only the first
         means choosing another group. -->
    <div v-if="error && !data && error.statusCode === 404" class="flex min-h-[70dvh] flex-col justify-center gap-4 text-center">
      <LinkIcon class="mx-auto size-10 text-muted-foreground" />
      <h1 class="text-2xl font-bold">
        This group link doesn't work
      </h1>
      <Button as="a" href="/" size="lg">
        Choose your group
      </Button>
    </div>
    <div v-else-if="error && !data" class="flex min-h-[70dvh] flex-col justify-center gap-4 text-center">
      <WifiOffIcon class="mx-auto size-10 text-muted-foreground" />
      <h1 class="text-2xl font-bold">
        Couldn't load your group
      </h1>
      <p class="text-base text-muted-foreground">
        Check your signal and try again.
      </p>
      <Button size="lg" :disabled="status === 'pending'" @click="refresh()">
        Retry
      </Button>
    </div>

    <!-- First load: the same shapes as the page, so nothing jumps when it arrives. -->
    <div v-else-if="!data" aria-busy="true">
      <Skeleton class="h-7 w-44" />
      <div class="mt-2.5 flex gap-3">
        <Skeleton class="h-5 w-24" />
        <Skeleton class="h-5 w-20" />
      </div>
      <Skeleton class="mt-3 h-[138px] w-full rounded-2xl" />
      <div class="mt-3 grid gap-1.5" :style="tabGrid">
        <Skeleton v-for="(t, i) in TABS" :key="t.type" class="h-11 rounded-xl" :style="tabSpan(i)" />
      </div>
      <div class="mt-2 divide-y overflow-hidden rounded-2xl border">
        <div v-for="n in 4" :key="n" class="flex gap-3 p-3">
          <Skeleton class="size-6 shrink-0 rounded-full" />
          <div class="flex-1 space-y-2">
            <Skeleton class="h-5 w-2/3" />
            <Skeleton class="h-5 w-full" />
          </div>
        </div>
      </div>
    </div>

    <template v-else>
      <!-- The group's name, then one line: its photo count (opening its photos by challenge, once
           there are any) and its photo points in green (opening its scoreboard breakdown). The
           links are 44 px tall but sit in the 24 px line (-my-2.5). No overall place here (the
           owner's call: the group page isn't for ranking). -->
      <header v-if="!data.group.hidden">
        <h1 class="text-2xl font-bold leading-tight">
          {{ data.group.name }}
        </h1>
        <p class="mt-1 flex items-center gap-3 whitespace-nowrap text-base leading-6">
          <NuxtLink v-if="data.totals.photoCount" :to="`/gallery?group=${data.group.id}`" class="-my-2.5 inline-flex min-h-11 items-center gap-0.5 active:opacity-70" :aria-label="`${data.totals.photoCount} ${data.totals.photoCount === 1 ? 'photo' : 'photos'}: see them by challenge`">
            <span><span class="font-semibold tabular-nums">{{ data.totals.photoCount }}</span> {{ data.totals.photoCount === 1 ? 'photo' : 'photos' }}</span>
            <ChevronRightIcon class="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
          </NuxtLink>
          <span v-else><span class="font-semibold tabular-nums">0</span> photos</span>
          <NuxtLink
            :to="`/scoreboard?group=${data.group.id}`" class="-my-2.5 inline-flex min-h-11 items-center gap-0.5 font-semibold text-primary active:opacity-70"
            :aria-label="`${photoPoints} photo points: see the scoreboard`"
          >
            <span><span class="tabular-nums">{{ photoPoints }}</span> pts</span>
            <ChevronRightIcon class="size-5 shrink-0" aria-hidden="true" />
          </NuxtLink>
        </p>
      </header>
      <h1 v-else class="text-2xl font-bold leading-tight">
        {{ data.group.name }}
      </h1>

      <!-- A refresh that didn't get through (the group's page, or the scoreboard numbers behind
           its points and standings): the page stays as it was, and says so, as the scoreboard
           does. Not while photos are waiting to send: the bar at the bottom already says there's
           no signal. -->
      <div v-if="(error || boardError) && !queue.pending.value.length" class="mt-3 flex items-center gap-2 text-base" role="status">
        <WifiOffIcon class="size-5 shrink-0 text-warning" aria-hidden="true" />
        <span class="min-w-0 flex-1">No signal · may be out of date</span>
        <Button variant="ghost" size="icon" class="-mr-2.5 shrink-0" aria-label="Try again" :disabled="status === 'pending' || boardStatus === 'pending'" @click="refresh(); refreshBoard()">
          <RefreshCwIcon class="size-5" />
        </Button>
      </div>

      <!-- Closed uploads: one line, then the lists as they stand, to look back at (no cameras,
           bar Awards' grey ones, which say why). -->
      <p v-if="!data.uploadsOpen" class="mt-3 rounded-2xl border border-warning/50 bg-warning-soft px-4 py-3 text-lg font-bold" role="status">
        Uploads are closed
      </p>
      <div v-else-if="blocked" class="mt-3 rounded-2xl border border-warning/50 bg-warning-soft p-4" role="status">
        <p class="text-lg font-bold">
          This phone can't send photos
        </p>
        <p class="text-base">
          Show a committee member this code: <span class="font-mono font-bold">{{ myCode }}</span>
        </p>
      </div>
      <Alert v-else-if="atCap" class="mt-3">
        <AlertTitle>Your group has reached {{ data.maxPhotos }} photos</AlertTitle>
        <AlertDescription>That's the most one group can upload. Ask a committee member if you need more.</AlertDescription>
      </Alert>
      <p v-else-if="nearCap" class="mt-3 text-base text-warning">
        {{ data.maxPhotos - data.totals.photoCount }} uploads left for your group.
      </p>
      <p v-if="demo?.demo && canUpload" class="mt-3 text-base text-muted-foreground">
        Demo: photos you send only show on this phone, and clear every night.
      </p>

      <!-- How it works in three lines, each with its icon, and an X (closeHow). Only while photos
           can be sent. -->
      <section v-if="showCamera && !howClosed" class="mt-3 rounded-2xl border border-primary/25 bg-primary/5 px-4 pb-4 pt-1" aria-labelledby="how-title">
        <div class="flex items-center justify-between gap-2">
          <h2 id="how-title" class="text-lg font-bold">
            How it works
          </h2>
          <Button variant="ghost" size="icon" class="-mr-3 shrink-0 text-muted-foreground" aria-label="Close how it works" @click="closeHow">
            <XIcon class="size-5" />
          </Button>
        </div>
        <ul class="space-y-2 text-base">
          <li class="flex gap-3">
            <CameraIcon class="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />Send photos for the challenges below to score points.
          </li>
          <li class="flex gap-3">
            <UsersIcon class="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />Get as many of you in each photo as you can. Enjoy the moment together and create memory keepsakes.
          </li>
          <li class="flex gap-3">
            <SmartphoneIcon class="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />Anyone in your group can send.
          </li>
        </ul>
      </section>

      <section v-if="data.group.hidden" class="mt-4 rounded-2xl border p-4">
        <p class="text-base">
          Photos here show in the gallery and don't count for any group.
        </p>
        <div v-if="canUpload" class="mt-3 grid gap-2">
          <Button size="lg" @click="shoot(null)">
            <CameraIcon /> Take a photo
          </Button>
          <Button size="lg" variant="outline" @click="quickInput?.click()">
            <ImageUpIcon /> Choose from your photos
          </Button>
        </div>
        <p v-if="!data.photos.length" class="mt-3 text-base text-muted-foreground">
          No photos yet.
        </p>
        <div v-else class="mt-4 grid grid-cols-4 gap-1">
          <button v-for="(p, i) in data.photos.slice(0, 12)" :key="p.id" type="button" class="active:opacity-80" :aria-label="`Open photo ${i + 1}`" @click="openViewer('all', i)">
            <img :src="p.thumbUrl" alt="" loading="lazy" class="aspect-square w-full rounded-md object-cover">
          </button>
        </div>
      </section>

      <QuestNowCard v-if="!data.group.hidden" class="mt-3" :start-slot="data.group.startSlot" :stations="data.stations" :now="now" :first-round-at="data.firstRoundAt" />

      <!-- Stays when uploads close, read-only: no cameras (Awards' turn grey and say why), but
           every list and sheet opens. -->
      <section v-if="!data.group.hidden" class="mt-3" aria-label="Challenges">
        <Tabs v-model="tab">
          <div>
            <!-- One line each ("Spot it 7/19"), in two rows on one grid (see tabGrid); Awards is a
                 trophy, named for screen readers. The chosen kind is grey with a dark edge and bold
                 label, so green stays for done challenges and points. -->
            <TabsList class="grid h-auto w-full gap-1.5 bg-transparent p-0" :style="tabGrid">
              <TabsTrigger
                v-for="(t, i) in TABS" :key="t.type" :value="t.type" :style="tabSpan(i)"
                class="group h-11 min-w-0 gap-1 rounded-xl border border-border bg-background px-1 text-base text-foreground data-[state=active]:border-foreground/60 data-[state=active]:bg-foreground/10"
                :aria-label="t.type === 'award' ? t.label : `${t.label}, ${doneCount(t.type)} of ${byType(t.type).length} done`"
              >
                <TrophyIcon v-if="t.type === 'award'" class="size-5" aria-hidden="true" />
                <template v-else>
                  <span class="font-medium group-data-[state=active]:font-semibold">{{ t.label }}</span>
                  <span class="font-normal tabular-nums opacity-75 group-data-[state=active]:opacity-100">{{ doneCount(t.type) }}/{{ byType(t.type).length }}</span>
                </template>
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent v-for="t in TABS.filter(t => t.type !== 'award')" :key="t.type" :value="t.type" class="mt-2">
            <!-- Any animal or flower can be sent from here too: a list of its own above Spot it,
                 shaped like the challenge rows, with the race's prize on the title line, what wins
                 it, and where the group stands and its count (as on Awards). A tap opens the
                 race's sheet, as a challenge row does: Take a photo or Choose from your photos,
                 and what was found. A photo still waiting for its name shows in place of the
                 icon, and the sheet opens on it. While this phone can't send they stay, locked:
                 the sheet says why. -->
            <ul v-if="t.type === 'spot' && cameraRaces.length" class="mb-2 divide-y overflow-hidden rounded-2xl border">
              <!-- Not tinted while held, unlike a counted challenge: a race stays open, so these rows are
                   for sending more. The Awards tab shows who holds what. -->
              <li v-for="r in cameraRaces" :key="r.key">
                <button
                  type="button" class="flex min-h-14 w-full items-start gap-3 px-3 py-3 text-left transition-colors active:bg-muted"
                  @click="openSheet(r.race.challenge)"
                >
                  <span class="flex size-6 shrink-0 items-center justify-center" aria-hidden="true">
                    <LockIcon v-if="!canUpload" class="size-5 text-muted-foreground" />
                    <img v-else-if="draftFor(r.race.challenge)" :src="draftFor(r.race.challenge)!.url" alt="" class="size-7 max-w-none rounded-md object-cover ring-1 ring-black/10">
                    <!-- A gold badge, like the prize, since these two are award races. -->
                    <span v-else class="flex size-6 items-center justify-center rounded-full bg-amber-100 ring-1 ring-inset ring-amber-300">
                      <PawPrintIcon v-if="r.race.kind === 'animal'" class="size-4 text-amber-700" />
                      <FlowerIcon v-else class="size-4 text-amber-700" />
                    </span>
                  </span>
                  <span class="min-w-0 flex-1">
                    <span class="flex items-baseline justify-between gap-2">
                      <span class="text-base font-semibold leading-snug">{{ r.race.kind === 'animal' ? 'Any animal' : 'Any flower' }}</span>
                      <QuestPointsPill award class="-mt-0.5" :points="r.bonus" :earned="r.held" />
                    </span>
                    <span class="block text-base text-muted-foreground">{{ r.title }} wins</span>
                    <!-- Where the group stands, then its count: "Leading · 5 found",
                         "3 behind · 0 of 9 found", or "0 found" before anyone has one. -->
                    <span class="flex items-baseline gap-1.5 text-base text-muted-foreground">
                      <span v-if="r.standing" :class="r.standing.leads && 'font-semibold text-amber-800'">{{ r.standing.text }}</span>
                      <span v-if="r.standing" aria-hidden="true">·</span>
                      <span class="tabular-nums">{{ r.count }}{{ r.of && ` ${r.of}` }} found</span>
                    </span>
                    <span v-if="canUpload && draftFor(r.race.challenge)" class="sr-only">Photo waiting for its name</span>
                  </span>
                </button>
              </li>
            </ul>
            <!-- Clips each row's background to the list's rounded corners. -->
            <ul class="divide-y overflow-hidden rounded-2xl border">
              <li v-for="r in listOf(t.type)" :key="r.c.id">
                <QuestChallengeRow :challenge="r.c" :status="r.status" :reason="r.reason" @open="openSheet(r.c)" />
              </li>
            </ul>
          </TabsContent>

          <!-- One row per race: its prize by the name (gold outline while it's on offer, solid while
               this group holds it), where the group stands, and its count. Every row ends in the
               same 68 px cell (a 44 px slot inside the row's 12 px edge), never empty, so the
               counts line up in one column before it: the camera on the two races sent from the
               camera (straight to it, or to the photo still waiting for its name, shown in its
               place; grey while this phone can't send, and a tap says why), a chevron on the
               others (faint while there's nothing to open, and a tap says so). The rest of a row
               opens the group's photos for it. -->
          <TabsContent value="award" class="mt-2">
            <ul class="divide-y overflow-hidden rounded-2xl border">
              <!-- A race this group holds is tinted pastel gold, as a counted challenge is tinted green,
                   in the prize's colour since the lead can still change. -->
              <li v-for="r in races" :key="r.key" class="flex" :class="r.held && 'bg-amber-50'">
                <component
                  :is="r.to ? NuxtLink : 'div'" :to="r.to ?? undefined"
                  class="flex min-h-16 min-w-0 flex-1" :class="r.to && 'active:bg-muted'"
                >
                  <span class="flex min-w-0 flex-1 items-center gap-3 py-2.5 pl-3">
                    <!-- The race's name on its own line, then its prize and where the group stands
                         (nothing yet while no group has any), so every row has the same shape
                         whatever the name's length. The prize sits on the first line of what
                         follows it, should that ever wrap. -->
                    <span class="min-w-0 flex-1">
                      <span class="block text-base font-semibold leading-snug">{{ r.title }}</span>
                      <span class="mt-1 flex items-baseline gap-2 text-base">
                        <QuestPointsPill award :points="r.bonus" :earned="r.held" />
                        <span v-if="r.standing" class="min-w-0" :class="r.standing.leads ? 'font-semibold text-amber-800' : 'text-muted-foreground'">{{ r.standing.text }}</span>
                      </span>
                    </span>
                    <span class="shrink-0 whitespace-nowrap text-right text-xl font-bold tabular-nums">{{ r.count }}<span v-if="r.of" class="ml-1 text-base font-medium text-muted-foreground">{{ r.of }}</span></span>
                  </span>
                  <span v-if="!r.race && r.to" class="flex w-[68px] shrink-0 items-center justify-center px-3" aria-hidden="true">
                    <ChevronRightIcon class="size-5 text-muted-foreground" />
                  </span>
                </component>
                <!-- Nothing to open yet: the chevron stays, faint, and a tap says so. -->
                <button
                  v-if="!r.race && !r.to" type="button" class="flex w-[68px] shrink-0 items-center justify-center px-3"
                  :aria-label="NO_PHOTOS_YET" aria-disabled="true" @click="toast(NO_PHOTOS_YET, { id: 'awards-end' })"
                >
                  <ChevronRightIcon class="size-5 text-muted-foreground/40" aria-hidden="true" />
                </button>
                <!-- While this phone can't send, the camera stays, grey, and a tap says why. -->
                <button
                  v-if="r.race" type="button" class="group flex w-[68px] shrink-0 items-center justify-center px-3"
                  :aria-label="!canUpload ? `${r.race.add}: ${cantSend?.title ?? 'Uploads are closed'}` : draftFor(r.race.challenge) ? `Finish ${r.race.kind === 'colour' ? 'flower' : 'animal'} photo` : r.race.add"
                  :aria-disabled="!canUpload || undefined"
                  @click="canUpload ? raceCamera(r.race.challenge) : toast(cantSend?.title ?? 'Uploads are closed', { id: 'awards-end' })"
                >
                  <img v-if="canUpload && draftFor(r.race.challenge)" :src="draftFor(r.race.challenge)!.url" alt="" class="size-11 rounded-xl object-cover ring-1 ring-black/10 group-active:opacity-80">
                  <span
                    v-else class="flex size-11 items-center justify-center rounded-xl ring-1 ring-inset" aria-hidden="true"
                    :class="canUpload ? 'bg-primary/10 text-primary ring-primary/20 group-active:bg-primary/20' : 'bg-muted text-muted-foreground/60 ring-border'"
                  >
                    <CameraIcon class="size-6" />
                  </span>
                </button>
              </li>
            </ul>
          </TabsContent>
        </Tabs>
      </section>
    </template>

    <!-- Bottom bar: upload status, then "Take a photo" (camera, or the upload segment for photos
         already on the phone) and the gallery. A photo waiting to be added shows in place of the
         camera, and either segment opens it. -->
    <div v-if="data" ref="barEl" class="fixed inset-x-0 bottom-0 z-40 border-t bg-background pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-4px_12px_rgb(0_0_0/0.06)]">
      <div class="mx-auto max-w-lg space-y-2 px-4">
      <p v-if="pickNote" class="rounded-xl bg-muted px-3 py-2 text-base" role="status">
        {{ pickNote }}
      </p>
      <QuestUploadBar
        :pending="queue.pending.value" :failed="queue.failed.value" :current="queue.current.value" :title-for="titleFor"
        :done-text="doneText" :done-at="doneAt" :done-thumb="doneThumb" :done-opens="!!donePhotoId" :batch-done="queue.batchDone.value"
        :name-offer="!uploader.asked.value" :drafts="drafts.list.value" :draft-name="draftName"
        @view-done="viewDone" @name="uploader.editing.value = true"
        @retry="queue.retry" @discard="queue.forget" @replace="replaceFailed" @claim="claim"
        @finish="finishDraft"
      />
      <div class="grid gap-2" :class="showCamera ? 'grid-cols-[3fr_2fr] max-[380px]:grid-cols-[2fr_1fr]' : 'grid-cols-1'">
        <div v-if="showCamera" class="flex" role="group" aria-label="Take a photo">
          <Button size="lg" class="min-w-0 flex-1 rounded-r-none px-2 max-[380px]:gap-1.5" :aria-label="photoDraft ? 'Finish photo' : undefined" @click="quickShoot(quickCamera)">
            <img v-if="photoDraft" :src="photoDraft.url" alt="" class="size-7 rounded-md object-cover">
            <CameraIcon v-else /> Take a photo
          </Button>
          <Button size="lg" class="w-12 shrink-0 rounded-l-none border-l border-l-primary-foreground/40 px-0" aria-label="Upload photos from your phone" @click="quickShoot(quickInput)">
            <ImageUpIcon />
          </Button>
        </div>
        <Button as-child size="lg" variant="outline" class="px-2">
          <NuxtLink to="/gallery">
            <ImagesIcon /> Gallery
          </NuxtLink>
        </Button>
      </div>
      </div>
    </div>

    <!-- "Take a photo": one segment opens the camera, the other the photo library. Android's
         picker for several photos never offers the camera, hence two inputs. -->
    <input id="quick-camera-input" ref="quickCamera" type="file" accept="image/*" capture="environment" class="hidden" aria-hidden="true" tabindex="-1" @change="onQuickPick">
    <input id="quick-photo-input" ref="quickInput" type="file" accept="image/*" multiple class="hidden" aria-hidden="true" tabindex="-1" @change="onQuickPick">

    <QuestPhotoReview
      v-if="data" v-model:open="reviewOpen" :token="token" :challenges="data.challenges" :done="doneIds"
      :animals-found="data.totals.animals" :colours-found="data.totals.colours" :cant-send="cantSend" @send="onReviewSend"
    />
    <QuestChallengeSheet
      v-if="data"
      v-model:open="sheetOpen"
      :token="token"
      :challenge="sheetChallenge"
      :photos="sheetPhotos"
      :uploading="sheetUploading"
      :cant-send="cantSend"
      :animals-found="data.totals.animals"
      :colours-found="data.totals.colours"
      :challenges="data.challenges"
      :done="doneIds"
      @pick="onPick" @view="viewPhoto" @camera="shoot(sheetChallenge)"
    />
    <!-- The photo just taken, full screen (see `shoot`): after the challenge's sheet, so it opens
         over it. -->
    <QuestShotReview
      v-if="data" ref="shot" v-model:open="shotOpen" :token="token" :title="shotLabel.title" :points="shotLabel.points"
      :earned="shotLabel.earned" @send="onShot"
    />
    <!-- A race's camera: the photo goes straight to its sheet to be named (see `shoot`). -->
    <input ref="raceInput" type="file" accept="image/*" capture="environment" class="hidden" aria-hidden="true" tabindex="-1" @change="onRaceShot">
    <!-- After the sheets, on purpose: every overlay sits on the same layer, so the one placed later
         in the page is on top, and a challenge's sheet opens the full-size photo over itself. The
         photo view's own sheets and dialogs come after it in turn. -->
    <PhotoViewer
      v-if="data" v-model:index="viewIndex" :photos="viewPhotos" :groups="[{ id: data.group.id, name: data.group.name }]" :challenges="data.challenges" :committee="isCommittee" :time-style="data.photoTimes"
      :done="doneIds" :animals-found="data.totals.animals" :colours-found="data.totals.colours"
      :move-blocked="!data.uploadsOpen ? 'Uploads are closed' : blocked ? 'This phone can\'t send photos' : null"
      @changed="refresh()" @removed="refresh()"
    />
    <span v-if="status === 'pending' && data" class="sr-only">Refreshing</span>
  </div>
</template>
