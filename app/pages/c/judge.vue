<script setup lang="ts">
import type { ComponentPublicInstance } from 'vue'
import type { JudgedPhoto, JudgeQueue, QueuePhoto } from '~/types/api'
import type { Removal, ViewerPhoto } from '~/components/PhotoViewer.vue'
import { EVENT, PHOTO_TIMES } from '~~/data/event'
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, shallowRef, watch } from 'vue'
import { ArrowUpIcon, CheckIcon, ChevronLeftIcon, ChevronRightIcon, EllipsisIcon, FlowerIcon, ImageOffIcon, Maximize2Icon, PartyPopperIcon, PawPrintIcon, PencilIcon, XIcon } from '@lucide/vue'
import { formatPhotoTime } from '#shared/utils/photoTime'
import { capitalise, photoName } from '~/utils/photoName'
import { spotAnimals, spotItFor } from '~/utils/animalNames'

// Photos no judge has looked at yet. One at a time, as large as the screen allows, with Counts
// and Doesn't count always in the same place; or a batch of them in a grid, by challenge, to tap
// the wrong ones and mark the rest checked at once.
await useCommitteeGuard()
useHead({ title: `Judge photos · ${EVENT.appName}` })

const route = useRoute()
const router = useRouter()
const group = ref(typeof route.query.group === 'string' ? route.query.group : '')
const grid = ref(route.query.view === 'grid')
const { data, refresh, error } = await useFetch<JudgeQueue>('/api/committee/queue', { query: { group, all: computed(() => grid.value ? 1 : undefined) }, deep: true, headers: { 'x-device-id': deviceId() } })
// A session that ends while judging goes back to sign-in, then here again.
useSignInAgain(error)
// Refresh now and then, but not while the judge is in the middle of something: a refresh could
// put a different photo first, and the action would land on that one.
useVisibleInterval(() => {
  const midAction = busy.value || rejecting.value || editing.value || moreOpen.value || confirmInappropriate.value || confirmDelete.value || zoomIndex.value !== null || viewIndex.value !== null
  if (!midAction && (grid.value || (data.value?.photos.length ?? 0) < 4)) refresh()
}, 15_000)

const patch = (id: string, body: Record<string, unknown>) => $fetch<JudgedPhoto>(`/api/committee/photos/${id}`, { method: 'PATCH', body })

type Challenge = JudgeQueue['challenges'][number]
type Placed = { groupId: string, challengeId: string | null, label: string | null }
const challengeOf = (id: string | null) => data.value?.challenges.find(c => c.id === id) ?? null
const groupName = (id: string) => data.value?.groups.find(g => g.id === id)?.name ?? id
// "G1", as in the filter; an example group like the recce team keeps its name.
function shortGroup(id: string) {
  const g = data.value?.groups.find(x => x.id === id)
  return g && !g.hidden ? `G${g.number}` : groupName(id)
}
// "Hornbill", or the animal or colour for a race: "Swan", "Red flower".
const what = (p: Omit<Placed, 'groupId'>) => photoName(challengeOf(p.challengeId), p.label)
// The photo in a few words, for sheet headers and the line above the buttons: "G3 · Lily".
const identity = (p: Placed) => `${shortGroup(p.groupId)} · ${what(p)}`
// Which race an entry is in. It starts the credit line, so "Hornbill" in Animals spotted isn't
// mistaken for the Hornbill challenge.
const raceName = (c: Challenge | null) => c?.awardKind === 'animal' ? 'Animals spotted' : c?.awardKind === 'colour' ? 'Flower colours' : ''
// Group, time, name, in that order everywhere: "Animals spotted · G1 · 9:47 am · Alex".
const timeStyle = computed(() => data.value?.photoTimes ?? PHOTO_TIMES)
const credit = (p: QueuePhoto) => [raceName(challengeOf(p.challengeId)), shortGroup(p.groupId), formatPhotoTime(p.uploadedAt, timeStyle.value), p.uploaderName]

// An animal entry that's also a Spot it challenge ("Hornbill" or "Hornbil" for Animals spotted,
// "Black swan" for Swan) may have been meant for that challenge's points. Whether to move it is
// the judge's call. The same test as the group page's when the photo was named (animalNames.ts).
const spots = computed(() => spotAnimals(data.value?.challenges ?? []))
function spotFor(p: Omit<Placed, 'groupId'>) {
  if (challengeOf(p.challengeId)?.awardKind !== 'animal' || !p.label) return null
  return spotItFor(p.label, spots.value)
}

const totalRemaining = computed(() => Object.values(data.value?.remaining ?? {}).reduce((a, b) => a + b, 0))
// The group filter shows what's left: "All groups · 56", then each group with photos waiting.
// A count of nothing isn't shown.
const count = (n: number) => n ? ` · ${n}` : ''
const groupFilter = computed(() => [{
  options: [
    { value: '', label: `All groups${count(totalRemaining.value)}` },
    ...(data.value?.groups ?? [])
      .filter(g => (data.value?.remaining[g.id] ?? 0) > 0 || g.id === group.value)
      .sort((a, b) => Number(!!a.hidden) - Number(!!b.hidden) || a.number - b.number)
      .map(g => ({ value: g.id, label: `${g.name}${count(data.value?.remaining[g.id] ?? 0)}`, short: `${shortGroup(g.id)}${count(data.value?.remaining[g.id] ?? 0)}` })),
  ],
}])
// Words only: an icon beside "One" read as an empty checkbox.
const VIEWS = [{ grid: false, label: 'One' }, { grid: true, label: 'Grid' }]
watch([group, grid], () => {
  last.value = null
  // A new grid is a new batch: freeze whatever the queue brings next.
  if (grid.value) {
    refreeze = true
    batch.value = null
  }
  router.replace({ query: { ...(group.value ? { group: group.value } : {}), ...(grid.value ? { view: 'grid' } : {}) } })
})

