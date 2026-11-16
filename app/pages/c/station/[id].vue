<script setup lang="ts">
import type { StationScores } from '~/types/api'
import type { ScoreEntry } from '~/composables/useScoreQueue'
import { stations as stationSeeds } from '~~/data/event'
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue'
import { useWindowScroll } from '@vueuse/core'
import { CheckIcon, ChevronDownIcon, ChevronUpIcon, WifiOffIcon } from '@lucide/vue'
import { dueGroups, formatClock, playingAt, ROUND_COUNT, roundEndsAt, roundsEndedAt, roundStartsAt, slotFor } from '#shared/utils/rotation'
import { ago } from '~/utils/time'

await useCommitteeGuard()
const route = useRoute()
const stationId = computed(() => String(route.params.id))

type Row = StationScores['groups'][number]

const { data, error, refresh } = await useFetch<StationScores>(() => `/api/committee/stations/${stationId.value}`, { deep: true })
useHead({ title: computed(() => `${data.value?.station.name ?? 'Station'} scores`) })

// Each group's score lives in the app-wide score queue (composables/useScoreQueue.ts): what's
// saved, what the IC typed, and a save still on its way, which keeps trying after this page closes.
const scores = useScoreQueue(() => stationId.value)
watch(() => data.value?.groups, (groups) => {
  for (const g of groups ?? []) scores.sync(g.id, g)
}, { immediate: true })

// Round times can move on the day, and another phone may save a score. Pick those up without
// touching scores being typed or sent here.
useVisibleInterval(async () => {
  const latest = await $fetch<StationScores>(`/api/committee/stations/${stationId.value}`).catch(() => null)
  if (!latest || !data.value) return
  data.value.firstRoundAt = latest.firstRoundAt
  for (const g of latest.groups) scores.sync(g.id, g)
}, 60_000)

const now = useClock(15_000)
const roundAt = (g: Row) => {
  for (let r = 0; r < ROUND_COUNT; r++) if (slotFor(g.startSlot, r) === data.value?.station.slot) return r
  return -1
}
const savedOf = (g: Row) => scores.entry(g).saved ?? g
const playingId = computed(() => data.value ? playingAt(data.value.station.slot, data.value.groups, now.value, data.value.firstRoundAt)?.id ?? null : null)
// Every group whose round here has ended without a score, oldest first: what the IC owes.
const dueIds = computed(() => {
  const d = data.value
  if (!d) return []
  const saved = d.groups.map(g => ({ groupId: g.id, raw: savedOf(g).raw, missed: savedOf(g).missed }))
  return dueGroups({ slot: d.station.slot, groups: d.groups, scores: saved, now: now.value, firstRoundAt: d.firstRoundAt }).map(g => g.id)
})
// When a group is here, under its name on every row: "10:05–10:25 am".
function timesHere(g: Row) {
  const r = roundAt(g)
  const start = formatClock(roundStartsAt(r, data.value?.firstRoundAt))
  const end = formatClock(roundEndsAt(r, data.value?.firstRoundAt))
  return `${start.slice(-2) === end.slice(-2) ? start.replace(/\s*[ap]m$/, '') : start}–${end}`
}

