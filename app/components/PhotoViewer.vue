<script setup lang="ts">
import type { BatchAnswer, ChallengeOption } from '~/types/api'
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { toast } from 'vue-sonner'
import { CheckIcon, EllipsisIcon, HeartIcon, Loader2Icon, PencilIcon, Trash2Icon, XIcon } from '@lucide/vue'
import { formatPhotoTime, type PhotoTimeStyle } from '#shared/utils/photoTime'
import { capitalise, photoName } from '~/utils/photoName'
import { spotAnimals, spotItFor } from '~/utils/animalNames'

// One photo at a time, full screen, on the same white as the bars so the photo floats. The top
// bar holds the X and, opposite it, what can be done to the photo: the phone that sent it can
// change its challenge or remove it; the committee gets the judge's pencil and ⋯. The bottom
// holds only what it's for, who sent it and, for the committee, the verdict; the photo sits
// centred between the two. Drag sideways and the next photo comes with the finger; drag down,
// tap X or press Back to close; pinch to zoom, then drag to look around; double-tap or the heart
// to like. Changes are made to the objects in `photos`.
export interface ViewerPhoto {
  id: string
  groupId: string
  challengeId: string | null
  label: string | null
  uploadedAt: number
  uploaderName: string | null
  likes: number
  liked: boolean
  mine: boolean
  rejectReason: string | null
  unchecked: boolean
  width: number | null
  height: number | null
  thumbUrl: string
  largeUrl: string
}
// How a judge removed a photo: hidden (can be undone), deleted, or deleted as inappropriate,
// with or without blocking the phone. From the committee's Hidden photos: unhidden (back in the
// gallery) or deleted for good.
export type Removal = 'hidden' | 'deleted' | 'inappropriate' | 'blocked' | 'unhidden'
type Placed = { challengeId: string | null, label: string | null }
type Spot = { id: string, title: string, points?: number }

const props = defineProps<{
  photos: ViewerPhoto[]
  groups: { id: string, name: string }[]
  challenges: (ChallengeOption & { points?: number, whoInShot?: string | null, hint?: string | null, animal?: string | null })[]
  committee?: boolean
  // How the photo's time reads (Manage › Controls): "10:42 am", "Sat 10:42 am" or "14 Nov, 10:42 am".
  timeStyle: PhotoTimeStyle
  // Judging: no heart, the judge queue's own buttons, and `decided` after each decision so the
  // caller can move on.
  review?: boolean
  // One photo only: no swiping.
  single?: boolean
  // What this phone's group has already, so the challenge list can say what won't add.
  done?: string[]
  animalsFound?: string[]
  coloursFound?: string[]
  // Why this phone can't move its photos just now ("Uploads are closed"): said in place of
  // Change challenge, which the server would refuse. Removing stays.
  moveBlocked?: string | null
  // The Spot it challenge an animal entry was likely meant for ("Hornbil" → Hornbill), from the
  // judging page. In review it offers "Move to Hornbill +50", as the queue does.
  spotFor?: (p: Placed) => Spot | null
  // While picking (in the gallery, to save; in Hidden photos, to unhide or delete): a tick in
  // the top bar picks or drops the photo shown (`tick`), in place of its edit actions;
  // `tickLocked` while a save or the committee's action holds the ticks.
  ticked?: (id: string) => boolean
  tickLocked?: boolean
  // The committee's Hidden photos (out of the gallery, files kept): no heart, and under the
  // photo Unhide and Delete for good (which asks first), unless picking.
  hidden?: boolean
}>()
const index = defineModel<number | null>('index', { required: true })
// `more`: nearly at the end of `photos`, so the caller can load the next page. `removed` says how
// a judge removed it, so a judging page can say so with its own Undo.
// `purging`: a Delete for good from Hidden photos is on its way, so the page holds the photo
// until it leaves the list (`removed`), even if the answer is lost.
const emit = defineEmits<{ removed: [id: string, how?: Removal], changed: [], decided: [id: string], more: [], tick: [id: string], purging: [id: string] }>()

const photo = computed(() => index.value === null ? null : props.photos[index.value] ?? null)
const challengeOf = (id: string | null) => props.challenges.find(c => c.id === id) ?? null
const challenge = computed(() => challengeOf(photo.value?.challengeId ?? null))
const groupName = (id: string) => props.groups.find(g => g.id === id)?.name ?? ''
// "Hornbill", "Swan" (an animal for the race), "Yellow flower", or "Just a photo".
const whatOf = (p: Placed) => photoName(challengeOf(p.challengeId), p.label)
const what = computed(() => photo.value ? whatOf(photo.value) : '')
// The challenge's points beside its title, while the photo counts.
const points = computed(() => photo.value && !photo.value.rejectReason ? challenge.value?.points ?? 0 : 0)
// "Group 6" for everyone; "G6" for the committee, as in the judge's queue. An example group like
// the recce team keeps its name.
function shortGroup(id: string) {
  const name = groupName(id)
  return props.committee ? name.replace(/^Group (\d+).*/, 'G$1') : name.replace(/ \(.+\)$/, '')
}

// An animal entry that's also a Spot it challenge ("Hornbill", "Black swan" for Swan, or one
// letter off, "Hornbil"), when the judging page hasn't said: the same test as its queue.
const spots = computed(() => spotAnimals(props.challenges))
function spotOf(p: Placed): Spot | null {
  if (props.spotFor) return props.spotFor(p)
  if (challengeOf(p.challengeId)?.awardKind !== 'animal' || !p.label) return null
  return spotItFor(p.label, spots.value)
}
// In review, the likely fix for this photo, one tap away.
const spot = computed(() => props.review && photo.value ? spotOf(photo.value) : null)