// ---------- One at a time ----------

const photo = computed(() => grid.value ? null : data.value?.photos[0] ?? null)
const challenge = computed(() => challengeOf(photo.value?.challengeId ?? null))
// Who must be in it, then the hint when it adds something: "Whole group. Any lily…".
const needs = computed(() => {
  const c = challenge.value
  if (!c) return ''
  return [c.whoInShot ?? '', c.type !== 'award' && hintAddsSomething(c) ? c.hint : ''].filter(Boolean).join('. ')
})
const spot = computed(() => photo.value ? spotFor(photo.value) : null)

// Only the reasons that fit this photo.
const reasons = computed(() => rejectReasons(challengeOf(held.value?.challengeId ?? null)))
const rejecting = ref(false)
const busy = ref(false)
// What just happened, in a line just above the buttons: for a few seconds the decision with
// Undo, or why it didn't save. It sits in the bottom bar rather than in a toast, so it never
// covers the next photo's buttons.
interface Said { id: string, text: string, error?: boolean, undo?: () => Promise<unknown>, undone?: string }
const last = ref<Said | null>(null)
let lastTimer: ReturnType<typeof setTimeout> | undefined
function showLast(next: Said | null) {
  last.value = next
  clearTimeout(lastTimer)
  if (next) {
    lastTimer = setTimeout(() => {
      last.value = null
    }, 8000)
  }
}

function snapshot() {
  return data.value ? { photos: [...data.value.photos], remaining: { ...data.value.remaining } } : null
}
function restore(before: ReturnType<typeof snapshot>) {
  if (before && data.value) Object.assign(data.value, before)
}
function drop(p: QueuePhoto) {
  if (!data.value?.photos.some(x => x.id === p.id)) return
  data.value.photos = data.value.photos.filter(x => x.id !== p.id)
  data.value.remaining[p.groupId] = Math.max(0, (data.value.remaining[p.groupId] ?? 1) - 1)
}
// Top the queue up once a decision is saved, so the photo just judged can't come back.
function topUp() {
  if ((data.value?.photos.length ?? 0) < 3) refresh()
}
const isTaken = (err: unknown) => (err as { statusCode?: number }).statusCode === 409
const TAKEN = 'Another judge already checked that one'

// Sheets and dialogs act on the photo they show (`held`); the buttons, on the one on screen.
async function act(action: string, extra: Record<string, unknown> = {}, p = photo.value) {
  if (!p || busy.value) return
  busy.value = true
  rejecting.value = false
  // Move on straight away; say what was decided once it's saved, or put the photo back.
  const before = snapshot()
  drop(p)
  showLast(null)
  // Short enough for one line: "Counts: G1 · Hornbill".
  const label = { pass: p.challengeId ? 'Counts' : 'Looks fine', reject: 'Doesn\'t count', remove: 'Hidden', inappropriate: 'Deleted as inappropriate' }[action] ?? 'Deleted'
  const blocked = action === 'inappropriate' && extra.block && p.deviceId ? '. Phone blocked' : ''
  const gone = action === 'delete' || action === 'inappropriate'
  try {
    await patch(p.id, { action, ...extra })
    showLast({
      id: p.id,
      text: `${label}: ${identity(p)}${blocked}`,
      undo: gone ? undefined : async () => {
        if (action === 'remove') await patch(p.id, { action: 'restore' })
        await patch(p.id, { action: 'undo' })
      },
    })
  }
  catch (err) {
    if (isTaken(err)) {
      showLast({ id: p.id, text: TAKEN })
    }
    else {
      restore(before)
      showLast({ id: p.id, text: errorText(err), error: true })
    }
  }
  finally {
    busy.value = false
  }
  topUp()
}

// No decisions while Undo saves: the photo comes back first in the queue.
async function undoLast() {
  const l = last.value
  if (!l?.undo || busy.value) return
  busy.value = true
  showLast(null)
  try {
    await l.undo()
    await refresh()
    showLast({ id: l.id, text: l.undone ?? 'Undone, back in the queue' })
  }
  catch (err) {
    showLast({ id: l.id, text: errorText(err), error: true })
  }
  finally {
    busy.value = false
  }
}

// Wrong challenge, or a misspelt animal: the list opens straight away. Moving a photo is the
// judge's call that it belongs there, so it counts too and the queue moves on. Undo puts it back
// where it was, unchecked.
const editing = ref(false)
async function moveAndCount(choice: { challengeId: string | null, label: string | null }, p = photo.value) {
  if (!p || busy.value) return
  editing.value = false
  if (choice.challengeId === p.challengeId && normaliseLabel(choice.label ?? '') === normaliseLabel(p.label ?? '')) return
  busy.value = true
  const from = { challengeId: p.challengeId, label: p.label ?? '' }
  const before = snapshot()
  drop(p)
  showLast(null)
  try {
    const row = await patch(p.id, { action: 'challenge', challengeId: choice.challengeId, label: choice.label ?? '' })
    p.challengeId = choice.challengeId
    p.label = row?.label ?? null
  }
  catch (err) {
    restore(before)
    showLast({ id: p.id, text: errorText(err), error: true })
    busy.value = false
    return
  }
  try {
    await patch(p.id, { action: 'pass' })
    showLast({
      id: p.id,
      text: choice.challengeId ? `Moved and counted: ${identity(p)}` : `Now just a photo: ${shortGroup(p.groupId)}`,
      undo: () => patch(p.id, { action: 'challenge', ...from }),
    })
  }
  catch (err) {
    // Moved, but not marked: unless another judge got there first, it waits at its new place.
    if (isTaken(err)) {
      showLast({ id: p.id, text: TAKEN })
    }
    else {
      restore(before)
      showLast({ id: p.id, text: errorText(err), error: true })
    }
  }
  finally {
    busy.value = false
  }
  topUp()
}