// The page is one list in visiting order, built around the score due now. A due group is open
// with its title in amber; a scored group is one line with its score, and a group still to come
// one line with its time. The group playing now is open too, unless scores are due: then it's
// one line, so the due ones lead, and tapping it opens it to score early. Tapping any line opens
// it. A row with something typed or sending stays open.
const opened = reactive(new Set<string>())
const asked = typeof route.query.group === 'string' ? route.query.group : null
if (asked) opened.add(asked)
const busy = (e: ScoreEntry) => e.pending || e.saving || e.conflict || !!e.failed || scores.changed(e)
const cards = computed(() => {
  const d = data.value
  if (!d) return []
  const anyDue = dueIds.value.length > 0
  return [...d.groups].sort((a, b) => roundAt(a) - roundAt(b)).map((g) => {
    const e = scores.entry(g)
    const saved = savedOf(g)
    const scored = saved.missed || saved.raw !== null
    const held = opened.has(g.id) || busy(e)
    const look = dueIds.value.includes(g.id)
      ? 'due' as const
      : g.id === playingId.value
        ? 'now' as const
        : held ? 'open' as const : scored ? 'scored' as const : 'later' as const
    return {
      g,
      e,
      look,
      scored,
      folded: look === 'scored' || look === 'later' || (look === 'now' && anyDue && !held),
      score: saved.missed ? 'Missed' : String(saved.raw),
      times: timesHere(g),
      closable: opened.has(g.id) && !busy(e) && (look === 'open' || (look === 'now' && anyDue)),
    }
  })
})

// "Not saved" waits until the IC leaves the box, so it doesn't nag while they type.
const typingIn = ref<string | null>(null)
function focused(g: Row, ev: FocusEvent) {
  typingIn.value = g.id
  // The whole saved score is selected, so typing replaces it.
  const box = ev.target as HTMLInputElement
  if (box.value && !scores.changed(scores.entry(g))) setTimeout(() => box.setSelectionRange(0, box.value.length))
}
function left(g: Row) {
  if (typingIn.value === g.id) typingIn.value = null
}

// After a save, the cursor goes straight to the next score due, in the same tap, so the phone's
// keypad stays up for it.
function focusNextDue(after: string) {
  const next = dueIds.value.find(id => id !== after)
  const box = next ? document.querySelector<HTMLInputElement>(`#group-${next} input:not(:disabled)`) : null
  if (!box) return
  box.focus({ preventScroll: true })
  box.closest('li')?.scrollIntoView({ block: 'center', behavior: 'smooth' })
}
// A box that doesn't hold a number says so under its row until it's changed.
const notNumber = reactive(new Set<string>())
function edit(c: { g: Row, e: ScoreEntry }, change: Partial<Pick<ScoreEntry, 'value' | 'missed'>>) {
  notNumber.delete(c.g.id)
  scores.edit(c.e, change)
}
function save(g: Row) {
  const e = scores.entry(g)
  if (e.saving) return
  if (scores.save(e)) focusNextDue(g.id)
  else notNumber.add(g.id)
}

// Shows a group's row and puts the cursor in its score box, unless the IC is typing in
// another group's box (and didn't tap this one).
const bar = ref<HTMLElement | null>(null)
async function bringUp(groupId: string, smooth: boolean, tapped = false) {
  await nextTick()
  const card = document.getElementById(`group-${groupId}`)
  const active = document.activeElement
  if (!card || (!tapped && active instanceof HTMLInputElement && !card.contains(active))) return
  const box = card.getBoundingClientRect()
  if (box.top < (bar.value?.getBoundingClientRect().bottom ?? 0) || box.bottom > window.innerHeight) {
    card.scrollIntoView({ block: 'center', behavior: smooth ? 'smooth' : 'auto' })
  }
  card.querySelector<HTMLInputElement>('input:not(:disabled)')?.focus({ preventScroll: true })
}
function open(g: Row) {
  opened.add(g.id)
  bringUp(g.id, true, true)
}

// On opening: the group asked for (`?group=g3`, from another page), else the oldest score due.
// Later, each time a round ends.
onMounted(() => {
  if (!data.value) return
  const target = data.value.groups.some(g => g.id === asked) ? asked : dueIds.value[0]
  if (target) bringUp(target, false)
})
const roundsEnded = computed(() => roundsEndedAt(now.value, data.value?.firstRoundAt))
watch(roundsEnded, (n, before) => {
  if (n > before && dueIds.value[0]) bringUp(dueIds.value[0], true)
})

// The sticky header's line shows only once the page has scrolled under it.
const { y: scrolled } = useWindowScroll()

