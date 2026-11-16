<script setup lang="ts">
import type { GalleryList, GalleryMine, GalleryPhoto } from '~/types/api'
import { ANIMALS_CHALLENGE, CHALLENGE_KINDS } from '~~/data/challenges'
import { EVENT, PHOTO_TIMES } from '~~/data/event'
import { photoTimeSlug } from '#shared/utils/photoTime'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch, watchEffect } from 'vue'
import { useElementSize, useIntersectionObserver } from '@vueuse/core'
import { ArrowUpIcon, DownloadIcon, ImageOffIcon, Loader2Icon, RefreshCwIcon, WifiOffIcon, XIcon } from '@lucide/vue'
import { toast } from 'vue-sonner'
import { SAVE_BATCH, type SavePick } from '~/composables/usePhotoSave'
import { BULK_TOAST, photosOf, sayBulk, stillHidden, unfinished } from '~/composables/useCommitteeBatch'
import { likePending } from '~/composables/useLikes'
import { capitalise, photoName } from '~/utils/photoName'

// Everyone's photos, newest first, or most liked first on the second tab. With one group picked
// (and all challenges), they're laid out by challenge instead, so anyone can see what that group
// found. My photos, the ones this phone sent, stay newest first, since the usual reason to look
// is the one just sent. The whole gallery comes in one answer (/api/gallery; docs/caching.md says
// why): the filters, the sort and Select all work on it here, and the grid shows it a screenful
// at a time.
useHead({ title: `Gallery · ${EVENT.appName}` })
const route = useRoute()
const router = useRouter()
const group = ref(typeof route.query.group === 'string' ? route.query.group : '')
const challenge = ref(typeof route.query.challenge === 'string' ? route.query.challenge : '')
const sort = ref<'new' | 'liked'>(route.query.sort === 'liked' ? 'liked' : 'new')
// My photos, in the Group filter. Group IDs are g1, g2… and recce (scripts/seed.ts), so no group
// can be called this.
const MINE = 'mine'
const myPhotos = computed(() => group.value === MINE)
const byChallenge = computed(() => !!group.value && !myPhotos.value && challenge.value === '')
// The committee's list of photos a judge said don't count (in the Challenge filter).
const NOT_COUNTED = 'not-counted'
const notCountedList = computed(() => challenge.value === NOT_COUNTED)

// Every photo, as the last answer had it. A refresh updates these same objects, so a like or a
// move shows where the photo is.
const all = ref<GalleryPhoto[]>([])
const meta = ref<Pick<GalleryList, 'groups' | 'challenges' | 'photoTimes'> | null>(null)
const timeStyle = computed(() => meta.value?.photoTimes ?? PHOTO_TIMES)
const groupName = (id: string) => meta.value?.groups.find(g => g.id === id)?.name ?? ''
// "Group 3", without its IC.
const shortGroup = (id: string) => groupName(id).replace(/ \(.+\)$/, '')
const challengeOf = (id: string | null) => id ? meta.value?.challenges.find(c => c.id === id) ?? null : null
// This phone's likes and photos (/api/gallery/mine), laid over the shared list. In demo mode
// also the photos only this phone sees, merged into the list.
let likedHere = new Set<string>()
let sentHere = new Set<string>()
let ownHere: GalleryMine['photos'] = []
const loaded = ref(false)
const loading = ref(false)
const failed = ref(false)
// A check after the photos loaded didn't get through: the photos stay, with a line saying so
// and Retry, as on the scoreboard, until a check gets through.
const stale = ref(false)
const checking = ref(false)

// 15 s, so a list stuck on a weak signal fails (with Retry) instead of hanging.
const fetchList = () => $fetch<GalleryList>('/api/gallery', { timeout: 15_000 })
const fetchMine = () => $fetch<GalleryMine>('/api/gallery/mine', { headers: { 'x-device-id': deviceId() }, timeout: 15_000 })
// Both at once. This phone's own can fail on its own: the hearts then stay as they are.
const fetchBoth = () => Promise.all([fetchList(), fetchMine().catch(() => null)])

// Bumped by each Hide or Undo made here, so a gallery look that set off before it can't bring
// back what it changed.
let edits = 0

// Takes in an answer. Photos already here are updated in place, except a like still being saved,
// which keeps what this phone shows. Photos no longer in the answer (removed) go.
function take(list: GalleryList, mine: GalleryMine | null) {
  meta.value = { groups: list.groups, challenges: list.challenges, photoTimes: list.photoTimes }
  if (mine) {
    likedHere = new Set(mine.liked)
    sentHere = new Set(mine.sent)
    ownHere = mine.photos
  }
  const known = new Map(all.value.map(p => [p.id, p]))
  const photos = ownHere.length ? [...list.photos, ...ownHere].sort(newer) : list.photos
  all.value = photos.map((p) => {
    const s = known.get(p.id)
    if (!s) return { ...p, liked: likedHere.has(p.id), mine: sentHere.has(p.id) }
    const { likes, ...rest } = p
    Object.assign(s, rest)
    if (mine) s.mine = sentHere.has(p.id)
    if (!likePending(p.id)) {
      s.likes = likes
      if (mine) s.liked = likedHere.has(p.id)
    }
    return s
  })
}

// What's on show: the photos there were when the list last settled (it loaded, a filter or the
// sort changed, or "new photos" was tapped), and for Most liked, the likes they were ranked by.
// Photos sent since wait behind "N new photos", and a like never moves a photo while you look.
const settled = ref({ ids: new Set<string>(), likes: new Map<string, number>() })
// The grid grows a screenful at a time as its end nears the screen. The photo view and Select
// all always have every photo.
const STEP = 60
const limit = ref(STEP)
function settle() {
  settled.value = { ids: new Set(all.value.map(p => p.id)), likes: new Map(all.value.map(p => [p.id, p.likes])) }
  limit.value = STEP
}

// Each load is numbered, so a slow answer can't replace a newer one.
let latest = 0
let inflight: Promise<void> | null = null
function load() {
  const run = ++latest
  loading.value = true
  failed.value = false
  inflight = (async () => {
    try {
      const [list, mine] = await fetchBoth()
      if (run !== latest) return
      take(list, mine)
      settle()
      loaded.value = true
      stale.value = false
    }
    catch {
      // Photos already showing stay, and say they may be out of date; an empty page says they
      // couldn't load.
      if (run === latest) {
        failed.value = true
        stale.value = loaded.value
      }
    }
    finally {
      if (run === latest) loading.value = false
    }
  })()
  return inflight
}
onMounted(() => load())