// "Group 6 · 10:16 am · Dev". A race entry leads with its race, so an animal for the race isn't
// mistaken for the Spot it challenge with the same name. The committee only needs that where the
// two could be confused: "Yellow flower" can't be. Outside judging, the committee also sees
// whether a judge has looked at a challenge photo yet, quietly at the end; a just a photo says it
// with its "Looks fine" button.
const credit = computed(() => {
  const p = photo.value
  const c = challenge.value
  if (!p) return []
  const race = c?.awardKind && (!props.committee || spotOf(p)) ? c.title : ''
  return [race, shortGroup(p.groupId), formatPhotoTime(p.uploadedAt, props.timeStyle), p.uploaderName, props.committee && !props.review && p.unchecked && c ? 'not checked' : '']
})
const needs = computed(() => {
  const c = challenge.value
  if (!c) return ''
  return [c.whoInShot ?? '', c.type !== 'award' && hintAddsSomething(c) ? c.hint ?? '' : ''].filter(Boolean).join('. ')
})
// "G3 · Lily", for the judge's sheets.
const identity = computed(() => {
  const p = photo.value
  if (!p) return ''
  return `${groupName(p.groupId).replace(/^Group (\d+).*/, 'G$1')} · ${what.value}`
})
const canSwipe = computed(() => !props.single && props.photos.length > 1)
// For screen readers, which can't swipe the photo: Previous and Next, and what came up.
const hasPrevious = computed(() => canSwipe.value && (index.value ?? 0) > 0)
const hasNext = computed(() => canSwipe.value && index.value !== null && index.value < props.photos.length - 1)
const announced = ref('')
watch(index, (i, before) => {
  if (i === null || before === null || before === undefined) announced.value = ''
  else announced.value = `${what.value}. ${credit.value.filter(Boolean).join(' · ')}`
}, { flush: 'post' })

// ---------- Opening and closing ----------

// Back closes the photo, as in any phone's photo app. Opening it adds a history entry at the same
// address, which the router sees as no change, and Back takes it off again. Closing it any other
// way takes the entry off first and closes once that's done, so a page that tidies its address
// when the photo closes does that on its own entry.
let entry = false
let closing = false
let fallback: ReturnType<typeof setTimeout> | undefined
function onPop() {
  if (!entry) return
  entry = false
  closing = false
  clearTimeout(fallback)
  window.removeEventListener('popstate', onPop)
  index.value = null
}
watch(() => index.value !== null, (open) => {
  if (open && !entry) {
    window.history.pushState({ ...window.history.state, photoViewer: true }, '')
    entry = true
    window.addEventListener('popstate', onPop)
  }
  else if (!open && entry) {
    // Closed by the page (a judge's decision, the last photo removed): take the entry off too.
    entry = false
    closing = false
    clearTimeout(fallback)
    window.removeEventListener('popstate', onPop)
    window.history.back()
  }
}, { immediate: true })
function close() {
  if (!entry) {
    index.value = null
    return
  }
  if (closing) return
  closing = true
  window.history.back()
  // Should the browser not report going back, close anyway.
  fallback = setTimeout(onPop, 500)
}
onBeforeUnmount(() => {
  window.removeEventListener('popstate', onPop)
  clearTimeout(fallback)
})
// Android's Back reaches the photo before any sheet under it (see useBackClose).
useBackClose(() => index.value !== null, close)

// ---------- Gestures ----------

// The track holds the photo either side, so a drag shows the next one coming in.
const stage = ref<HTMLElement | null>(null)
const offset = ref(0)
const drop = ref(0)
const animating = ref(false)
const slides = computed(() => {
  const i = index.value
  if (i === null) return []
  return [-1, 0, 1]
    .map(d => ({ d, p: canSwipe.value || d === 0 ? props.photos[i + d] : undefined }))
    .filter((s): s is { d: number, p: ViewerPhoto } => !!s.p)
})
// The slide lands on the photo it set off towards, found again by identity when it lands: one
// removed from the list meanwhile (Unhide, say) may have moved it.
function go(step: number) {
  const i = index.value
  if (i === null || animating.value) return
  const width = stage.value?.clientWidth ?? window.innerWidth
  const target = step !== 0 ? props.photos[i + step] : undefined
  animating.value = true
  offset.value = target ? -step * width : 0
  setTimeout(() => {
    animating.value = false
    offset.value = 0
    const at = target ? props.photos.indexOf(target) : -1
    if (index.value !== null && at >= 0) index.value = at
  }, 200)
}

// Zoom: scale and shift of the photo on show. It never shrinks below the screen, and never
// slides so far that blank space shows beside a photo bigger than the screen. A flat (2D)
// transform, so Safari redraws the photo sharp at each size instead of stretching a snapshot.
const zoom = reactive({ s: 1, x: 0, y: 0 })
const settling = ref(false)
// Each photo's shape from its file once loaded: some records have none, or an old one.
const ratios: Record<string, number> = {}
function setZoom(s: number, x: number, y: number) {
  const el = stage.value
  const p = photo.value
  let bx = 0
  let by = 0
  if (el && p) {
    const w = el.clientWidth
    const h = el.clientHeight
    const r = ratios[p.id] ?? (p.width && p.height ? p.width / p.height : w / h)
    const shownWidth = Math.min(w, h * r)
    bx = Math.max(0, (s * shownWidth - w) / 2)
    by = Math.max(0, (s * shownWidth / r - h) / 2)
  }
  zoom.s = s
  zoom.x = Math.min(bx, Math.max(-bx, x))
  zoom.y = Math.min(by, Math.max(-by, y))
}
function resetZoom(animate = false) {
  settling.value = animate
  zoom.s = 1
  zoom.x = 0
  zoom.y = 0
  if (animate) setTimeout(() => { settling.value = false }, 200)
}