const confirmDelete = ref(false)
const confirmInappropriate = ref(false)
const moreOpen = ref(false)
// The photo the sheets and dialogs are about, set as one opens and kept while it slides away, so
// its header doesn't switch to the next photo on the way out.
const held = shallowRef<QueuePhoto | null>(null)
function openSheet(which: 'editing' | 'rejecting' | 'moreOpen') {
  held.value = photo.value
  ;({ editing, rejecting, moreOpen })[which].value = true
}
// Let the sheet close before a confirmation opens over the page.
function fromMore(next: () => void) {
  moreOpen.value = false
  setTimeout(next, 250)
}

// The stage: the column's full width, down to just above the buttons. The whole photo sits in
// the middle of it at its own shape, never cropped, on the page's own white; grey shows only
// while it loads. Counts waits until the judge can see it.
const stageEl = ref<HTMLElement>()
const barEl = ref<HTMLElement>()
const stage = ref<{ width: number, height: number } | null>(null)
const imgReady = ref(false)
const imgFailed = ref(false)
const imgTry = ref(0)
// The shape of the file as loaded. It wins over the record's, which can be wrong.
const loadedRatio = ref<number | null>(null)
function fitPhoto() {
  const el = stageEl.value
  if (!el || !photo.value) return
  const top = el.getBoundingClientRect().top + window.scrollY
  const bar = barEl.value?.offsetHeight ?? 76
  stage.value = { width: el.clientWidth, height: Math.max(200, Math.floor(window.innerHeight - bar - top - 12)) }
}
const stageStyle = computed(() => ({ height: stage.value ? `${stage.value.height}px` : '40dvh' }))
// The photo inside the stage, as large as it fits whole.
const photoStyle = computed(() => {
  const s = stage.value
  const p = photo.value
  if (!s || !p) return { width: '100%', height: '100%' }
  const ratio = loadedRatio.value ?? (p.width && p.height ? p.width / p.height : 4 / 3)
  const w = Math.floor(Math.min(s.width, s.height * ratio))
  return { width: `${w}px`, height: `${Math.min(s.height, Math.round(w / ratio))}px` }
})
watch(() => photo.value?.largeUrl, () => {
  imgReady.value = false
  imgFailed.value = false
  loadedRatio.value = null
})
function onImgLoad(e: Event) {
  const img = e.target as HTMLImageElement
  if (img.naturalWidth && img.naturalHeight) loadedRatio.value = img.naturalWidth / img.naturalHeight
  imgReady.value = true
}
function retryPhoto() {
  imgFailed.value = false
  imgTry.value++
  refresh()
}
// The next photo loads in the background, so it shows at once.
watch(() => data.value?.photos[1]?.largeUrl, (url) => {
  if (url && !grid.value) new Image().src = url
})
watch(() => [photo.value?.id, photo.value?.challengeId, photo.value?.label, needs.value, spot.value?.id], () => nextTick(fitPhoto))
// The line above the buttons makes the bottom bar taller (two lines for a long one), so the
// stage makes room for it. It doesn't grow back when the line goes, so the photo never jumps
// while the judge looks at it.
watch(() => last.value?.text, t => t && nextTick(fitPhoto))
onMounted(() => {
  window.addEventListener('resize', fitPhoto)
  nextTick(fitPhoto)
})
onBeforeUnmount(() => {
  window.removeEventListener('resize', fitPhoto)
  clearTimeout(lastTimer)
  tileWatcher?.disconnect()
})

// The photo view's shape for a queue photo.
function toViewer(p: QueuePhoto): ViewerPhoto {
  return {
    id: p.id,
    groupId: p.groupId,
    challengeId: p.challengeId,
    label: p.label,
    uploadedAt: p.uploadedAt,
    uploaderName: p.uploaderName,
    likes: p.likes,
    liked: false,
    mine: false,
    rejectReason: p.verdict === 'rejected' ? (p.rejectReason ?? 'Doesn\'t match the challenge') : null,
    unchecked: p.verdict === 'pending',
    width: p.width,
    height: p.height,
    thumbUrl: p.thumbUrl,
    largeUrl: p.largeUrl,
  }
}