// Every 30 s, a quiet look for changes. When nothing changed, the browser gets "unchanged" (304)
// with no photos. Likes, moves and verdicts update in place and removed photos go; photos sent
// since wait behind "3 new photos" at the top until tapped, so nothing moves under a finger.
// This phone's own are asked for again only when there are new photos (one may be its own):
// its likes from here are already shown. In demo mode, every time: its own photos are only
// there, so one it sent, hid or removed elsewhere shows or goes.
const demo = useDemo()
async function check() {
  if (loading.value || checking.value) return
  if (!loaded.value) return load()
  const run = latest
  const at = edits
  checking.value = true
  try {
    const list = await fetchList()
    const known = new Set(all.value.map(p => p.id))
    const mine = demo.value?.demo || list.photos.some(p => !known.has(p.id)) ? await fetchMine().catch(() => null) : null
    if (run === latest && at === edits) {
      take(list, mine)
      stale.value = false
    }
  }
  catch {
    if (run === latest) stale.value = true
  }
  finally {
    checking.value = false
  }
}
useVisibleInterval(() => {
  if (viewIndex.value === null && linkedIndex.value === null) check()
}, 30_000)

// The filters and the sort, as the address carries them, for Back and reload.
function filtersQuery() {
  return {
    ...(group.value ? { group: group.value } : {}),
    ...(challenge.value ? { challenge: challenge.value } : {}),
    ...(sort.value === 'liked' ? { sort: 'liked' } : {}),
  }
}
// A new filter or sort settles the list afresh. No request: every photo is here already.
watch([group, challenge, sort], () => {
  showAllOthers.value = false
  router.replace({ query: filtersQuery() })
  settle()
})

function inChallenge(p: GalleryPhoto) {
  const c = challenge.value
  if (!c) return true
  if (c === 'none') return !p.challengeId
  if (c === NOT_COUNTED) return !!p.rejectReason
  // Animal Spot it photos count in the race too, so they show with it.
  if (c === ANIMALS_CHALLENGE) return p.challengeId === ANIMALS_CHALLENGE || !!challengeOf(p.challengeId)?.animal
  return p.challengeId === c
}
const inGroup = (p: GalleryPhoto) => !group.value || (myPhotos.value ? p.mine : p.groupId === group.value)
const matches = (p: GalleryPhoto) => inGroup(p) && inChallenge(p)
// Newest first; the ID settles a tie, so the order is always the same.
const newer = (a: Pick<GalleryPhoto, 'id' | 'uploadedAt'>, b: Pick<GalleryPhoto, 'id' | 'uploadedAt'>) => b.uploadedAt - a.uploadedAt || (b.id > a.id ? 1 : b.id < a.id ? -1 : 0)
// The photos on show under the filters, in the chosen order. One group's photos laid out by
// challenge are newest first within each challenge: most challenges hold one photo, so Newest
// and Most liked are hidden there.
const sortBy = computed(() => byChallenge.value || notCountedList.value ? 'new' : sort.value)
const order = computed(() => {
  const { ids, likes } = settled.value
  const list = all.value.filter(p => ids.has(p.id) && matches(p))
  return sortBy.value === 'liked'
    ? list.sort((a, b) => (likes.get(b.id) ?? 0) - (likes.get(a.id) ?? 0) || newer(a, b))
    : list.sort(newer)
})
// Sent since the list settled. Newest puts them at the top, where the pill takes you; one
// group's photos by challenge put each in its challenge's section, so the pill goes to the first
// of them on the page, after showing enough of the page to reach it.
const fresh = computed(() => sortBy.value === 'new' ? all.value.filter(p => !settled.value.ids.has(p.id) && matches(p)).length : 0)
async function showFresh() {
  const arrived = new Set(all.value.filter(p => !settled.value.ids.has(p.id) && matches(p)).map(p => p.id))
  settle()
  if (!byChallenge.value) return window.scrollTo({ top: 0, behavior: 'smooth' })
  const target = viewList.value.find(p => arrived.has(p.id))
  if (target && !target.challengeId) showAllOthers.value = true
  const at = target ? viewList.value.indexOf(target) : -1
  if (at >= limit.value) limit.value = Math.ceil((at + 1) / STEP) * STEP
  await nextTick()
  const el = target ? document.getElementById(`photo-${target.id}`) : null
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  else window.scrollTo({ top: 0, behavior: 'smooth' })
}

// A link to one photo (`/gallery?photo=<id>`, handy for the committee on the day) opens it once the gallery
// has loaded.
// Until then, a blank photo view waits for it; if it can't load, that says so, with Retry and
// Back to gallery, rather than leave the gallery looking as if the link went nowhere. Once it
// opens, the address goes back to the gallery's own, so closing the photo or Back leaves a clean one.
const linkId = typeof route.query.photo === 'string' ? route.query.photo : ''
const linked = ref<GalleryPhoto[]>([])
const linkedIndex = ref<number | null>(null)
const linkState = ref<'loading' | 'failed' | 'gone' | null>(linkId ? 'loading' : null)
let linkTry = 0
let linkedChanged = false
// A change after it closed (a Hide's Undo) is caught up at once.
function onLinkedChange() {
  if (linkedIndex.value === null) check()
  else linkedChanged = true
}
async function openLinked() {
  const mine = ++linkTry
  linkState.value = 'loading'
  if (!loaded.value) await (loading.value && inflight ? inflight : load())
  if (mine !== linkTry) return
  if (!loaded.value) {
    linkState.value = 'failed'
    return
  }
  const p = all.value.find(x => x.id === linkId)
  if (!p) {
    linkState.value = 'gone'
    return
  }
  linked.value = [p]
  await router.replace({ query: { ...route.query, photo: undefined } })
  if (mine !== linkTry) return
  linkState.value = null
  linkedIndex.value = 0
}
function leaveLinked() {
  linkTry++
  linkState.value = null
  router.replace({ query: { ...route.query, photo: undefined } })
}
useBackClose(() => !!linkState.value, leaveLinked)
onMounted(() => {
  if (linkId) openLinked()
})
watch(linkedIndex, (i) => {
  if (i === null && linkedChanged) {
    linkedChanged = false
    check()
  }
})