// One finger drags to the next photo or down to close; two fingers zoom, and once zoomed one
// finger moves around the photo instead.
type Gesture =
  | { kind: 'swipe', x: number, y: number, axis: 'x' | 'y' | null }
  | { kind: 'pan', x: number, y: number, zx: number, zy: number }
  | { kind: 'pinch', d: number, mx: number, my: number, s: number, zx: number, zy: number }
let gesture: Gesture | null = null
function centre() {
  const r = stage.value!.getBoundingClientRect()
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
}
function begin(t: TouchList) {
  const a = t[0]
  const b = t[1]
  if (!a || animating.value) {
    gesture = null
  }
  else if (b) {
    // A drag under way gives way to the pinch.
    offset.value = 0
    drop.value = 0
    const c = centre()
    gesture = {
      kind: 'pinch',
      d: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY) || 1,
      mx: (a.clientX + b.clientX) / 2 - c.x,
      my: (a.clientY + b.clientY) / 2 - c.y,
      s: zoom.s,
      zx: zoom.x,
      zy: zoom.y,
    }
  }
  else if (zoom.s > 1) {
    gesture = { kind: 'pan', x: a.clientX, y: a.clientY, zx: zoom.x, zy: zoom.y }
  }
  else {
    gesture = { kind: 'swipe', x: a.clientX, y: a.clientY, axis: null }
  }
}
function onTouchStart(e: TouchEvent) {
  settling.value = false
  begin(e.touches)
}
function onTouchMove(e: TouchEvent) {
  const g = gesture
  const a = e.touches[0]
  if (!g || !a) return
  if (g.kind === 'pinch') {
    const b = e.touches[1]
    if (!b) return
    e.preventDefault()
    const c = centre()
    const s = Math.min(4, Math.max(1, g.s * Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY) / g.d))
    // The spot that was between the fingers stays between them.
    const k = s / g.s
    setZoom(s, (a.clientX + b.clientX) / 2 - c.x - k * (g.mx - g.zx), (a.clientY + b.clientY) / 2 - c.y - k * (g.my - g.zy))
  }
  else if (g.kind === 'pan') {
    e.preventDefault()
    setZoom(zoom.s, g.zx + a.clientX - g.x, g.zy + a.clientY - g.y)
  }
  else {
    const mx = a.clientX - g.x
    const my = a.clientY - g.y
    if (!g.axis && Math.hypot(mx, my) > 10) g.axis = Math.abs(mx) > Math.abs(my) && canSwipe.value ? 'x' : 'y'
    const i = index.value ?? 0
    // At either end the photo only gives a little, so it's clear there's no more.
    if (g.axis === 'x') offset.value = (mx < 0 && !props.photos[i + 1]) || (mx > 0 && !props.photos[i - 1]) ? mx * 0.25 : mx
    if (g.axis === 'y') drop.value = Math.max(0, my)
  }
}
function onTouchEnd(e: TouchEvent) {
  const g = gesture
  if (g?.kind === 'swipe') {
    if (g.axis === 'x') go(offset.value < -60 ? 1 : offset.value > 60 ? -1 : 0)
    else if (g.axis === 'y' && drop.value > 110) close()
    drop.value = 0
  }
  else if (g && zoom.s < 1.05) {
    resetZoom(true)
  }
  // A finger left on the photo after a pinch moves it around if it's still zoomed; otherwise it
  // does nothing until it lifts, so the end of a pinch never turns into a swipe.
  if (e.touches.length && zoom.s > 1) begin(e.touches)
  else gesture = null
}
// The phone took the touch away (a call, a system gesture): put everything back, act on nothing.
function onTouchCancel() {
  const g = gesture
  gesture = null
  if (g?.kind === 'swipe') {
    drop.value = 0
    if (offset.value) go(0)
  }
  else if (zoom.s < 1.05) {
    resetZoom(true)
  }
}
function onKey(e: KeyboardEvent) {
  if (index.value === null || !canSwipe.value) return
  if (e.key === 'ArrowRight') go(1)
  if (e.key === 'ArrowLeft') go(-1)
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))

// The large version of each photo: loaded, or failed with a Retry. Judging waits until it shows.
const large = reactive<Record<string, 'ok' | 'failed'>>({})
const tries = reactive<Record<string, number>>({})
function onLarge(p: ViewerPhoto, e: Event) {
  const img = e.target as HTMLImageElement
  if (img.naturalHeight) ratios[p.id] = img.naturalWidth / img.naturalHeight
  large[p.id] = 'ok'
}
function retry(p: ViewerPhoto) {
  delete large[p.id]
  tries[p.id] = (tries[p.id] ?? 0) + 1
}
const ready = computed(() => !!photo.value && large[photo.value.id] === 'ok')