// A decision made in the photo view, which has saved it already: the bar says it as if it were
// made with the buttons here, with the same Undo. `was` is the photo as the view opened on it;
// `putBack` restores what this page shows when Undo is tapped.
type Was = Pick<ViewerPhoto, 'challengeId' | 'label' | 'rejectReason' | 'unchecked'>
const was = (p: Was): Was => ({ challengeId: p.challengeId, label: p.label, rejectReason: p.rejectReason, unchecked: p.unchecked })
const isMoved = (v: Was, before: Was) => v.challengeId !== before.challengeId || normaliseLabel(v.label ?? '') !== normaliseLabel(before.label ?? '')
function sayDecided(v: ViewerPhoto, before: Was, putBack: () => void, undone?: string) {
  const moved = isMoved(v, before)
  if (!moved && v.rejectReason === before.rejectReason && v.unchecked === before.unchecked) return
  const text = v.rejectReason ? 'Doesn\'t count' : moved ? (v.unchecked ? 'Moved' : 'Moved and counted') : v.challengeId ? 'Counts' : 'Looks fine'
  showLast({
    id: v.id,
    text: `${text}: ${identity(v)}`,
    undo: async () => {
      await patch(v.id, moved ? { action: 'challenge', challengeId: before.challengeId, label: before.label ?? '' } : { action: 'undo' })
      putBack()
    },
    undone,
  })
}
// Hidden or deleted from the photo view's ⋯: only hiding can be undone. (Unhidden comes only
// from Hidden photos.)
function sayRemoved(v: ViewerPhoto, how: Removal) {
  const text = { hidden: 'Hidden', deleted: 'Deleted', inappropriate: 'Deleted as inappropriate', blocked: 'Deleted as inappropriate', unhidden: 'Back in the gallery' }[how]
  showLast({
    id: v.id,
    text: `${text}: ${identity(v)}${how === 'blocked' ? '. Phone blocked' : ''}`,
    undo: how === 'hidden' ? () => patch(v.id, { action: 'restore' }) : undefined,
  })
}

// Full screen: the photo view on this one photo, with the judge's buttons. When it closes, the
// queue catches up with whatever the judge did there.
const zoom = ref<{ queued: QueuePhoto, shown: ViewerPhoto, before: Was, removed: Removal | null } | null>(null)
const zoomIndex = ref<number | null>(null)
const zoomPhotos = computed(() => zoom.value ? [zoom.value.shown] : [])
function openZoom() {
  const p = photo.value
  if (!p || !imgReady.value) return
  const shown = toViewer(p)
  zoom.value = { queued: p, shown, before: was(shown), removed: null }
  zoomIndex.value = 0
}
function onZoomRemoved(_id: string, how?: Removal) {
  if (zoom.value) zoom.value.removed = how ?? 'deleted'
}
watch(zoomIndex, (i) => {
  const z = zoom.value
  if (i !== null || !z) return
  zoom.value = null
  const { queued: p, shown: v } = z
  if (z.removed) {
    drop(p)
    sayRemoved(v, z.removed)
    return topUp()
  }
  if (v.unchecked && !v.rejectReason) {
    // Moved but not judged: it stays first, at its new place.
    if (isMoved(v, z.before)) Object.assign(p, { challengeId: v.challengeId, label: v.label })
    return
  }
  drop(p)
  // Undo brings it back to the front of the queue by itself.
  sayDecided(v, z.before, () => {})
  topUp()
})

// ---------- The grid ----------

// A batch of unchecked photos, frozen when the grid opens or the judge asks for more, so nothing
// moves while the judge looks. Photos arriving later wait behind the "new photos" pill. One
// section per challenge with two or more photos, and per race (Animals spotted, Flower colours)
// even with one, races first; other challenges with one share an untitled section, each tile
// captioned with its challenge; just-a-photos come last.
interface GridSection { key: string, title: string, needs: string, single: boolean, photos: ViewerPhoto[] }
const batch = ref<{ sections: GridSection[], photos: ViewerPhoto[] } | null>(null)
let refreeze = grid.value
function freeze() {
  const live = data.value
  if (!live) return
  refreeze = false
  // In the challenge lists' order (LIST_ORDER): the two races (Animals spotted, Flower
  // colours) first, as most photos are theirs and their names need checking, each in its own
  // section even with one photo; then the rest, in the order of the challenge list.
  const kind = (c: { type: string }) => LIST_ORDER.indexOf(c.type)
  const order = new Map([...live.challenges].sort((a, b) => kind(a) - kind(b)).map((c, i) => [c.id, i]))
  const rank = (id: string | null) => id === null ? Number.POSITIVE_INFINITY : order.get(id) ?? 0
  const sorted = [...live.photos].sort((a, b) => rank(a.challengeId) - rank(b.challengeId) || a.uploadedAt - b.uploadedAt)
  const byChallenge = new Map<string | null, ViewerPhoto[]>()
  for (const p of sorted) byChallenge.set(p.challengeId, [...(byChallenge.get(p.challengeId) ?? []), toViewer(p)])
  const sections: GridSection[] = []
  const singles: ViewerPhoto[] = []
  let justPhotos: ViewerPhoto[] = []
  for (const [id, list] of byChallenge) {
    if (list.length === 1 && !challengeOf(id)?.awardKind) {
      singles.push(list[0]!)
    }
    else if (id === null) {
      justPhotos = list
    }
    else {
      const c = challengeOf(id)
      sections.push({ key: id, title: c?.title ?? 'Just a photo', needs: c?.whoInShot ?? '', single: false, photos: list })
    }
  }
  if (singles.length) sections.push({ key: 'one-each', title: '', needs: '', single: true, photos: singles })
  if (justPhotos.length) sections.push({ key: 'just-a-photo', title: 'Just a photo', needs: '', single: false, photos: justPhotos })
  batch.value = { sections, photos: sections.flatMap(s => s.photos) }
}
watch(data, (live) => {
  if (!grid.value || !live) return
  const b = batch.value
  if (refreeze || !b || !b.photos.length) return freeze()
  // Another judge may have checked some of the batch since: they dim, and nothing moves.
  const waiting = new Set(live.photos.map(p => p.id))
  for (const p of b.photos) {
    if (p.unchecked && !waiting.has(p.id)) p.unchecked = false
  }
  // Every photo in the batch is done and nothing new has come: the batch is finished.
  if (!live.photos.length && !b.photos.some(p => p.unchecked)) freeze()
}, { immediate: true })
const fresh = computed(() => {
  if (!grid.value || !batch.value || !data.value) return 0
  const have = new Set(batch.value.photos.map(p => p.id))
  return data.value.photos.filter(p => !have.has(p.id)).length
})
function takeFresh() {
  freeze()
  window.scrollTo({ top: 0, behavior: 'smooth' })
}
// A heading says what a section's photos are for. The one-photo challenges have none: each
// tile's caption says it.
const showHeading = (s: GridSection) => !s.single