// "Swan", "Monitor lizard" (an animal for the race), "White flower", or "Just a photo".
const what = (p: GalleryPhoto) => photoName(challengeOf(p.challengeId), p.label)
const tileName = (p: GalleryPhoto) => `${groupName(p.groupId)}, ${what(p)}`

// The filters: two fields side by side, each opening the app's own list sheet. A group shows as
// "Group 3" in its field and in full in the list.
const NOT_TAGGED = 'Photos not tagged to any challenge'
// Every photo a judge said doesn't count: anyone can look through them, reasons and all, and the
// committee can put one right from the photo view. Newest first, without the sort tabs, each
// captioned with its group and challenge and the reason under it. The row shows once there's one
// (and while it's the filter, so the field names it).
const NOT_COUNTED_ROW = { value: NOT_COUNTED, label: 'Photos the committee didn\'t count', short: 'Not counted' }
const challengeFilter = computed(() => challengeSections(meta.value?.challenges ?? [], {
  lead: [
    { value: '', label: 'All challenges' },
    { value: 'none', label: NOT_TAGGED, short: 'Not tagged' },
    ...(notCountedList.value || all.value.some(p => p.rejectReason) ? [NOT_COUNTED_ROW] : []),
  ],
  includeRetired: true,
  points: false,
  // The two races (Animals spotted, Flower colours) under Just a photo, as in the challenge picker.
  order: LIST_ORDER,
}))
// My photos shows once this phone has a photo in the gallery (and while it's the filter, so the
// field names it).
const groupFilter = computed(() => [{
  title: '',
  options: [
    { value: '', label: 'Everyone' },
    ...(myPhotos.value || all.value.some(p => p.mine) ? [{ value: MINE, label: 'My photos' }] : []),
    ...(meta.value?.groups ?? []).map(g => ({ value: g.id, label: g.name, short: shortGroup(g.id) })),
  ],
}])

// Animals and flower colours: each photo's animal or colour shows under it.
const showLabels = computed(() => challengeOf(challenge.value)?.type === 'award')

// By challenge: a section per race first (Animals spotted, Flower colours, as in the challenge
// lists), then a section per kind in the group page's order (Stations, Spot it, Group shots,
// Drama); every photo is its own tile, in the challenge list's order, captioned with its
// challenge (a race's with its animal or colour), so two photos for one challenge sit side by
// side. Then the photos without a challenge, folded to two rows.
interface Section { key: string, title: string, rank: number, tiles: GalleryPhoto[] }
const KIND_LABEL: Record<string, string> = Object.fromEntries(CHALLENGE_KINDS.map(k => [k.type, k.label]))
const sections = computed(() => {
  const place = new Map((meta.value?.challenges ?? []).map((c, i) => [c.id, i]))
  const out = new Map<string, Section>()
  for (const p of order.value) {
    const c = challengeOf(p.challengeId)
    if (!c) continue
    const race = c.type === 'award'
    const key = race ? c.id : c.type
    let s = out.get(key)
    if (!s) out.set(key, s = { key, title: race ? c.title : KIND_LABEL[c.type] ?? c.type, rank: LIST_ORDER.indexOf(c.type) * 1000 + (race ? place.get(c.id) ?? 0 : 0), tiles: [] })
    s.tiles.push(p)
  }
  // A stable sort, so a challenge's photos keep their order (newest first).
  const at = (p: GalleryPhoto) => place.get(p.challengeId ?? '') ?? 0
  return [...out.values()]
    .sort((a, b) => a.rank - b.rank)
    .map(s => ({ ...s, tiles: s.tiles.sort((a, b) => at(a) - at(b)) }))
})
// A race photo is named by its animal or colour; any other by its challenge.
const captionOf = (p: GalleryPhoto) => challengeOf(p.challengeId)?.type === 'award' ? what(p) : challengeOf(p.challengeId)?.title ?? what(p)
const others = computed(() => order.value.filter(p => !p.challengeId))
const showAllOthers = ref(false)

// What the grid shows now: the first `limit` photos, in the order on screen.
const shown = computed(() => {
  let left = limit.value
  const first = <T>(list: T[]) => {
    const out = list.slice(0, Math.max(0, left))
    left -= out.length
    return out
  }
  if (!byChallenge.value) return { grid: first(order.value), sections: [] as Section[], others: [] as GalleryPhoto[] }
  const secs = sections.value.map(s => ({ ...s, tiles: first(s.tiles) })).filter(s => s.tiles.length)
  return { grid: [] as GalleryPhoto[], sections: secs, others: first(showAllOthers.value ? others.value : others.value.slice(0, 6)) }
})
const showable = computed(() => byChallenge.value
  ? sections.value.reduce((n, s) => n + s.tiles.length, 0) + (showAllOthers.value ? others.value.length : Math.min(6, others.value.length))
  : order.value.length)
// The end of the grid: as it nears the screen, the next screenful shows. It's a new marker for
// each screenful, so the observer looks again even when the end is still near.
const listEnd = ref<HTMLElement | null>(null)
useIntersectionObserver(listEnd, ([e]) => {
  if (e?.isIntersecting && limit.value < showable.value) limit.value += STEP
}, { rootMargin: '0px 0px 800px 0px' })

// The photo view swipes through photos in the order they're shown, as they were when it opened,
// so a photo moved to another challenge doesn't reshuffle what comes next.
const viewList = computed(() => byChallenge.value
  ? [...sections.value.flatMap(k => k.tiles), ...others.value]
  : order.value)