// What went wrong, said inside the photo view over the foot of the photo, next to the details
// and buttons it's about (while the view is open the page's toasts can't be tapped), with Retry.
// A change that saves needs no message: the title or the verdict on screen changes. Tied to its
// photo, unless it's about one that's gone.
interface Said { id?: string, text: string, tone?: 'error', action?: { label: 'Retry' | 'Undo', run: () => void } }
const said = ref<Said | null>(null)
let saidTimer: ReturnType<typeof setTimeout> | undefined
function say(next: Said | null) {
  said.value = next
  clearTimeout(saidTimer)
  if (next) saidTimer = setTimeout(() => { said.value = null }, 8000)
}
const shownSaid = computed(() => said.value && (!said.value.id || said.value.id === photo.value?.id) ? said.value : null)
function runSaid() {
  const a = said.value?.action
  say(null)
  a?.run()
}
onBeforeUnmount(() => clearTimeout(saidTimer))
const why = (err: unknown) => errorText(err, 'Check your signal.')

// Likes: the heart, or a double-tap on the photo (which only ever likes). One that doesn't save
// says so here, by the heart.
const { burst, toggleLike } = useLikes((p, text) => say({ id: p.id, text: `Like not saved. ${text}`, tone: 'error', action: { label: 'Retry', run: () => toggleLike(p) } }))
let lastTap = 0
function onPhotoTap() {
  const p = photo.value
  if (!p || props.review || props.hidden) return
  const now = Date.now()
  if (now - lastTap < 320) toggleLike(p, true)
  lastTap = now
}

const busy = ref(false)
type Row = Record<string, any>
const ownSend = (id: string, body: Record<string, unknown>) => $fetch<Row | null>(`/api/photos/${id}`, { method: 'PATCH', body, headers: { 'x-device-id': deviceId() } })
const committeeSend = async (id: string, body: Record<string, unknown>) => (await $fetch<Row | null>(`/api/committee/photos/${id}`, { method: 'PATCH', body })) ?? {}
// Another judge checked it first: their verdict, as the server says it now is.
function takenBy(err: unknown) {
  const e = err as { statusCode?: number, data?: { data?: { verdict?: string, rejectReason?: string | null } } }
  return e?.statusCode === 409 && e.data?.data?.verdict ? e.data.data : null
}
const TAKEN = 'Another judge already checked that one'

// The sender's own photo: change its challenge, or remove it.
const picking = ref(false)
const confirmRemove = ref(false)
useBackClose(confirmRemove)

// The committee: the same words and sheets as the judge's queue.
const rejecting = ref(false)
const moreOpen = ref(false)
const confirmInappropriate = ref(false)
const confirmDelete = ref(false)
// Hidden photos' Delete for good.
const confirmPurge = ref(false)
// Which side of the verdict is saving; photos another judge got to first while judging here;
// photos judged here, whose "Looks fine" stays, held, so the photo doesn't jump as it goes.
const saving = ref<'counts' | 'reject' | null>(null)
const taken = reactive(new Set<string>())
const fine = reactive(new Set<string>())

// A new photo starts unzoomed. Keyed on the photo, not its place: a list that grows in front of
// it (a refresh on the group page) leaves the zoom alone.
watch(() => photo.value?.id ?? null, () => {
  burst.value = 0
  resetZoom()
  gesture = null
})
watch(index, (i) => {
  if (i === null) {
    // Nothing left open for next time.
    picking.value = false
    confirmRemove.value = false
    rejecting.value = false
    moreOpen.value = false
    confirmInappropriate.value = false
    confirmDelete.value = false
    confirmPurge.value = false
    say(null)
  }
  else if (!props.single && i >= props.photos.length - 3) {
    emit('more')
  }
})