// "Whole group", "2+ of you": who must be in it, short enough for a tile.
function shortNeeds(who: string | null | undefined) {
  const m = who?.match(/^at least (one|\d+) of you$/i)
  return m ? `${m[1]!.toLowerCase() === 'one' ? 1 : m[1]}+ of you` : who ?? ''
}
const isRace = (p: ViewerPhoto) => !!challengeOf(p.challengeId)?.awardKind
function tileNote(p: ViewerPhoto) {
  const c = challengeOf(p.challengeId)
  return c?.awardKind ? raceName(c) : shortNeeds(c?.whoInShot)
}
function tileLabel(p: ViewerPhoto) {
  const state = p.rejectReason ? ', doesn\'t count' : !p.unchecked ? ', checked' : ''
  return `${groupName(p.groupId)}, ${what(p)}${isRace(p) ? `, ${tileNote(p).toLowerCase()} entry` : ''}${state}`
}
// A race entry's caption is its animal or colour after a paw or a flower, which says which race
// in a tile's width: "Black swan", "Yellow".
const raceIcon = (p: ViewerPhoto) => challengeOf(p.challengeId)?.awardKind === 'colour' ? FlowerIcon : PawPrintIcon
const caption = (p: ViewerPhoto) => isRace(p) && p.label ? capitalise(normaliseLabel(p.label)) : what(p)

// Each tile shows the whole photo at its own shape, not a square crop: in a 3:4 cell, standing
// on the line its caption hangs from, so captions in a row line up. The shape comes from the
// record until the thumbnail has loaded, then from the thumbnail.
const thumbRatio = reactive(new Map<string, number>())
const CELL = 3 / 4
function tileStyle(p: ViewerPhoto) {
  const ratio = thumbRatio.get(p.id) ?? (p.width && p.height ? p.width / p.height : CELL)
  // Wider than the cell: its full width. Taller: the cell's full height, so a share of its width.
  return { aspectRatio: ratio, width: `${Math.min(1, ratio / CELL) * 100}%` }
}

// Which photos the judge has actually had in front of them: a tile counts once its thumbnail
// has loaded while most of it was on screen above the bottom bar, or once it was opened full
// screen. "Mark checked" marks only those; one scrolled past unseen, or whose thumbnail didn't
// load, waits for the next batch.
const seen = reactive(new Set<string>())
const brokenThumbs = reactive(new Set<string>())
const thumbLoaded = new Set<string>()
const onScreen = new Set<string>()
function noteSeen(id: string) {
  if (thumbLoaded.has(id) && onScreen.has(id)) seen.add(id)
}
function onThumbLoad(id: string, e: Event) {
  const img = e.target as HTMLImageElement
  if (img.naturalWidth && img.naturalHeight) thumbRatio.set(id, img.naturalWidth / img.naturalHeight)
  thumbLoaded.add(id)
  noteSeen(id)
}
let tileWatcher: IntersectionObserver | null = null
const watchedTiles = new WeakSet<Element>()
function watchTile(el: Element | ComponentPublicInstance | null) {
  if (!(el instanceof HTMLElement) || watchedTiles.has(el)) return
  tileWatcher ??= new IntersectionObserver((entries) => {
    for (const e of entries) {
      const id = (e.target as HTMLElement).dataset.photo
      if (!id) continue
      if (e.isIntersecting) {
        onScreen.add(id)
        noteSeen(id)
      }
      else {
        onScreen.delete(id)
      }
    }
  }, { rootMargin: '0px 0px -100px 0px', threshold: 0.6 })
  watchedTiles.add(el)
  tileWatcher.observe(el)
}

// Tapping a tile opens the photo view with the judge's buttons; a decision there closes it, the
// photo dims here, and the bar says what was decided, with Undo, as in one at a time.
const viewIndex = ref<number | null>(null)
let beforeView = new Map<string, Was>()
function openTile(p: ViewerPhoto) {
  const b = batch.value
  const i = b?.photos.findIndex(x => x.id === p.id) ?? -1
  if (!b || i < 0) return
  seen.add(p.id)
  // The judge can swipe to any photo in the batch before deciding.
  beforeView = new Map(b.photos.map(x => [x.id, was(x)]))
  viewIndex.value = i
}
watch(viewIndex, (i, before) => {
  if (i === null && before !== null) refresh()
})
function onGridDecided(id: string) {
  viewIndex.value = null
  const p = batch.value?.photos.find(x => x.id === id)
  const before = beforeView.get(id)
  if (p && before) sayDecided(p, before, () => Object.assign(p, before), 'Undone, back to check')
}
function onGridRemoved(id: string, how?: Removal) {
  const b = batch.value
  if (!b) return
  const gone = b.photos.find(p => p.id === id)
  if (gone && how) sayRemoved(gone, how)
  b.photos = b.photos.filter(p => p.id !== id)
  for (const s of b.sections) s.photos = s.photos.filter(p => p.id !== id)
  b.sections = b.sections.filter(s => s.photos.length)
}