const viewPhotos = ref<GalleryPhoto[]>([])
const viewIndex = ref<number | null>(null)
function view(p: GalleryPhoto) {
  // A Hide's Undo would sit over the photo view's buttons.
  toast.dismiss(BULK_TOAST)
  if (byChallenge.value && !p.challengeId) showAllOthers.value = true
  viewPhotos.value = [...viewList.value]
  viewIndex.value = viewPhotos.value.indexOf(p)
}
// Changes in the photo view (moved, judged) are already on these photos; once it closes, a quiet
// check catches up without reloading, so the grid stays where it was. One after it closed (a
// Hide's Undo) is caught up at once.
const changed = ref(false)
function onViewChange() {
  if (viewIndex.value === null) check()
  else changed.value = true
}
watch(viewIndex, (i) => {
  if (i === null && changed.value) {
    changed.value = false
    check()
  }
})
function onRemoved(id: string) {
  saver.forget(id)
  // Also from this phone's own (demo mode), so a later look can't bring it back.
  ownHere = ownHere.filter(p => p.id !== id)
  sentHere.delete(id)
  all.value = all.value.filter(p => p.id !== id)
  viewPhotos.value = viewPhotos.value.filter(p => p.id !== id)
  changed.value = true
}

const { toggleLike } = useLikes()

// Saving photos to the phone: Select (or holding a photo) turns taps into picks, and the bar at
// the bottom saves them (see usePhotoSave). Picks carry across filters on purpose (a few from
// each group), so the header always shows the total.
const picking = ref(false)
// The Save bar's height, so the grid's last row can scroll clear of it whatever notes it shows.
const bar = ref<HTMLElement | null>(null)
const { height: barHeight } = useElementSize(bar, undefined, { box: 'border-box' })
// Toasts sit above it while it's up, so one saying "try again" doesn't cover the buttons.
const toastLift = useState<number>('toast-lift', () => 0)
watchEffect(() => {
  toastLift.value = picking.value ? Math.round(barHeight.value) + 8 : 0
})
onBeforeUnmount(() => {
  toastLift.value = 0
})
// A failed photo's fresh link, null if it's gone, undefined if the app couldn't be asked.
// 8 s each, by its own timer: ofetch ignores `timeout` when it's given a signal.
async function recheck(id: string, signal: AbortSignal) {
  const ctrl = new AbortController()
  const stop = () => ctrl.abort()
  const timer = setTimeout(stop, 8000)
  signal.addEventListener('abort', stop)
  try {
    const page = await $fetch<GalleryList>('/api/gallery', { query: { photo: id }, retry: 0, signal: ctrl.signal })
    return page.photos[0]?.largeUrl ?? null
  }
  catch {
    return undefined
  }
  finally {
    clearTimeout(timer)
    signal.removeEventListener('abort', stop)
  }
}
// Photos found deleted during a save leave the grid, so they can't be ticked again.
const saver = usePhotoSave(recheck, (ids) => {
  all.value = all.value.filter(p => !ids.includes(p.id))
})
// Saved files are named "G3-Swan-0952-Ethan.jpg": group, what it is, time, photo credit. The
// time carries the weekday or date when photo times do ("Sat-0952", "14Nov-0952").
const words = (s: string) => s.normalize('NFKD').replace(/[^\w\s-]/g, '').trim().split(/[\s_-]+/).filter(Boolean).map(capitalise).join('-')
function pickOf(p: GalleryPhoto): SavePick {
  const number = meta.value?.groups.find(g => g.id === p.groupId)?.number
  const parts = [number ? `G${number}` : '', words(what(p)).slice(0, 40), photoTimeSlug(p.uploadedAt, timeStyle.value), words(p.uploaderName ?? '').slice(0, 20)]
  return { id: p.id, url: p.largeUrl, name: `${parts.filter(Boolean).join('-')}.jpg` }
}
// The finger that held a photo lifts over whatever is under it then: a Save (or a bigger bar)
// that appears under it in that moment ignores the tap.
let heldAt = 0
let lift: AbortController | null = null
// A hold that starts picking adds picking's history entry when the finger lifts: browsers let
// Back skip an entry added without a tap, and a finger still down isn't one yet.
let entryOnLift = false
let ceiling: ReturnType<typeof setTimeout> | undefined
function guardLift() {
  lift?.abort()
  clearTimeout(ceiling)
  const ctrl = new AbortController()
  lift = ctrl
  heldAt = Number.POSITIVE_INFINITY
  const done = () => {
    heldAt = Date.now()
    ctrl.abort()
    clearTimeout(ceiling)
    if (entryOnLift) {
      entryOnLift = false
      // A lift is a tap; a drag that turned into a scroll, or the ceiling, isn't.
      if (picking.value) restoreEntry()
    }
  }
  // Should the lift never reach the page, the guard ends anyway.
  ceiling = setTimeout(done, 5000)
  window.addEventListener('pointerup', done, { signal: ctrl.signal })
  window.addEventListener('pointercancel', done, { signal: ctrl.signal })
}
// While the committee's Hide or its Undo runs, the ticks hold still.
function tap(p: GalleryPhoto) {
  if (!picking.value) return view(p)
  if (!batch.busy.value) saver.toggle(pickOf(p))
}
// The tick in the photo view, while picking.
function tickViewed(id: string) {
  if (batch.busy.value) return
  const p = viewPhotos.value.find(x => x.id === id)
  if (p) saver.toggle(pickOf(p))
}
// Holding a photo starts picking with it. The guard runs from when the finger lifts.
function hold(p: GalleryPhoto) {
  if (batch.busy.value) return
  if (!picking.value) entryOnLift = true
  guardLift()
  picking.value = true
  saver.toggle(pickOf(p))
}
function onSave() {
  if (Date.now() - heldAt < 800) return
  // A save that empties the ticks ends picking, through a pending leave if there is one.
  saver.save(() => (leaveTo ? leave() : stopPicking()))
}
// Cancel, Done and leaving the page all stop a save and drop the ticks.
// Ends picking without touching the history.
function endPicking() {
  lift?.abort()
  clearTimeout(ceiling)
  entryOnLift = false
  heldAt = 0
  picking.value = false
  saver.clear()
}
function stopPicking() {
  endPicking()
  takeEntryOff()
}