const reasons = computed(() => rejectReasons(challenge.value ? { ...challenge.value, whoInShot: challenge.value.whoInShot ?? null } : null))
// Counts, Doesn't count or Looks fine. A photo nobody had checked is protected, as in the queue:
// if another judge got there first, their verdict stands. Changing a verdict already given is
// deliberate, so outside judging it goes through. Judging, the page moves on and says what was
// decided; here, "Saved" with Undo.
async function decide(action: 'pass' | 'reject', reason?: string) {
  const p = photo.value
  if (!p || busy.value) return
  rejecting.value = false
  const before = { rejectReason: p.rejectReason, unchecked: p.unchecked }
  busy.value = true
  saving.value = action === 'pass' ? 'counts' : 'reject'
  say(null)
  try {
    const row = await committeeSend(p.id, { action, reason, force: props.review || before.unchecked ? undefined : true })
    p.rejectReason = row.verdict === 'rejected' ? row.rejectReason : null
    p.unchecked = false
    fine.add(p.id)
    emit('changed')
    if (props.review) emit('decided', p.id)
  }
  catch (err) {
    const theirs = takenBy(err)
    if (!theirs) {
      say({ id: p.id, text: `Not saved. ${why(err)}`, tone: 'error', action: { label: 'Retry', run: () => decide(action, reason) } })
    }
    else {
      // Judging, the photo is left as it was, so the page doesn't count it as this judge's
      // decision; its next refresh takes it away. Elsewhere, it shows the verdict that stands.
      if (props.review) {
        taken.add(p.id)
      }
      else {
        p.unchecked = false
        p.rejectReason = theirs.verdict === 'rejected' ? (theirs.rejectReason ?? 'Doesn\'t match the challenge') : null
        emit('changed')
      }
      say({ id: p.id, text: TAKEN })
    }
  }
  finally {
    busy.value = false
    saving.value = null
  }
}
// A new challenge for the photo. From the committee it also counts, as in the judge's queue:
// moving it there is the judge's call that it belongs. Picking where it already is changes
// nothing, so a tap on the ticked row can't undo a verdict.
async function onPick(choice: Placed) {
  const p = photo.value
  if (!p || busy.value) return
  picking.value = false
  if (choice.challengeId === p.challengeId && normaliseLabel(choice.label ?? '') === normaliseLabel(p.label ?? '')) return
  busy.value = true
  say(null)
  let label = choice.label
  try {
    if (props.committee) label = (await committeeSend(p.id, { action: 'challenge', challengeId: choice.challengeId, label: choice.label })).label ?? null
    else await ownSend(p.id, { action: 'move', challengeId: choice.challengeId, label: choice.label })
  }
  catch (err) {
    busy.value = false
    say({ id: p.id, text: `Not moved. ${why(err)}`, tone: 'error', action: { label: 'Retry', run: () => onPick(choice) } })
    return
  }
  Object.assign(p, { challengeId: choice.challengeId, label, rejectReason: null, unchecked: true })
  emit('changed')
  if (props.committee) {
    try {
      await committeeSend(p.id, { action: 'pass' })
      p.unchecked = false
    }
    catch (err) {
      // Another judge checked it at its new place meanwhile: that stands.
      const theirs = takenBy(err)
      if (!theirs) {
        busy.value = false
        say({ id: p.id, text: `Moved, not counted. ${why(err)}`, tone: 'error', action: { label: 'Retry', run: () => decide('pass') } })
        return
      }
      p.unchecked = false
      p.rejectReason = theirs.verdict === 'rejected' ? (theirs.rejectReason ?? 'Doesn\'t match the challenge') : null
    }
  }
  busy.value = false
  if (props.review) emit('decided', p.id)
}
// The photo an action was for, which may not be the one on show any more: a swipe can land while
// the request is out. The list loses it; the view stays on the photo it shows, or, if that's the
// one that went, on the next.
function dropPhoto(p: ViewerPhoto, how?: Removal) {
  const gone = props.photos.indexOf(p)
  const at = index.value
  emit('removed', p.id, how)
  // Judging: the page closes the view after each decision and says what happened in its own bar.
  if (props.review) return emit('decided', p.id)
  if (at === null || gone < 0) return
  if (props.photos.length <= 1) index.value = null
  else if (gone === at) index.value = Math.min(at, props.photos.length - 2)
  else if (gone < at) index.value = at - 1
}
// Removing asks first, so a removal that doesn't save offers Retry rather than asking again.
async function removeOwn() {
  const p = photo.value
  if (!p || busy.value) return
  busy.value = true
  try {
    await ownSend(p.id, { action: 'remove' })
  }
  catch (err) {
    confirmRemove.value = false
    say({ id: p.id, text: `Not removed. ${why(err)}`, tone: 'error', action: { label: 'Retry', run: removeOwn } })
    return
  }
  finally {
    busy.value = false
  }
  confirmRemove.value = false
  const staysOpen = props.photos.length > 1
  dropPhoto(p)
  if (staysOpen) say({ text: 'Photo removed' })
  else toast.success('Photo removed')
}
async function hide() {
  const p = photo.value
  moreOpen.value = false
  if (!p || busy.value) return
  busy.value = true
  try {
    await committeeSend(p.id, { action: 'remove' })
  }
  catch (err) {
    say({ id: p.id, text: `Not hidden. ${why(err)}`, tone: 'error', action: { label: 'Retry', run: hide } })
    return
  }
  finally {
    busy.value = false
  }
  // Losing its last photo closes the view.
  const staysOpen = props.photos.length > 1
  dropPhoto(p, 'hidden')
  if (props.review) return
  const undo = { label: 'Undo' as const, run: () => unhide(p) }
  if (staysOpen) say({ text: 'Photo hidden', action: undo })
  else toast.success('Photo hidden', { duration: 8000, action: { label: undo.label, onClick: undo.run } })
}
// Hide's Undo outside judging (the judge's page has its own): back in the gallery, and the page
// catches up (`changed`), whether or not the view is still open.
async function unhide(p: ViewerPhoto) {
  const tell = (next: Said) => {
    if (index.value !== null) say(next)
    else if (next.tone) toast.error(next.text)
    else toast.success(next.text)
  }
  try {
    await committeeSend(p.id, { action: 'restore' })
  }
  catch (err) {
    tell({ text: `Still hidden. ${why(err)}`, tone: 'error', action: { label: 'Retry', run: () => unhide(p) } })
    return
  }
  emit('changed')
  tell({ text: 'Back in the gallery' })
}
async function removeForGood(action: 'inappropriate' | 'delete', block = false) {
  const p = photo.value
  if (!p || busy.value) return
  busy.value = true
  let row: Row
  try {
    row = await committeeSend(p.id, { action, block })
  }
  catch (err) {
    confirmDelete.value = false
    say({ id: p.id, text: `Not deleted. ${why(err)}`, tone: 'error', action: { label: 'Retry', run: () => removeForGood(action, block) } })
    return
  }
  finally {
    busy.value = false
  }
  confirmDelete.value = false
  const staysOpen = props.photos.length > 1
  dropPhoto(p, action === 'delete' ? 'deleted' : block && row.deviceId ? 'blocked' : 'inappropriate')
  if (props.review) return
  const text = action === 'delete' ? 'Photo deleted' : `Deleted as inappropriate${block && row.deviceId ? '. Phone blocked.' : ''}`
  if (staysOpen) say({ text })
  else toast.success(text)
}
// From Hidden photos, through the same request as its Select. A photo that left the
// list meanwhile (another committee member unhid or deleted it) leaves it here too, saying so;
// one with a copy in the gallery stays.
const hiddenBusy = ref<'restore' | 'delete' | null>(null)
async function fromHidden(action: 'restore' | 'delete') {
  const p = photo.value
  if (!p || busy.value) return
  busy.value = true
  hiddenBusy.value = action
  // Held on the page before it goes: a look landing after the server marked it, with the answer
  // lost, mustn't drop it. The page lets go once it leaves the list here.
  if (action === 'delete') emit('purging', p.id)
  let answer: BatchAnswer
  try {
    answer = await $fetch<BatchAnswer>('/api/committee/photos/batch', { method: 'POST', body: { action, ids: [p.id] }, timeout: 20_000 })
  }
  catch (err) {
    confirmPurge.value = false
    // No answer may still mean it went through; the page still holds it.
    say({ id: p.id, text: `Couldn't finish. ${why(err)}`, tone: 'error', action: { label: 'Retry', run: () => fromHidden(action) } })
    return
  }
  finally {
    busy.value = false
    hiddenBusy.value = null
  }
  confirmPurge.value = false
  const refused = answer.refused[0]?.reason
  if (refused === 'copy-in-gallery') return say({ id: p.id, text: 'A copy of this photo is in the gallery already', tone: 'error' })
  const staysOpen = props.photos.length > 1
  dropPhoto(p, action === 'restore' && !refused ? 'unhidden' : 'deleted')
  const text = action === 'restore'
    ? (refused ? 'Already deleted for good' : 'Back in the gallery')
    : (refused === 'in-gallery' ? 'Already back in the gallery' : 'Deleted for good')
  if (staysOpen) say({ text })
  else toast.success(text)
}
// A sheet closes before the confirmation opens over the photo.
function fromMore(next: () => void) {
  moreOpen.value = false
  setTimeout(next, 250)
}
</script>