// After looking over the batch and fixing the wrong ones: the rest of what was seen is marked
// checked.
const stillUnchecked = computed(() => batch.value?.photos.filter(p => p.unchecked) ?? [])
const toMark = computed(() => stillUnchecked.value.filter(p => seen.has(p.id)))
const nPhotos = (n: number) => `${n} ${n === 1 ? 'photo' : 'photos'}`
async function markChecked() {
  const todo = toMark.value
  if (!todo.length || busy.value) return
  busy.value = true
  showLast(null)
  const results = await Promise.allSettled(todo.map(p => patch(p.id, { action: 'pass' }).then(() => p.id)))
  busy.value = false
  const done = results.flatMap(r => r.status === 'fulfilled' ? [r.value] : [])
  // Already checked by another judge isn't a failure.
  const failed = results.filter(r => r.status === 'rejected' && !isTaken(r.reason)).length
  todo.forEach((p, i) => {
    const r = results[i]!
    if (r.status === 'fulfilled' || isTaken(r.reason)) p.unchecked = false
  })
  refreeze = true
  await refresh()
  // Nothing to say when another judge had checked them all.
  const text = [done.length ? `${nPhotos(done.length)} checked` : '', failed ? `${failed} couldn't be marked. Try again` : ''].filter(Boolean).join('. ')
  if (!text) return showLast(null)
  showLast({
    id: 'batch',
    text,
    error: !!failed && !done.length,
    undo: done.length
      ? async () => {
        await Promise.allSettled(done.map(id => patch(id, { action: 'undo' })))
        refreeze = true
      }
      : undefined,
    undone: 'Undone, back to check',
  })
}

// ---------- Both ----------

// Nothing to check: no photos waiting, or a grid batch with none in it.
const nothingLeft = computed(() => grid.value ? batch.value?.photos.length === 0 : !!data.value && !data.value.photos.length)
// Unless one group is picked: the filter stays, so the judge can go back to all of them.
const allCaughtUp = computed(() => nothingLeft.value && totalRemaining.value === 0 && !group.value)
const showError = computed(() => !!error.value && (grid.value ? !batch.value?.photos.length : !data.value?.photos.length))
function reload() {
  if (grid.value) refreeze = true
  refresh()
}
</script>