// ---------- Back, and leaving during a save ----------
// Back leaves picking and clears the ticks, as Android's selection bars do (Google Photos,
// Gmail, Files): picking adds a history entry at the same address, tagged for this page, as the
// photo view does, and Back takes it off. The photo view's own entry sits on top (carrying the
// tag), so Back closes a photo first. Ending picking any other way takes the entry off too, then
// puts the current filters in the address, so the gallery stays one step in the history.
// While a save is getting photos, Back and leaving the page don't stop it: they ask first
// ("Stop saving?"). Closing the tab gets the browser's own prompt where it has one.
const galleryPath = route.path
// A fresh tag for each entry, so one left in the forward history is never taken for the current.
let token = ''
let entry = false
let popping = false
let afterPop: (() => void) | null = null
let popFallback: ReturnType<typeof setTimeout> | undefined
const stopAsk = ref(false)
let leaveTo: string | null = null
// Android's Back on the question keeps saving, as its button does.
useBackClose(stopAsk, keepSaving)
const ours = () => !!token && window.history.state?.galleryPicking === token
function addEntry() {
  if (entry) return
  token = Math.random().toString(36).slice(2)
  window.history.pushState({ ...window.history.state, galleryPicking: token, photoViewer: undefined }, '')
  entry = true
}
function takeEntryOff(then?: () => void) {
  if (!entry || !ours()) {
    entry = false
    then?.()
    return
  }
  popping = true
  afterPop = then ?? null
  // A photo open over picking: step back past its entry too.
  window.history.go(window.history.state?.photoViewer ? -2 : -1)
  // Should the browser not report going back, carry on anyway.
  popFallback = setTimeout(() => {
    if (!popping) return
    popping = false
    entry = false
    const next = afterPop
    afterPop = null
    fixAddress(next)
  }, 500)
}
// After Back the address may show the filters from before picking: once the router has taken
// in the address Back left (or, if it didn't change, shortly after), put the current ones back,
// then carry on (`then`).
let fixing: { off: () => void, timer: ReturnType<typeof setTimeout> } | null = null
function stopFixing() {
  fixing?.off()
  clearTimeout(fixing?.timer)
  fixing = null
}
function fixAddress(then?: (() => void) | null) {
  stopFixing()
  const put = async () => {
    if (!fixing) return
    stopFixing()
    const now = router.currentRoute.value
    if (now.path === galleryPath) {
      const want = filtersQuery()
      const differs = (['group', 'challenge', 'sort'] as const).some(k => (now.query[k] ?? '') !== (want[k] ?? ''))
      if (differs) await router.replace({ query: want })
    }
    then?.()
  }
  fixing = { off: router.afterEach(() => setTimeout(put)), timer: setTimeout(put, 300) }
}
function onPop() {
  if (!entry) return
  // The photo view closing back onto picking's entry.
  if (ours()) return
  entry = false
  // Back to another page altogether (a long-press jump): the router's leave check has it.
  if (window.location.pathname !== galleryPath) {
    popping = false
    afterPop = null
    return
  }
  if (popping) {
    popping = false
    clearTimeout(popFallback)
    const then = afterPop
    afterPop = null
    fixAddress(then)
    return
  }
  // During a save, Back asks; the entry comes back only on "Keep saving" (a tap). A second Back
  // meanwhile answers the question as "Keep saving" on Android (useBackClose); on an iPhone it's
  // a plain leave, which the route check asks about too.
  if (saver.state.value === 'getting') {
    fixAddress()
    stopAsk.value = true
    return
  }
  endPicking()
  fixAddress()
}
function onUnload(e: BeforeUnloadEvent) {
  if (saver.state.value !== 'getting') return
  e.preventDefault()
  e.returnValue = ''
}
watch(picking, (on) => {
  if (on && !entryOnLift) addEntry()
})
onMounted(() => {
  // An entry left from an earlier visit: it's just the gallery now.
  if (window.history.state?.galleryPicking) {
    const { galleryPicking: _, ...rest } = window.history.state
    window.history.replaceState(rest, '')
  }
  window.addEventListener('popstate', onPop)
  window.addEventListener('beforeunload', onUnload)
})
onBeforeUnmount(() => {
  window.removeEventListener('popstate', onPop)
  window.removeEventListener('beforeunload', onUnload)
  clearTimeout(popFallback)
  stopFixing()
  endPicking()
})
// Leaving through the menu or a link: during a save, ask first; while picking, take picking's
// entry off before going, so Back from the next page lands on one gallery step with the filters
// as they were left.
onBeforeRouteLeave((to) => {
  if (saver.state.value === 'getting') {
    leaveTo = to.fullPath
    stopAsk.value = true
    return false
  }
  if (picking.value && entry && ours()) {
    leaveTo = to.fullPath
    leave()
    return false
  }
  return true
})
function leave() {
  const to = leaveTo
  leaveTo = null
  endPicking()
  takeEntryOff(() => {
    if (to) router.push(to)
  })
}
// Picking's entry, once picking has gone on without one: now if the browser says a tap just
// happened, otherwise on the next tap on the page. Browsers let Back skip (and mark skippable
// the page behind) an entry added without one; Escape and a scroll don't count.
function addEntryOnNextTap() {
  window.addEventListener('click', () => {
    if (picking.value) addEntry()
  }, { once: true, capture: true })
}
function restoreEntry() {
  if (entry) return
  if (navigator.userActivation?.isActive) addEntry()
  else addEntryOnNextTap()
}
function keepSaving() {
  stopAsk.value = false
  leaveTo = null
  if (picking.value) restoreEntry()
}
function stopSaving() {
  stopAsk.value = false
  if (leaveTo) leave()
  else stopPicking()
}
// The save finished while the question was up. After a link, carry on only if it saved
// everything it tried: one that ended at "Ready" (nothing in Photos yet), with the sheet closed,
// or with failures stays, so it shows. After Back, picking carries on and gets its entry back.
watch(() => saver.state.value, (now) => {
  if (now === 'getting' || !stopAsk.value) return
  stopAsk.value = false
  if (!leaveTo) {
    if (picking.value) restoreEntry()
    return
  }
  if (saver.outcome.value !== 'saved') {
    leaveTo = null
    if (picking.value) restoreEntry()
    return
  }
  leave()
})
// While photos are still downloading, how many; after that (checking failed ones), no number.
const stillComing = computed(() => saver.got.value < saver.of.value ? saver.of.value - saver.got.value : 0)
// Select all: every photo under the current filters, all here already. Once they're all ticked,
// it takes them off again; ticks under other filters stay.
const allHere = computed(() => viewList.value.length > 0 && viewList.value.every(p => saver.isPicked(p.id)))
function selectAll() {
  if (allHere.value) return saver.remove(viewList.value.map(p => p.id))
  showAllOthers.value = true
  saver.add(viewList.value.map(pickOf))
}
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`
const saveLabel = computed(() => {
  const n = saver.count.value
  if (!n) return 'Tap photos to select'
  if (saver.state.value === 'getting') return `Getting photos ${saver.got.value} of ${saver.of.value}`
  if (saver.state.value === 'ready') return `Ready · Save ${plural(saver.readyCount.value, 'photo', 'photos')}`
  return n > saver.batch.value ? `Save ${saver.batch.value} of ${n}` : `Save ${plural(n, 'photo', 'photos')}`
})
// One line on how the last save went, or what to expect from the next.
const saveNote = computed(() => {
  if (saver.refused.value) return 'Sharing didn\'t open. Try again.'
  if (saver.failed.value || saver.gone.value) {
    return [
      saver.failed.value ? `${plural(saver.failed.value, 'photo', 'photos')} didn't download. Check your signal, then save again.` : '',
      saver.gone.value ? `${plural(saver.gone.value, 'photo is', 'photos are')} no longer in the gallery.` : '',
    ].filter(Boolean).join(' ')
  }
  if (saver.state.value === 'started') return 'Downloads started. Missing some? Allow downloads for this site in your browser\'s settings, then save again.'
  if (!saver.sharing.value && saver.count.value > 1 && saver.state.value === 'idle') return 'Allow downloads if asked.'
  return ''
})