<template>
  <Dialog :open="index !== null" @update:open="v => { if (!v) close() }">
    <DialogContent
      class="top-0 left-0 flex h-dvh w-screen max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-none border-0 bg-background p-0 ring-0 sm:max-w-none data-open:zoom-in-100 data-closed:zoom-out-100"
      :show-close-button="false"
    >
      <DialogTitle class="sr-only">
        {{ what }}
      </DialogTitle>
      <DialogDescription class="sr-only">
        {{ credit.filter(Boolean).join(' · ') }}.{{ canSwipe ? ' Swipe sideways for the next photo.' : '' }} Pinch to zoom.
      </DialogDescription>
      <template v-if="photo">
        <!-- The top bar: the X, its strokes on the content's left edge where the text below
             starts, and opposite it what can be done to this photo, the last icon's painted edge
             on the content's right edge. -->
        <div class="mx-auto flex w-full max-w-lg shrink-0 items-center gap-2 px-4 pt-[env(safe-area-inset-top)]">
          <Button variant="ghost" size="icon" class="-ml-[15px] shrink-0" aria-label="Close" @click="close">
            <XIcon class="size-6" />
          </Button>
          <!-- Screen readers can't swipe: they get Previous and Next, which show when focused
               from a keyboard. -->
          <Button v-if="hasPrevious" variant="ghost" class="sr-only focus-visible:not-sr-only" @click="go(-1)">
            Previous photo
          </Button>
          <Button v-if="hasNext" variant="ghost" class="sr-only focus-visible:not-sr-only" @click="go(1)">
            Next photo
          </Button>
          <div class="ml-auto flex min-w-0 items-center justify-end">
            <Button
              v-if="ticked" variant="ghost" class="-mr-3 px-3 text-base" :disabled="tickLocked"
              @click="emit('tick', photo.id)"
            >
              <span class="flex size-6 items-center justify-center rounded-full border-2" :class="ticked(photo.id) ? 'border-primary bg-primary' : 'border-foreground/50'" aria-hidden="true">
                <CheckIcon v-if="ticked(photo.id)" class="size-3.5 text-primary-foreground" :stroke-width="3" />
              </span>
              {{ ticked(photo.id) ? 'Selected' : 'Select' }}
            </Button>
            <template v-else-if="committee">
              <Button variant="ghost" size="icon" :aria-label="photo.challengeId ? 'Change challenge' : 'Pick a challenge'" :disabled="busy" @click="picking = true">
                <PencilIcon class="size-6" />
              </Button>
              <Button variant="ghost" size="icon" class="-mr-[14px]" aria-label="More" :disabled="busy" @click="moreOpen = true">
                <EllipsisIcon class="size-6" />
              </Button>
            </template>
            <template v-else-if="photo.mine">
              <p v-if="moveBlocked" class="min-w-0 text-right text-base leading-tight text-muted-foreground">
                {{ moveBlocked }}
              </p>
              <Button v-else variant="ghost" class="min-w-0 px-3" :disabled="busy" @click="picking = true">
                <PencilIcon /> {{ photo.challengeId ? 'Change challenge' : 'Pick a challenge' }}
              </Button>
              <Button variant="ghost" size="icon" class="-mr-[13px] shrink-0 text-destructive" aria-label="Remove photo" :disabled="busy" @click="confirmRemove = true">
                <Trash2Icon class="size-6" />
              </Button>
            </template>
          </div>
        </div>

        <!-- The photo, centred in the room between the top bar and the details. The small
             version shows while the full one loads. The page never zooms here: the photo does. -->
        <div
          ref="stage" class="relative min-h-0 flex-1 touch-none select-none overflow-hidden"
          :style="{ transform: drop ? `translateY(${drop}px)` : undefined, opacity: drop ? String(Math.max(0.4, 1 - drop / 400)) : undefined }"
          @touchstart="onTouchStart" @touchmove="onTouchMove" @touchend="onTouchEnd" @touchcancel="onTouchCancel" @click="onPhotoTap"
        >
          <div class="absolute inset-0" :class="animating && 'transition-transform duration-200 ease-out'" :style="{ transform: `translateX(${offset}px)` }">
            <div v-for="s in slides" :key="s.p.id" class="absolute inset-0" :style="{ transform: `translateX(${s.d * 100}%)` }" :aria-hidden="s.d !== 0">
              <div
                class="absolute inset-0" :class="s.d === 0 && settling && 'transition-transform duration-200 ease-out'"
                :style="s.d === 0 ? { transform: `translate(${zoom.x}px, ${zoom.y}px) scale(${zoom.s})` } : undefined"
              >
                <img :src="s.p.thumbUrl" alt="" draggable="false" class="absolute inset-0 size-full object-contain">
                <img
                  :key="`${s.p.id}-${tries[s.p.id] ?? 0}`" :src="s.p.largeUrl" alt="" draggable="false" class="absolute inset-0 size-full object-contain"
                  @load="onLarge(s.p, $event)" @error="large[s.p.id] = 'failed'"
                >
              </div>
            </div>
          </div>
          <span v-if="burst" :key="burst" class="pointer-events-none absolute inset-0 flex items-center justify-center" aria-hidden="true">
            <HeartIcon class="like-burst size-24 fill-rose-500 text-white drop-shadow-lg" />
          </span>
          <div v-if="large[photo.id] === 'failed'" class="pointer-events-none absolute inset-0 flex items-center justify-center px-4">
            <div role="alert" class="pointer-events-auto flex items-center gap-3 rounded-full bg-background py-1 pl-4 pr-1 text-base shadow-md" @click.stop>
              Photo didn't load
              <Button variant="outline" size="sm" class="rounded-full" @click="retry(photo)">
                Retry
              </Button>
            </div>
          </div>
          <!-- What just happened, over the foot of the photo, right above what it's about. -->
          <div class="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center px-4" role="status">
            <div
              v-if="shownSaid" class="pointer-events-auto flex min-h-11 min-w-0 items-center gap-2 rounded-3xl bg-background py-1 pl-4 text-base shadow-md"
              :class="shownSaid.action ? 'pr-1' : 'pr-4'" @click.stop
            >
              <span class="line-clamp-2 min-w-0 leading-snug" :class="shownSaid.tone === 'error' && 'font-semibold text-red-800'">{{ shownSaid.text }}</span>
              <Button v-if="shownSaid.action" variant="outline" size="sm" class="ml-1 shrink-0 rounded-full" @click="runSaid">
                {{ shownSaid.action.label }}
              </Button>
            </div>
          </div>
          <p class="sr-only" aria-live="polite">
            {{ announced }}
          </p>
        </div>

        <!-- The details: as tall as this photo's need, never more than 45% of the screen, so a
             long title wraps here and scrolls rather than squeeze the photo. -->
        <div class="mx-auto max-h-[45dvh] w-full max-w-lg shrink-0 overflow-y-auto overscroll-contain px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
          <!-- What it's for and its points, with the heart on the same line. A just a photo is for
               nothing in particular: who sent it leads instead. -->
          <div class="flex items-start gap-2">
            <p v-if="challenge" class="min-w-0 flex-1 text-xl font-bold leading-7">
              {{ what }}<QuestPointsPill v-if="points" :points="points" earned class="ml-2 align-top" />
            </p>
            <CreditLine v-else :parts="credit" class="min-w-0 flex-1 text-lg font-semibold leading-7" />
            <!-- Heart, then count. Last on the line, it's pulled right so the painted heart or the
                 count's last digit, each 9 px inside the button, ends on the content edge. -->
            <button
              v-if="!review && !hidden" type="button" class="-my-2 -mr-[9px] flex h-11 min-w-11 shrink-0 items-center justify-end gap-1.5 rounded-full px-2 text-lg font-semibold tabular-nums active:bg-muted"
              :aria-pressed="photo.liked" :aria-label="`${photo.liked ? 'Unlike' : 'Like'}${photo.likes ? `, ${photo.likes} ${photo.likes === 1 ? 'like' : 'likes'}` : ''}`"
              @click="toggleLike(photo)"
            >
              <HeartIcon class="size-7" :class="photo.liked ? 'fill-rose-500 text-rose-500' : ''" />
              <span v-if="photo.likes">{{ photo.likes }}</span>
            </button>
          </div>
          <p v-if="photo.rejectReason" class="mt-1 text-base font-medium text-destructive">
            Doesn't count: {{ photo.rejectReason }}
          </p>
          <CreditLine v-if="challenge" :parts="credit" class="mt-1 text-base text-muted-foreground" />

          <!-- Hidden photos: Unhide a third of the row (no wider than on a 412 px phone, as in
               the photo editor), Delete for good the rest. -->
          <div v-if="hidden && !ticked" class="mt-3 grid grid-cols-[min(calc((100%-0.75rem)/3),123px)_1fr] gap-3">
            <Button size="lg" variant="outline" class="px-3" :disabled="busy || !ready" :aria-busy="hiddenBusy === 'restore'" @click="fromHidden('restore')">
              <Loader2Icon v-if="hiddenBusy === 'restore'" class="animate-spin" aria-hidden="true" />
              <span :class="hiddenBusy === 'restore' && 'sr-only'">Unhide</span>
            </Button>
            <!-- Outlined in red, as weighty as Unhide: it asks first. -->
            <Button
              size="lg" variant="outline" class="border-destructive/50 text-destructive hover:bg-destructive/10 hover:text-destructive" :disabled="busy || !ready"
              :aria-busy="hiddenBusy === 'delete'" @click="confirmPurge = true"
            >
              <Loader2Icon v-if="hiddenBusy === 'delete'" class="animate-spin" aria-hidden="true" />
              <span :class="hiddenBusy === 'delete' && 'sr-only'">Delete for good</span>
            </Button>
          </div>

          <!-- The committee: who must be in it, the likely fix for a misfiled animal, then the
               judge's verdict, the same control as in the queue. A just a photo scores nothing,
               so it only needs "Looks fine" until checked. -->
          <template v-if="committee">
            <p v-if="needs" class="mt-1 text-base">
              {{ needs }}
            </p>
            <Button
              v-if="spot" variant="outline" size="sm" class="mt-2 rounded-full pr-1.5" :disabled="busy || !ready"
              @click="onPick({ challengeId: spot.id, label: null })"
            >
              Move to {{ spot.title }} <QuestPointsPill v-if="spot.points" :points="spot.points" />
            </Button>
            <CommitteeVerdictButtons
              v-if="challenge" class="mt-3" :rejected="!!photo.rejectReason" :settled="!photo.unchecked" :saving="saving"
              :disabled="!ready || taken.has(photo.id)" @counts="decide('pass')" @reject="rejecting = true"
            />
            <div v-else-if="review || photo.unchecked || fine.has(photo.id)" class="mt-3 grid">
              <Button
                size="lg" :class="!photo.unchecked && 'pointer-events-none'" :disabled="!ready || taken.has(photo.id)"
                :aria-pressed="photo.unchecked ? undefined : true" @click="decide('pass')"
              >
                <Loader2Icon v-if="saving" class="animate-spin" aria-hidden="true" />
                <CheckIcon v-else aria-hidden="true" />
                Looks fine
              </Button>
            </div>
          </template>
        </div>
      </template>
    </DialogContent>
  </Dialog>

  <PickChallengeSheet
    v-if="photo" v-model:open="picking" :challenges="challenges" :challenge-id="photo.challengeId" :label="photo.label" :thumb-url="photo.thumbUrl"
    :allow-none="!!photo.challengeId" :done="done" :animals-found="animalsFound" :colours-found="coloursFound" :busy="busy" :quick-names="committee" @pick="onPick"
  />
  <CommitteeRejectSheet v-if="committee" v-model:open="rejecting" :reasons="reasons" :busy="busy" :thumb-url="photo?.thumbUrl" :identity="identity" @reject="r => decide('reject', r)" />
  <CommitteeMoreSheet
    v-if="committee" v-model:open="moreOpen" :busy="busy" :thumb-url="photo?.thumbUrl" :identity="identity"
    @hide="hide" @inappropriate="fromMore(() => { confirmInappropriate = true })" @delete="fromMore(() => { confirmDelete = true })"
  />
  <CommitteeInappropriateDialog v-if="committee" v-model:open="confirmInappropriate" :group-name="photo ? groupName(photo.groupId) : ''" :thumb-url="photo?.thumbUrl" :identity="identity" @confirm="block => removeForGood('inappropriate', block)" />
  <CommitteeDeleteDialog v-if="committee" v-model:open="confirmDelete" :thumb-url="photo?.thumbUrl" :identity="identity" :busy="busy" @confirm="removeForGood('delete')" />
  <CommitteeDeleteDialog v-if="hidden" v-model:open="confirmPurge" :thumb-url="photo?.thumbUrl" :identity="identity" :busy="busy" @confirm="fromHidden('delete')" />
  <!-- The sender's confirmation shows which photo too, as the judge's do. -->
  <Dialog v-model:open="confirmRemove">
    <DialogContent class="w-[calc(100vw-2rem)] max-w-md" :show-close-button="false">
      <div class="flex min-w-0 items-center gap-3">
        <img v-if="photo" :src="photo.thumbUrl" alt="" class="size-11 shrink-0 rounded-lg bg-muted object-cover">
        <div class="min-w-0">
          <DialogTitle>Remove this photo?</DialogTitle>
          <p class="truncate text-base text-muted-foreground">
            {{ what }}
          </p>
        </div>
      </div>
      <DialogDescription>It can't be undone.</DialogDescription>
      <div class="grid grid-cols-2 gap-2">
        <Button variant="outline" @click="confirmRemove = false">
          Keep it
        </Button>
        <Button variant="destructive" :disabled="busy" @click="removeOwn">
          Remove
        </Button>
      </div>
    </DialogContent>
  </Dialog>
</template>

<style scoped>
.like-burst {
  animation: like-burst 700ms ease-out forwards;
}
@keyframes like-burst {
  0% { transform: scale(0.4); opacity: 0; }
  25% { transform: scale(1.15); opacity: 0.95; }
  60% { transform: scale(1); opacity: 0.95; }
  100% { transform: scale(1); opacity: 0; }
}
</style>