<template>
  <!-- Room at the foot for the fixed bar: the grid scrolls under it; one photo's stage already
       stops above it, so the page doesn't scroll there. -->
  <main class="mx-auto min-h-dvh max-w-lg px-4 pt-2" :class="grid ? 'pb-28' : 'pb-20'">
    <h1 class="sr-only">
      Judge photos
    </h1>

    <!-- One row: back, which group, and one at a time or a grid. -->
    <div class="flex items-center">
      <!-- The tap area runs from the screen's edge, all of it on screen; the chevron is nudged
           inside it so its point sits on the content edge. -->
      <Button as-child variant="ghost" size="icon" class="-ml-4 shrink-0">
        <NuxtLink to="/c" aria-label="Back">
          <ChevronLeftIcon class="size-6 -translate-x-0.5" />
        </NuxtLink>
      </Button>
      <!-- With nothing left anywhere, there's nothing to filter: the page's name instead. Either
           starts where other committee titles do, 8 px after the back button. -->
      <div class="ml-2 min-w-0 flex-1">
        <SelectSheet v-if="!allCaughtUp" v-model="group" title="Check photos from" :sections="groupFilter" />
        <p v-else class="text-2xl font-bold leading-tight" aria-hidden="true">
          Judge photos
        </p>
      </div>
      <div v-if="!nothingLeft" role="group" aria-label="View" class="ml-2 flex shrink-0 rounded-lg bg-muted">
        <Button
          v-for="v in VIEWS" :key="v.label" variant="ghost" class="group/seg h-11 rounded-lg border-0 p-[3px] hover:bg-transparent"
          :aria-pressed="grid === v.grid" @click="grid = v.grid"
        >
          <span class="flex h-full items-center rounded-md px-2.5 text-muted-foreground group-aria-pressed/seg:bg-background group-aria-pressed/seg:text-foreground group-aria-pressed/seg:shadow-sm">
            {{ v.label }}
          </span>
        </Button>
      </div>
    </div>

    <div v-if="showError" class="mt-10 flex flex-col items-center gap-3 text-center">
      <p class="text-base">
        Photos couldn't load.
      </p>
      <Button variant="outline" @click="reload">
        Try again
      </Button>
    </div>
    <div v-else-if="nothingLeft" class="mt-10 flex flex-col items-center gap-3 text-center">
      <PartyPopperIcon class="size-10 text-primary" />
      <template v-if="group && totalRemaining > 0">
        <p class="text-xl font-bold">
          {{ shortGroup(group) }} checked
        </p>
        <Button @click="group = ''">
          Check the other {{ totalRemaining }}
        </Button>
      </template>
      <template v-else>
        <p class="text-xl font-bold">
          All caught up
        </p>
        <Button as-child variant="link" class="h-11 gap-1 px-2 text-base">
          <NuxtLink to="/c/animals">
            Animal names <ChevronRightIcon class="size-5" aria-hidden="true" />
          </NuxtLink>
        </Button>
      </template>
    </div>

    <!-- The grid: tap a wrong one to fix it, then mark the rest checked. -->
    <template v-else-if="grid">
      <div v-if="!batch" class="mt-5 grid grid-cols-2 gap-x-3 gap-y-4" aria-busy="true">
        <Skeleton v-for="i in 4" :key="i" class="aspect-[3/4] w-full rounded-xl" />
      </div>
      <template v-else>
        <!-- New arrivals wait here, so nothing appears above where the judge is looking. -->
        <div v-if="fresh" class="sticky top-2 z-30 flex h-0 justify-center">
          <Button size="sm" class="mt-3 rounded-full shadow-md" @click="takeFresh">
            <ArrowUpIcon /> {{ fresh }} new {{ fresh === 1 ? 'photo' : 'photos' }}
          </Button>
        </div>
        <!-- The untitled one-photo section is set off from the section above by a line. -->
        <section v-for="(s, i) in batch.sections" :key="s.key" class="mt-5" :class="!showHeading(s) && i > 0 && 'border-t pt-4'">
          <template v-if="showHeading(s)">
            <h2 class="text-lg font-bold leading-tight">
              {{ s.title }}
            </h2>
            <p v-if="s.needs" class="text-base text-muted-foreground">
              {{ s.needs }}
            </p>
          </template>
          <!-- Two columns, so each photo is big enough to judge. -->
          <ul class="grid grid-cols-2 gap-x-3 gap-y-4" :class="showHeading(s) && 'mt-2'">
            <li v-for="p in s.photos" :key="p.id" class="min-w-0">
              <button :ref="watchTile" type="button" :data-photo="p.id" class="flex w-full" :aria-label="tileLabel(p)" @click="openTile(p)">
                <span class="flex aspect-[3/4] w-full items-end justify-center">
                  <!-- The photo's own box, so its corners are rounded and the badges sit inside it. -->
                  <span class="relative overflow-hidden rounded-xl" :class="!thumbRatio.has(p.id) && 'bg-muted'" :style="tileStyle(p)">
                    <img
                      :src="p.thumbUrl" alt="" loading="lazy" class="size-full object-cover" :class="!p.unchecked && 'opacity-40'"
                      @load="onThumbLoad(p.id, $event)" @error="brokenThumbs.add(p.id)"
                    >
                    <span v-if="brokenThumbs.has(p.id)" class="absolute inset-0 grid place-items-center text-muted-foreground"><ImageOffIcon class="size-6" /></span>
                    <span v-if="!group" class="absolute left-1 top-1 max-w-[calc(100%-0.5rem)] truncate rounded-full bg-black/60 px-2 text-base font-semibold leading-7 text-white">{{ shortGroup(p.groupId) }}</span>
                    <!-- Checked shows as a tick, not only as dimming. -->
                    <span v-if="p.rejectReason" class="absolute bottom-1 right-1 flex size-7 items-center justify-center rounded-full bg-destructive text-white"><XIcon class="size-4" /></span>
                    <span v-else-if="!p.unchecked" class="absolute bottom-1 right-1 flex size-7 items-center justify-center rounded-full bg-primary text-primary-foreground"><CheckIcon class="size-4" :stroke-width="3" /></span>
                  </span>
                </span>
              </button>
              <!-- Among the one-photo challenges every tile says what it's for; in a race, which animal or
                   colour. Captions wrap rather than cut off. -->
              <template v-if="s.single || isRace(p)">
                <p class="mt-1.5 flex gap-1.5 text-base font-medium leading-snug">
                  <component :is="raceIcon(p)" v-if="isRace(p)" class="mt-[3px] size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <span class="min-w-0 break-words">{{ caption(p) }}</span>
                </p>
                <p v-if="s.single && !isRace(p) && tileNote(p)" class="text-base leading-snug text-muted-foreground">
                  {{ tileNote(p) }}
                </p>
              </template>
            </li>
          </ul>
        </section>
      </template>
    </template>

    <Skeleton v-else-if="!data" class="mt-3 aspect-[4/3] w-full rounded-2xl" />

    <article v-else-if="photo" class="mt-3">
      <!-- The pencil and ⋯ sit on the title's line; pulled right so the painted dots, not the tap
           area, end on the content edge (the icon sits 12 px inside its button, the dots 3 px
           inside the icon). -->
      <div class="flex items-start gap-2">
        <h2 class="min-w-0 flex-1 text-xl font-bold leading-tight">
          {{ what(photo) }}
        </h2>
        <div class="-my-2.5 -mr-[15px] flex shrink-0">
          <Button variant="ghost" size="icon" :aria-label="photo.challengeId ? 'Change challenge' : 'Pick a challenge'" :disabled="busy" @click="openSheet('editing')">
            <PencilIcon class="size-5" />
          </Button>
          <Button variant="ghost" size="icon" aria-label="More" :disabled="busy" @click="openSheet('moreOpen')">
            <EllipsisIcon class="size-5" />
          </Button>
        </div>
      </div>
      <CreditLine :parts="credit(photo)" class="text-base text-muted-foreground" />
      <p v-if="needs" class="text-base">
        {{ needs }}
      </p>
      <!-- The likely fix for an animal that is also a Spot it challenge, with its points. -->
      <Button
        v-if="spot" variant="outline" size="sm" class="mt-2 rounded-full pr-1.5" :disabled="busy || !imgReady"
        @click="moveAndCount({ challengeId: spot.id, label: null })"
      >
        Move to {{ spot.title }} <QuestPointsPill :points="spot.points" />
      </Button>

      <div ref="stageEl" class="mt-2">
        <div v-if="imgFailed" class="flex flex-col items-center justify-center gap-2 rounded-2xl bg-muted p-4 text-center" :style="stageStyle" role="alert">
          <ImageOffIcon class="size-8 text-muted-foreground" aria-hidden="true" />
          <p class="text-base">
            Photo didn't load.
          </p>
          <Button variant="outline" @click="retryPhoto">
            Try again
          </Button>
        </div>
        <button
          v-else type="button" class="flex w-full items-center justify-center" :style="stageStyle"
          aria-label="Enlarge photo" :disabled="!imgReady" @click="openZoom"
        >
          <!-- The photo's own box: its corners are rounded, and the enlarge badge sits in its
               corner whatever its shape. Grey only while it loads. -->
          <span class="relative block overflow-hidden rounded-2xl" :class="!imgReady && 'animate-pulse bg-muted'" :style="photoStyle">
            <img
              :key="`${photo.id}-${imgTry}`" :src="photo.largeUrl" :alt="`Photo from ${groupName(photo.groupId)}`"
              class="size-full object-cover transition-opacity duration-150" :class="!imgReady && 'opacity-0'"
              @load="onImgLoad" @error="imgFailed = true"
            >
            <span v-if="imgReady" class="absolute bottom-2 right-2 flex size-10 items-center justify-center rounded-full bg-black/60 text-white"><Maximize2Icon class="size-5" /></span>
          </span>
        </button>
      </div>
    </article>

    <!-- Fixed at the bottom: the decision buttons, or the grid's "Mark checked", with the line
         saying what just happened above them. -->
    <div v-if="photo || last || (grid && stillUnchecked.length)" ref="barEl" class="fixed inset-x-0 bottom-0 z-40 border-t bg-background pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-4px_12px_rgb(0_0_0/0.06)]">
      <div class="mx-auto max-w-lg px-4">
        <div v-if="last" class="flex min-h-11 items-center justify-between gap-3" :role="last.error ? 'alert' : 'status'">
          <p class="flex min-w-0 items-center gap-2 text-base leading-snug" :class="last.error && 'font-semibold text-red-800'">
            {{ last.text }}
          </p>
          <Button v-if="last.undo" variant="outline" class="shrink-0" :disabled="busy" @click="undoLast">
            Undo
          </Button>
        </div>
        <Button v-if="grid && stillUnchecked.length" size="lg" class="mt-1 w-full" :disabled="busy || !toMark.length" @click="markChecked">
          <CheckIcon /> {{ toMark.length ? `Mark ${toMark.length} checked` : 'Mark checked' }}
        </Button>
        <!-- A just-a-photo scores nothing, so there's no verdict: the judge only confirms it's fine. -->
        <div v-else-if="photo && !photo.challengeId" class="mt-1 grid">
          <Button size="lg" :disabled="busy || !imgReady" @click="act('pass')">
            <CheckIcon /> Looks fine
          </Button>
        </div>
        <CommitteeVerdictButtons v-else-if="photo" class="mt-1" :disabled="busy || !imgReady" @counts="act('pass')" @reject="openSheet('rejecting')" />
      </div>
    </div>

    <template v-if="data">
      <PickChallengeSheet
        v-model:open="editing" :challenges="data.challenges" :challenge-id="held?.challengeId ?? null" :label="held?.label ?? null" :thumb-url="held?.thumbUrl"
        :allow-none="!!held?.challengeId" :busy="busy" quick-names @pick="c => moveAndCount(c, held)"
      />
      <CommitteeRejectSheet
        v-model:open="rejecting" :reasons="reasons" :busy="busy" :thumb-url="held?.thumbUrl" :identity="held ? identity(held) : ''"
        @reject="r => act('reject', { reason: r }, held)"
      />
      <CommitteeMoreSheet
        v-model:open="moreOpen" :busy="busy" :thumb-url="held?.thumbUrl" :identity="held ? identity(held) : ''"
        @hide="fromMore(() => act('remove', {}, held))" @inappropriate="fromMore(() => { confirmInappropriate = true })" @delete="fromMore(() => { confirmDelete = true })"
      />
      <CommitteeInappropriateDialog
        v-model:open="confirmInappropriate" :group-name="held ? groupName(held.groupId) : ''" :thumb-url="held?.thumbUrl" :identity="held ? identity(held) : ''"
        @confirm="block => act('inappropriate', { block }, held)"
      />
      <CommitteeDeleteDialog
        v-model:open="confirmDelete" :thumb-url="held?.thumbUrl" :identity="held ? identity(held) : ''"
        @confirm="act('delete', {}, held)"
      />
    </template>

    <!-- Full screen, one photo: the judge's buttons pinned at the bottom, no swiping, and the
         same "Move to Hornbill" chip as here. -->
    <PhotoViewer
      v-if="!grid" v-model:index="zoomIndex" :photos="zoomPhotos" :groups="data?.groups ?? []" :challenges="data?.challenges ?? []" :time-style="timeStyle"
      committee review single :spot-for="spotFor" @decided="zoomIndex = null" @removed="onZoomRemoved"
    />
    <!-- From the grid: swipe through the batch; a decision closes it, back to the grid. -->
    <PhotoViewer
      v-else v-model:index="viewIndex" :photos="batch?.photos ?? []" :groups="data?.groups ?? []" :challenges="data?.challenges ?? []" :time-style="timeStyle"
      committee review :spot-for="spotFor" @decided="onGridDecided" @removed="onGridRemoved"
    />
  </main>
</template>