// Signed-in committee members get the judge's actions in the photo view.
const { loggedIn, user, fetch: fetchSession } = useUserSession()
onMounted(() => fetchSession())
const isCommittee = computed(() => loggedIn.value && (user.value as { role?: string } | null)?.role === 'committee')

// ---------- The committee's Hide, on what's ticked ----------
// Hide (beside Save) moves the ticked photos out of the gallery into Hidden photos (/c/hidden),
// files kept, with Undo for 8 s; over BIG_HIDE it asks first (useCommitteeBatch). What went, or
// had already gone, leaves the ticks and the grid; what didn't stays ticked. A toast always says
// what happened. Like Save, it doesn't take the tap that ends a hold.
const BIG_HIDE = 10
const batch = useCommitteeBatch()
const confirmHide = ref(false)
useBackClose(confirmHide)
// Gone when a filter opens or changes (it would cover the list's lower rows) or a photo opens.
watch([group, challenge], () => toast.dismiss(BULK_TOAST))
// Committee members get Hide beside Save, while nothing is being saved.
const canHide = computed(() => isCommittee.value && saver.count.value > 0 && saver.state.value === 'idle')
function askHide() {
  if (batch.busy.value || Date.now() - heldAt < 800) return
  if (saver.count.value > BIG_HIDE) confirmHide.value = true
  else hideTicked()
}
function hideTicked() {
  confirmHide.value = false
  const ids = saver.ids()
  // The photos as they are now: a refresh between requests mustn't shrink what Undo puts back.
  const before = new Map(all.value.filter(p => saver.isPicked(p.id)).map(p => [p.id, p]))
  return batch.inTurn('remove', async () => {
    const r = await batch.send('remove', ids)
    if (r.out) return
    edits++
    const left = new Set([...r.done, ...r.refused.map(x => x.id)])
    const taken = r.done.map(id => before.get(id)).filter((p): p is GalleryPhoto => !!p)
    for (const id of left) saver.forget(id)
    all.value = all.value.filter(p => !left.has(p.id))
    if (!saver.count.value) stopPicking()
    const undo = taken.length ? () => undoHide(taken) : undefined
    if (r.failed) sayBulk(unfinished(taken.length, ids.length, 'hidden', r.why), undo)
    else if (taken.length) sayBulk(`${photosOf(taken.length)} hidden`, undo)
    else sayBulk(r.refused.every(x => x.reason === 'already-hidden') ? 'Already hidden' : 'Already deleted for good')
  })
}
// Undo puts back what that Hide took out, where it was, without "new photos".
function undoHide(taken: GalleryPhoto[]) {
  return batch.inTurn('restore', async () => {
    const r = await batch.send('restore', taken.map(p => p.id))
    if (r.out) return
    edits++
    const back = new Set(r.done)
    const returning = taken.filter(p => back.has(p.id) && !all.value.some(q => q.id === p.id))
    all.value = [...all.value, ...returning]
    settled.value = {
      ids: new Set([...settled.value.ids, ...back]),
      likes: new Map([...settled.value.likes, ...returning.map(p => [p.id, p.likes] as const)]),
    }
    if (r.failed) sayBulk(`${back.size ? `${back.size} of ${taken.length} back.` : 'Couldn\'t undo.'} The rest are still hidden.`)
    else if (r.refused.length) sayBulk(`${back.size ? `${back.size} back. ` : ''}${stillHidden(r.refused)}`)
  })
}

</script>