const scoreHint = computed(() => stationSeeds.find(s => s.id === data.value?.station.id)?.scoreHint ?? 'The group\'s raw score.')
</script>

<template>
  <main class="mx-auto min-h-dvh max-w-lg px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-2">
    <div v-if="error" class="mt-10 flex flex-col items-center gap-3 text-center">
      <p class="text-base">
        This station couldn't load.
      </p>
      <Button variant="outline" @click="refresh()">
        Try again
      </Button>
    </div>
    <template v-else-if="data">
      <div ref="bar" class="sticky top-0 z-10 -mx-4 border-b bg-background px-4 pb-2 pt-1 transition-colors" :class="scrolled > 0 ? 'border-border' : 'border-transparent'">
        <CommitteeHeader :title="data.station.name" back="/c" />
      </div>
      <!-- How the game is scored: needed once a morning, so a quiet line rather than a block. -->
      <p class="text-base text-muted-foreground">
        {{ scoreHint }}
      </p>

      <!-- One grouped list, inset 16 px like the other committee lists; open rows grow in place. -->
      <ul class="mt-3 divide-y overflow-hidden rounded-2xl border">
        <li v-for="c in cards" :id="`group-${c.g.id}`" :key="c.g.id" :class="c.e.conflict && 'bg-warning-soft'">
          <!-- Folded: a scored group, one still to come, or the group playing now while scores
               are due, with when it's here under its name. Tapping it opens the row. The score
               itself says it's in, so no tick. -->
          <button
            v-if="c.folded" type="button" :aria-expanded="false"
            class="flex min-h-12 w-full items-center gap-2 px-4 py-2 text-left text-base active:bg-muted"
            @click="open(c.g)"
          >
            <span class="min-w-0 flex-1">
              <span class="block font-semibold">{{ c.g.name }}</span>
              <span class="block text-muted-foreground">{{ c.times }}</span>
            </span>
            <span v-if="c.look === 'scored'" class="shrink-0 tabular-nums" :class="c.score === 'Missed' ? 'text-muted-foreground' : 'font-semibold'">{{ c.score }}</span>
            <span v-else-if="c.look === 'now'" class="shrink-0 text-muted-foreground"><span class="sr-only">Playing </span>Now</span>
            <ChevronDownIcon class="-mr-1 size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
          </button>

          <!-- An open row, with when the group is here under its name. Due: the name in amber
               and a soft amber badge. While someone else's score is in the way, the row turns
               amber around the choice. -->
          <div v-else class="px-4 py-3">
            <div class="flex items-start justify-between gap-x-2">
              <div class="min-w-0">
                <h2 class="text-lg font-bold" :class="c.look === 'due' && 'text-warning'">
                  {{ c.g.name }}
                </h2>
                <p class="text-base text-muted-foreground">
                  {{ c.times }}
                </p>
              </div>
              <Badge v-if="c.look === 'due'" class="mt-1 shrink-0 bg-warning-soft text-warning">
                Score due
              </Badge>
              <div v-else class="flex shrink-0 items-center">
                <span v-if="c.look === 'now'" class="whitespace-nowrap text-base text-muted-foreground"><span class="sr-only">Playing </span>Now</span>
                <Button v-if="c.closable" variant="ghost" size="icon" class="-my-2 -mr-[15px]" :aria-label="`Close ${c.g.name}`" :aria-expanded="true" @click="opened.delete(c.g.id)">
                  <ChevronUpIcon class="size-5" />
                </Button>
              </div>
            </div>

            <!-- While someone else's score is in the way, the choice takes the whole row. -->
            <div v-if="c.e.conflict" class="mt-2 text-base" role="alert">
              <p>
                Someone else saved {{ c.e.saved?.missed ? '"missed"' : c.e.saved?.raw }} {{ c.e.saved?.updatedAt ? ago(c.e.saved.updatedAt) : '' }}.
              </p>
              <div class="mt-2 grid grid-cols-2 gap-2">
                <Button variant="outline" class="bg-background" @click="scores.keepTheirs(c.e)">
                  Keep {{ c.e.saved?.missed ? 'missed' : c.e.saved?.raw }}
                </Button>
                <Button variant="outline" class="bg-background" :disabled="c.e.saving" @click="scores.saveMine(c.e)">
                  {{ c.e.missed ? 'Save missed' : `Save my ${c.e.value}` }}
                </Button>
              </div>
            </div>

            <template v-else>
              <!-- The last column keeps its width, so the box doesn't jump when Save appears.
                   "Saved" and "Waiting" end on the row's right edge, under the time above. -->
              <div class="mt-2 grid grid-cols-[minmax(0,1fr)_auto_6rem] items-center gap-2">
                <Input
                  :model-value="c.e.missed ? 'Missed' : c.e.value"
                  :aria-label="`${c.g.name} score`"
                  inputmode="decimal"
                  enterkeyhint="done"
                  placeholder="Score"
                  class="h-12 bg-background text-lg tabular-nums"
                  :disabled="c.e.missed"
                  :aria-invalid="notNumber.has(c.g.id)"
                  @update:model-value="v => edit(c, { value: String(v) })"
                  @focus="(ev: FocusEvent) => focused(c.g, ev)"
                  @blur="left(c.g)"
                  @keydown.enter.prevent="scores.changed(c.e) && save(c.g)"
                />
                <!-- Dark grey when on, not green: green means "counts" in this app. -->
                <Button
                  variant="outline"
                  class="h-12 px-3"
                  :class="c.e.missed ? 'border-muted-foreground bg-muted-foreground text-background hover:bg-muted-foreground hover:text-background' : 'text-muted-foreground'"
                  :aria-pressed="c.e.missed"
                  @click="edit(c, { missed: !c.e.missed })"
                >
                  Missed
                </Button>
                <Button v-if="c.e.saving" class="h-12 w-full px-2" disabled>
                  Saving…
                </Button>
                <!-- On this phone only, sending by itself when the signal comes back: said in
                     place of Save, in amber, like "Saved" in green. -->
                <span v-else-if="c.e.pending" class="flex h-12 items-center justify-end gap-1.5 text-base font-medium text-warning" role="status">
                  <WifiOffIcon class="size-5 shrink-0" aria-hidden="true" />Waiting<span class="sr-only"> for signal</span>
                </span>
                <Button v-else-if="scores.changed(c.e)" class="h-12 w-full px-2" @click="save(c.g)">
                  Save
                </Button>
                <span v-else-if="c.scored" class="flex h-12 items-center justify-end gap-1.5 text-base font-medium text-success">
                  <span class="grid size-5 shrink-0 place-items-center rounded-full bg-success text-success-foreground" aria-hidden="true">
                    <CheckIcon class="size-3.5" :stroke-width="3" />
                  </span>
                  Saved
                </span>
              </div>

              <!-- A line only when there's something to say: red when it can't be saved, amber
                   when it's typed but not sent. -->
              <p v-if="notNumber.has(c.g.id)" class="mt-2 text-base font-semibold text-red-800" role="alert">
                Type a number, or tap Missed.
              </p>
              <p v-else-if="c.e.failed" class="mt-2 text-base font-semibold text-red-800" role="alert">
                {{ c.e.failed }}
              </p>
              <p v-else-if="!c.e.pending && !c.e.saving && scores.changed(c.e) && typingIn !== c.g.id" class="mt-2 text-base font-semibold text-warning">
                Not saved
              </p>
            </template>
          </div>
        </li>
      </ul>
    </template>
    <div v-else class="space-y-3" aria-busy="true">
      <Skeleton class="h-12 w-48" />
      <Skeleton class="h-6 w-full" />
      <Skeleton class="h-80 w-full rounded-2xl" />
    </div>
  </main>
</template>