<template>
  <main class="mx-auto min-h-dvh max-w-lg px-4 pt-2" :class="!picking && 'pb-[max(1.5rem,env(safe-area-inset-bottom))]'" :style="picking ? { paddingBottom: `${barHeight + 16}px` } : undefined">
    <!-- While picking, the title says how many are picked, with Select all and Cancel beside it.
         The last button's words sit on the content edge; its tap area spills past it. -->
    <div class="flex items-center justify-between gap-2">
      <h1 class="min-w-0 truncate text-2xl font-bold leading-tight" aria-live="polite">
        {{ !picking ? 'Gallery' : saver.count.value ? `${saver.count.value} selected` : 'Select photos' }}
      </h1>
      <div class="-mr-2.5 flex shrink-0">
        <Button v-if="picking" variant="ghost" class="px-2.5 text-base" :disabled="!order.length || saver.locked.value || !!batch.busy.value" @click="selectAll">
          {{ allHere ? 'Deselect all' : 'Select all' }}
        </Button>
        <Button v-if="order.length || picking" variant="ghost" class="px-2.5 text-base" :disabled="!!batch.busy.value" @click="picking ? stopPicking() : (picking = true)">
          {{ !picking ? 'Select' : saver.state.value === 'started' ? 'Done' : 'Cancel' }}
        </Button>
      </div>
    </div>
    <!-- Two filters side by side, each opening the app's own list sheet. -->
    <div class="mt-3 grid grid-cols-2 gap-2" @click.capture="toast.dismiss(BULK_TOAST)">
      <SelectSheet v-model="group" title="Group" :sections="groupFilter" />
      <SelectSheet v-model="challenge" title="Challenge" :sections="challengeFilter" search="Search challenges" />
    </div>
    <!-- Newest first, or most liked first. As tall as the filters; each tab still takes taps over
         the track's full 44 px. Not for one group's photos by challenge, nor the photos the committee didn't count (sortBy). -->
    <Tabs v-if="!byChallenge && !notCountedList" :model-value="sort" class="mt-2" @update:model-value="v => sort = v === 'liked' ? 'liked' : 'new'">
      <TabsList class="grid h-11 w-full grid-cols-2 p-[3px]">
        <TabsTrigger value="new" class="h-full text-foreground/75 after:absolute after:inset-x-0 after:-inset-y-1 data-[state=active]:bg-background data-[state=active]:font-semibold data-[state=active]:text-foreground data-[state=active]:shadow-sm">
          Newest
        </TabsTrigger>
        <TabsTrigger value="liked" class="h-full text-foreground/75 after:absolute after:inset-x-0 after:-inset-y-1 data-[state=active]:bg-background data-[state=active]:font-semibold data-[state=active]:text-foreground data-[state=active]:shadow-sm">
          Most liked
        </TabsTrigger>
      </TabsList>
    </Tabs>

    <!-- A check that didn't get through: the photos stay, and say so. -->
    <div v-if="stale && loaded" class="mt-3 flex items-center gap-2 text-base" role="status">
      <WifiOffIcon class="size-5 shrink-0 text-warning" aria-hidden="true" />
      <span class="min-w-0 flex-1">No signal · showing earlier photos</span>
      <Button variant="ghost" size="icon" class="-mr-2.5 shrink-0" aria-label="Try again" :disabled="loading || checking" @click="check()">
        <RefreshCwIcon class="size-5" :class="checking && 'animate-spin'" />
      </Button>
    </div>

    <!-- Photos sent since the list loaded wait here, so nothing appears above where you're looking. -->
    <div v-if="fresh" class="sticky top-2 z-30 flex h-0 justify-center">
      <Button size="sm" class="mt-2 rounded-full shadow-md" @click="showFresh">
        <ArrowUpIcon /> {{ fresh }} new {{ fresh === 1 ? 'photo' : 'photos' }}
      </Button>
    </div>

    <p v-if="!loaded && failed" class="mt-6 text-center text-base">
      Photos couldn't load. <button type="button" class="inline-flex min-h-11 items-center font-semibold underline" @click="load()">Try again</button>
    </p>
    <div v-else-if="!loaded" class="mt-3 grid grid-cols-3 gap-1" aria-busy="true">
      <Skeleton v-for="n in 12" :key="n" class="aspect-square w-full rounded-md" />
    </div>
    <p v-else-if="order.length === 0" class="mt-10 text-center text-base text-muted-foreground">
      {{ notCountedList ? 'None so far.' : 'No photos here yet.' }}
    </p>

    <template v-else-if="byChallenge">
      <section v-for="k in shown.sections" :key="k.key" class="mt-5">
        <h2 class="text-lg font-bold leading-tight">
          {{ k.title }}
        </h2>
        <!-- Three across, like the main grid. Every photo, named in up to three lines, with
             "Doesn't count" under one a judge turned down. -->
        <ul class="mt-2 grid grid-cols-3 gap-x-1 gap-y-3">
          <GalleryTile
            v-for="p in k.tiles" :id="`photo-${p.id}`" :key="p.id" :photo="p" :name="tileName(p)" :subject="captionOf(p)" :caption="captionOf(p)" words
            :picking="picking" :picked="saver.isPicked(p.id)" @open="tap(p)" @hold="hold(p)" @expand="view(p)" @like="toggleLike(p)"
          >
            <span v-if="p.rejectReason" class="block text-base font-medium leading-snug text-destructive">Doesn't count</span>
          </GalleryTile>
        </ul>
      </section>
      <section v-if="shown.others.length" class="mt-5">
        <h2 class="text-lg font-bold leading-tight">
          {{ NOT_TAGGED }}
        </h2>
        <ul class="mt-2 grid grid-cols-3 gap-1">
          <GalleryTile
            v-for="p in shown.others" :id="`photo-${p.id}`" :key="p.id" :photo="p" :name="tileName(p)" subject="Just a photo"
            :picking="picking" :picked="saver.isPicked(p.id)" @open="tap(p)" @hold="hold(p)" @expand="view(p)" @like="toggleLike(p)"
          />
        </ul>
        <Button v-if="!showAllOthers && others.length > 6" variant="outline" class="mt-2 w-full" @click="showAllOthers = true">
          See all {{ others.length }}
        </Button>
      </section>
    </template>

    <!-- Among the photos the committee didn't count, each photo says who sent it and what for and, in up to two
         lines, why it doesn't count. -->
    <ul v-else class="mt-3 grid grid-cols-3" :class="showLabels || notCountedList ? 'gap-x-1 gap-y-3' : 'gap-1'">
      <GalleryTile
        v-for="p in shown.grid" :key="p.id" :photo="p" :name="notCountedList ? `${tileName(p)}, ${p.rejectReason}` : tileName(p)" :subject="`${what(p)} from ${shortGroup(p.groupId)}`"
        :caption="notCountedList ? (group ? what(p) : `${shortGroup(p.groupId)} · ${what(p)}`) : showLabels ? what(p) : ''" :words="notCountedList"
        :picking="picking" :picked="saver.isPicked(p.id)" @open="tap(p)" @hold="hold(p)" @expand="view(p)" @like="toggleLike(p)"
      >
        <!-- Only then: an empty slot would still give other tiles a caption's space. -->
        <template v-if="notCountedList" #default>
          <span class="line-clamp-2 break-words text-base leading-snug text-destructive">{{ p.rejectReason }}</span>
        </template>
      </GalleryTile>
    </ul>
    <!-- The end of the grid: the next screenful shows as this nears the screen. -->
    <div :key="limit" ref="listEnd" aria-hidden="true" />

    <!-- Picking: what's picked, and Save. -->
    <div v-if="picking" ref="bar" class="fixed inset-x-0 bottom-0 z-40 border-t bg-background pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-4px_12px_rgb(0_0_0/0.06)]">
      <div class="mx-auto max-w-lg space-y-2 px-4">
        <!-- How the last save went, or what to expect; then, for a big pick, the album that's
             coming anyway. The status line is always there, so screen readers hear it change. -->
        <p role="status" class="text-base text-muted-foreground" :class="!saveNote && 'sr-only'">
          {{ saveNote }}
        </p>
        <p v-if="saver.count.value > SAVE_BATCH && saver.state.value !== 'started'" class="text-base text-muted-foreground">
          {{ EVENT.albumNote }}
        </p>
        <!-- The committee's Hide beside Save: a third of the row, no wider than on a 412 px
             phone, as in the photo editor. While it runs, its spinner takes its label's place. -->
        <div v-if="canHide" class="grid grid-cols-[min(calc((100%-0.75rem)/3),123px)_1fr] gap-3">
          <Button size="lg" variant="outline" class="px-3" :disabled="!!batch.busy.value" :aria-busy="batch.busy.value === 'remove'" @click="askHide">
            <Loader2Icon v-if="batch.busy.value === 'remove'" class="animate-spin" aria-hidden="true" />
            <span :class="batch.busy.value === 'remove' && 'sr-only'">Hide</span>
          </Button>
          <Button size="lg" class="px-3" :disabled="!!batch.busy.value" @click="onSave">
            <DownloadIcon /> {{ saveLabel }}
          </Button>
        </div>
        <Button v-else size="lg" class="w-full" :disabled="!saver.count.value || saver.state.value === 'getting'" @click="onSave">
          <Loader2Icon v-if="saver.state.value === 'getting'" class="animate-spin" />
          <DownloadIcon v-else-if="saver.count.value" />
          {{ saveLabel }}
        </Button>
      </div>
    </div>

    <!-- Hide with more than BIG_HIDE ticked (a Select all, say): asks first, as an iPhone does. -->
    <Dialog v-model:open="confirmHide">
      <DialogContent class="w-[calc(100vw-2rem)] max-w-md" :show-close-button="false">
        <DialogTitle>Hide {{ photosOf(saver.count.value) }}?</DialogTitle>
        <DialogDescription>You can unhide them in Hidden photos.</DialogDescription>
        <div class="grid grid-cols-2 gap-2">
          <Button variant="outline" @click="confirmHide = false">
            Cancel
          </Button>
          <Button @click="hideTicked">
            Hide
          </Button>
        </div>
      </DialogContent>
    </Dialog>

    <!-- Back or leaving the page while a save is getting its photos. -->
    <Dialog :open="stopAsk" @update:open="v => { if (!v) keepSaving() }">
      <DialogContent class="w-[calc(100vw-2rem)] max-w-md" :show-close-button="false">
        <DialogTitle>Stop saving?</DialogTitle>
        <DialogDescription>
          {{ !stillComing ? 'It\'s nearly done.' : stillComing === 1 ? '1 photo is still downloading.' : `${stillComing} photos are still downloading.` }}
        </DialogDescription>
        <div class="grid grid-cols-2 gap-2">
          <Button variant="outline" @click="keepSaving">
            Keep saving
          </Button>
          <Button @click="stopSaving">
            Stop
          </Button>
        </div>
      </DialogContent>
    </Dialog>

    <PhotoViewer
      v-model:index="linkedIndex" :photos="linked" :groups="meta?.groups ?? []" :challenges="meta?.challenges ?? []" :committee="isCommittee" :time-style="timeStyle" single
      @changed="onLinkedChange" @removed="onLinkedChange"
    />
    <PhotoViewer
      v-model:index="viewIndex" :photos="viewPhotos" :groups="meta?.groups ?? []" :challenges="meta?.challenges ?? []" :committee="isCommittee" :time-style="timeStyle"
      :ticked="picking ? saver.isPicked : undefined" :tick-locked="saver.locked.value || !!batch.busy.value"
      @changed="onViewChange" @removed="onRemoved" @tick="tickViewed"
    />

    <!-- A link to one photo, until it opens: the photo view's blank stage, then why it didn't. -->
    <Dialog :open="!!linkState" @update:open="v => { if (!v) leaveLinked() }">
      <DialogContent
        class="top-0 left-0 flex h-dvh w-screen max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-none border-0 bg-background p-0 ring-0 sm:max-w-none data-open:zoom-in-100 data-closed:zoom-out-100"
        :show-close-button="false"
      >
        <div class="mx-auto flex w-full max-w-lg shrink-0 items-center px-4 pt-[env(safe-area-inset-top)]">
          <Button variant="ghost" size="icon" class="-ml-[15px]" aria-label="Back to gallery" @click="leaveLinked">
            <XIcon class="size-6" />
          </Button>
        </div>
        <div class="mx-auto flex w-full max-w-lg flex-1 flex-col items-center justify-center gap-2 px-4 pb-16 text-center">
          <template v-if="linkState === 'loading'">
            <Loader2Icon class="size-8 animate-spin text-muted-foreground" aria-hidden="true" />
            <DialogTitle class="sr-only">
              Opening the photo
            </DialogTitle>
            <DialogDescription class="sr-only">
              It's loading.
            </DialogDescription>
          </template>
          <template v-else>
            <ImageOffIcon class="size-10 text-muted-foreground" aria-hidden="true" />
            <DialogTitle class="mt-1 text-xl font-bold">
              {{ linkState === 'gone' ? 'This photo isn\'t in the gallery' : 'The photo couldn\'t load' }}
            </DialogTitle>
            <DialogDescription class="text-base text-muted-foreground">
              {{ linkState === 'gone' ? 'It may have been removed.' : 'Check your signal.' }}
            </DialogDescription>
            <div class="mt-3 grid w-full max-w-xs gap-2">
              <Button v-if="linkState === 'failed'" size="lg" @click="openLinked">
                Retry
              </Button>
              <Button size="lg" :variant="linkState === 'failed' ? 'outline' : 'default'" @click="leaveLinked">
                Back to gallery
              </Button>
            </div>
          </template>
        </div>
      </DialogContent>
    </Dialog>
  </main>
</template>
