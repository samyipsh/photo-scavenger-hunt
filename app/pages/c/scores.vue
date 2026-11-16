<script setup lang="ts">
import type { Overview } from '~/types/api'
import type { SavedRow } from '~/composables/useScoreQueue'
import { EVENT } from '~~/data/event'
import { TYPES } from '~~/data/guide'
import { computed, ref, watch } from 'vue'
import { ChevronLeftIcon, ChevronRightIcon, DownloadIcon, LockIcon, RotateCcwIcon, SkipForwardIcon, WifiOffIcon } from '@lucide/vue'
import { formatClock, phaseAt, PLANNED_START, ROUND_COUNT, ROUND_MINUTES, roundEndsAt } from '#shared/utils/rotation'
import { deviceCode } from '#shared/utils/device'
import { formatPhotoTime, isPhotoTimeStyle, PHOTO_TIME_STYLES, type PhotoTimeStyle } from '#shared/utils/photoTime'

await useCommitteeGuard()
useHead({ title: `Manage · ${EVENT.appName}` })

const { data: fresh, refresh, error, status } = await useFetch<Overview>('/api/committee/overview', { deep: true, timeout: 15_000, headers: { 'x-device-id': deviceId() } })
// A refresh that fails keeps the last overview that loaded (useLastGood): losing signal after a
// good load shows a line with Retry, never the error page.
const data = useLastGood(fresh, error)
useSignInAgain(error)
const stale = computed(() => !!error.value && !!data.value)
useVisibleInterval(() => refresh(), 20_000)

// The open tab is in the address (?tab=controls, ?tab=groups), so other pages can link straight
// to it. Scores, the first, has none. Old links to ?tab=switches still open Controls.
const TABS = ['scores', 'controls', 'groups']
const route = useRoute()
const router = useRouter()
const tab = computed({
  get: () => {
    const asked = route.query.tab === 'switches' ? 'controls' : route.query.tab
    return typeof asked === 'string' && TABS.includes(asked) ? asked : 'scores'
  },
  set: (v: string) => { router.replace({ query: { ...route.query, tab: v === 'scores' ? undefined : v } }) },
})

// Every change made here shows as the new state in its own card, or a red line there when it
// didn't save; no toasts.
type Where = 'rounds' | 'scoreboard' | 'uploads' | 'blocks' | 'times' | 'types'
const failed = ref<{ where: Where, text: string } | null>(null)
const saving = ref(false)
// True once it's saved.
async function setSwitch(body: Record<string, unknown>, where: Where) {
  saving.value = true
  failed.value = null
  try {
    await $fetch('/api/committee/settings', { method: 'POST', body })
    await refresh()
    return true
  }
  catch (err) {
    failed.value = { where, text: errorText(err) }
    return false
  }
  finally {
    saving.value = false
  }
}
type Blocked = Overview['blocked'][number]
const blockedRows = computed(() => data.value?.blocked ?? [])
async function unblock(b: Blocked) {
  failed.value = null
  try {
    await $fetch(`/api/committee/blocks/${b.deviceId}`, { method: 'DELETE' })
    await refresh()
  }
  catch (err) {
    failed.value = { where: 'blocks', text: errorText(err) }
  }
}
const groupName = (id: string) => data.value?.groups.find(g => g.id === id)?.name ?? id

// A score fixed from the grid shows at once; the next refresh brings the new totals.
function scoreSaved(s: { stationId: string, groupId: string, row: SavedRow }) {
  const scores = data.value?.scores
  if (!scores) return
  const values = { raw: s.row.raw, missed: s.row.missed, updatedAt: s.row.updatedAt ?? Date.now() }
  const cell = scores.find(c => c.stationId === s.stationId && c.groupId === s.groupId)
  if (cell) Object.assign(cell, values)
  else scores.push({ stationId: s.stationId, groupId: s.groupId, ...values })
  refresh()
}

// Round times: the whole timetable hangs off round 1's start, so moving it moves every round.
const now = useClock(15_000)
const MINUTE = 60_000
const shift = computed(() => data.value ? Math.round((data.value.firstRoundAt - PLANNED_START) / MINUTE) : 0)
const shiftLabel = (m: number) => m === 0 ? 'On plan' : `${Math.abs(m)} min ${m > 0 ? 'later' : 'earlier'}`
// Where the morning is at `now` if round 1 starts at `start`, in parts that each stay on one
// line: "Round 3", "ends 10:45 am".
function whereNow(start: number) {
  const p = phaseAt(now.value, start)
  if (p.kind === 'after') return [`All rounds ended at ${formatClock(p.endedAt)}`]
  return p.kind === 'before' ? ['Round 1', `starts ${formatClock(p.startsAt)}`] : [`Round ${p.index + 1}`, `ends ${formatClock(p.endsAt)}`]
}
// Its own line under a proposal, so no line ends on a dangling "·". None once the rounds are over.
function lastEnds(start: number) {
  return phaseAt(now.value, start).kind === 'after' ? null : `Last round ends ${formatClock(roundEndsAt(ROUND_COUNT - 1, start))}`
}
// "10:30 to 10:50 am": the first time drops its am or pm when both share it.
function timeRange(from: number, to: number) {
  const [a, b] = [formatClock(from), formatClock(to)]
  return `${a.slice(-2) === b.slice(-2) ? a.slice(0, -3) : a} to ${b}`
}
const roundsNow = computed(() => data.value ? whereNow(data.value.firstRoundAt) : [])
// The stepper picks a new shift from the plan; nothing moves until the lead applies it, after
// seeing where that puts the morning, set against where it is now.
const picked = ref<number | null>(null)
const target = computed(() => picked.value ?? shift.value)
function step(minutes: number) {
  const next = target.value + minutes
  picked.value = next === shift.value ? null : next
}
const previewStart = computed(() => picked.value === null ? null : PLANNED_START + picked.value * MINUTE)

async function moveRounds(firstRoundAt: number) {
  return setSwitch({ firstRoundAt }, 'rounds')
}
// A failed save keeps the proposal, so the lead can try again.
async function applyShift() {
  if (picked.value === null) return
  const to = picked.value
  if (await moveRounds(PLANNED_START + to * MINUTE)) picked.value = null
}

const nextRound = computed(() => {
  if (!data.value) return null
  const p = phaseAt(now.value, data.value.firstRoundAt)
  if (p.kind === 'before') return 0
  if (p.kind === 'round' && p.index < ROUND_COUNT - 1) return p.index + 1
  return null
})
// Fixed when the dialog opens, so the times it states are the times it sets (to the minute, as
// the app keeps it). It leads with the main effect: the round on now ends.
const startNowAt = ref(0)
const confirmStartNow = ref(false)
const startNowLines = computed(() => {
  const n = nextRound.value ?? 0
  const last = n + 1 < ROUND_COUNT ? lastEnds(startNowAt.value - n * ROUND_MINUTES * MINUTE) : null
  return [
    n > 0 ? `Round ${n} ends now.` : null,
    `Round ${n + 1} runs ${timeRange(startNowAt.value, startNowAt.value + ROUND_MINUTES * MINUTE)}.`,
    last ? `${last}.` : null,
  ].filter((line): line is string => !!line)
})
function askStartNow() {
  startNowAt.value = Math.round(now.value / MINUTE) * MINUTE
  confirmStartNow.value = true
}
function startNextNow() {
  if (nextRound.value === null) return
  moveRounds(startNowAt.value - nextRound.value * ROUND_MINUTES * MINUTE)
}
const confirmReset = ref(false)
const confirmClose = ref(false)
const confirmUnlock = ref(false)
const confirmShowTypes = ref(false)
// Back closes each question, as Cancel does.
for (const r of [confirmStartNow, confirmReset, confirmClose, confirmUnlock, confirmShowTypes]) useBackClose(r)
function setUploads(open: boolean) {
  if (open) setSwitch({ uploadsOpen: true }, 'uploads')
  else confirmClose.value = true
}

// Locking the public scores loses nothing, so it doesn't ask; unlocking shows everyone the live
// totals, so that asks.
function scoreboardButton() {
  if (!data.value?.frozenAt) setSwitch({ frozen: true }, 'scoreboard')
  else confirmUnlock.value = true
}

// The Types of Christ answers, hidden until the results. Showing them can't be taken back from
// anyone who has read them, so that asks; hiding them again doesn't.
function typesButton() {
  if (data.value?.typesShown) setSwitch({ typesShown: false }, 'types')
  else confirmShowTypes.value = true
}

// How photo times read in the photo view and the judge's. The field names the choice; the sheet
// shows each as the time now would read.
const TIME_STYLE_NAMES: Record<PhotoTimeStyle, string> = { time: 'Time only', day: 'Day and time', date: 'Date and time' }
// The choice shows at once, greyed while it saves; if it doesn't save, the saved one comes back.
// Once saved it stays, even if the refresh after it fails (that refresh doesn't throw).
const savingTimes = ref<PhotoTimeStyle | null>(null)
async function setPhotoTimes(style: string) {
  if (!isPhotoTimeStyle(style)) return
  savingTimes.value = style
  if (await setSwitch({ photoTimes: style }, 'times') && data.value) data.value.photoTimes = style
  savingTimes.value = null
}
const timeOptions = computed(() => [{
  options: PHOTO_TIME_STYLES.map(s => ({ value: s, label: TIME_STYLE_NAMES[s], note: formatPhotoTime(now.value, s) })),
}])

// Each part stays whole and keeps the dot after it, so no line starts with "·".
const joined = (parts: string[]) => parts.map((s, i) => i < parts.length - 1 ? `${s} ·` : s)
const failedTab = computed(() => ({ scores: 'Scores', controls: 'Controls', groups: 'Groups' })[tab.value] ?? 'Scores')
</script>

<template>
  <main class="mx-auto min-h-dvh max-w-lg px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-2">
    <h1 class="sr-only">
      Manage
    </h1>
    <Tabs v-model="tab">
      <!-- One row, as on the judge page: back, then the tabs, which already say where this is.
           The back button sits as in CommitteeHeader: flush with the screen's edge, its chevron's
           point on the content edge. Each trigger sets its own 44 px height; the list grows
           around them. -->
      <div class="flex items-center gap-2">
        <Button as-child variant="ghost" size="icon" class="-ml-4 shrink-0">
          <NuxtLink to="/c" aria-label="Back">
            <ChevronLeftIcon class="size-6 -translate-x-0.5" />
          </NuxtLink>
        </Button>
        <TabsList class="grid min-w-0 flex-1 grid-cols-3 group-data-horizontal/tabs:h-auto">
          <TabsTrigger value="scores" class="h-11 data-[state=active]:bg-background data-[state=active]:font-semibold data-[state=active]:text-foreground data-[state=active]:shadow-sm">
            Scores
          </TabsTrigger>
          <TabsTrigger value="controls" class="h-11 data-[state=active]:bg-background data-[state=active]:font-semibold data-[state=active]:text-foreground data-[state=active]:shadow-sm">
            Controls
          </TabsTrigger>
          <TabsTrigger value="groups" class="h-11 data-[state=active]:bg-background data-[state=active]:font-semibold data-[state=active]:text-foreground data-[state=active]:shadow-sm">
            Groups
          </TabsTrigger>
        </TabsList>
      </div>

      <div v-if="error && !data" class="mt-10 flex flex-col items-center gap-3 text-center">
        <p class="text-base">
          {{ failedTab }} couldn't load.
        </p>
        <Button variant="outline" @click="refresh()">
          Try again
        </Button>
      </div>
      <div v-else-if="!data" class="mt-4 space-y-3" aria-busy="true">
        <Skeleton class="h-64 w-full rounded-2xl" />
        <Skeleton class="h-48 w-full rounded-2xl" />
      </div>

      <template v-else>
        <!-- A refresh that failed after a good load: the page stays as it was, and says so. -->
        <div v-if="stale" class="mt-4 flex min-h-12 items-center gap-3 rounded-2xl bg-warning-soft py-1 pl-4 pr-1 text-base" role="status">
          <WifiOffIcon class="size-5 shrink-0 text-warning" aria-hidden="true" />
          <p class="min-w-0 flex-1">
            <span class="whitespace-nowrap font-semibold">No signal ·</span>
            {{ ' ' }}<span class="whitespace-nowrap">{{ tab === 'scores' ? 'showing earlier scores' : 'may be out of date' }}</span>
          </p>
          <Button variant="ghost" class="shrink-0 text-primary hover:text-primary" :disabled="status === 'pending'" @click="refresh()">
            Retry
          </Button>
        </div>

        <TabsContent value="scores" class="mt-4">
          <!-- The lead checks totals here while everyone else sees the locked ones. -->
          <button
            v-if="data.frozenAt" type="button"
            class="mb-3 flex min-h-12 w-full items-center gap-3 rounded-2xl bg-warning-soft px-4 py-2 text-left text-base active:opacity-80"
            @click="tab = 'controls'"
          >
            <LockIcon class="size-5 shrink-0 text-warning" aria-hidden="true" />
            <span class="min-w-0 flex-1"><span class="font-semibold">Public scores locked</span> at {{ formatClock(data.frozenAt) }}</span>
            <ChevronRightIcon class="size-5 shrink-0 text-muted-foreground" />
          </button>
          <CommitteeScoreGrid :data="data" :now="now" @saved="scoreSaved" />
          <section class="mt-6">
            <!-- While the public scores are locked, these are the live totals only the committee sees. -->
            <h2 class="text-xl font-bold">
              {{ data.frozenAt ? 'Live standings' : 'Standings' }}
            </h2>
            <ol class="mt-2 divide-y rounded-2xl border">
              <li v-for="g in data.board.groups" :key="g.id" class="flex min-h-12 items-center gap-3 px-4 py-2">
                <span class="w-6 text-base tabular-nums text-muted-foreground">{{ g.place }}</span>
                <span class="flex-1 text-base font-semibold">{{ g.name }}</span>
                <span class="text-lg font-bold tabular-nums">{{ g.total }}</span>
              </li>
            </ol>
            <Button as="a" href="/api/committee/scores.csv" variant="outline" class="mt-2 w-full">
              <DownloadIcon /> Download CSV
            </Button>
          </section>
        </TabsContent>

        <!-- A grouped settings list. Words say each state; anything off normal is amber or red. -->
        <TabsContent value="controls" class="mt-4 space-y-4">
          <section class="divide-y overflow-hidden rounded-2xl border">
            <!-- Where the morning is; while the lead tries a change, set against where it would be,
                 in amber until it's saved. -->
            <div class="px-4 py-3 text-base">
              <h2 class="font-semibold">
                Round times
              </h2>
              <p class="text-muted-foreground">
                <span v-if="previewStart !== null">Now: </span><template v-for="part in joined(roundsNow)" :key="part"><span class="whitespace-nowrap">{{ part }}</span>{{ ' ' }}</template>
              </p>
              <div v-if="previewStart !== null" class="font-semibold text-warning" aria-live="polite">
                <p>
                  After: <template v-for="part in joined(whereNow(previewStart))" :key="part"><span class="whitespace-nowrap">{{ part }}</span>{{ ' ' }}</template>
                </p>
                <p v-if="lastEnds(previewStart)">
                  {{ lastEnds(previewStart) }}
                </p>
              </div>
              <p v-if="failed?.where === 'rounds'" class="mt-1 font-semibold text-red-800" role="alert">
                {{ failed.text }}
              </p>
            </div>
            <div class="px-4 py-3">
              <div class="flex items-center gap-2">
                <Button variant="outline" class="w-20 px-2" aria-label="5 min earlier" :disabled="saving" @click="step(-5)">
                  −5 min
                </Button>
                <p class="min-w-0 flex-1 text-center text-base font-semibold" :class="target !== 0 && 'text-warning'" aria-live="polite">
                  {{ shiftLabel(target) }}
                </p>
                <Button variant="outline" class="w-20 px-2" aria-label="5 min later" :disabled="saving" @click="step(5)">
                  +5 min
                </Button>
              </div>
              <div v-if="previewStart !== null" class="mt-3 grid grid-cols-2 gap-2">
                <Button variant="outline" :disabled="saving" @click="picked = null">
                  Cancel
                </Button>
                <Button :disabled="saving" @click="applyShift()">
                  Move rounds
                </Button>
              </div>
            </div>
            <!-- Actions, in green with an icon in home's 24 px icon column, so they read as things to
                 tap. Hidden while a change is being tried, so only one change is on the go. -->
            <template v-if="previewStart === null">
              <button v-if="nextRound !== null" type="button" class="flex min-h-12 w-full items-center gap-3 px-4 text-left text-base font-medium text-primary active:bg-muted disabled:opacity-50" :disabled="saving" @click="askStartNow()">
                <SkipForwardIcon class="size-6 shrink-0" aria-hidden="true" /> Start round {{ nextRound + 1 }} now
              </button>
              <button v-if="shift !== 0" type="button" class="flex min-h-12 w-full items-center gap-3 px-4 text-left text-base font-medium text-primary active:bg-muted disabled:opacity-50" :disabled="saving" @click="confirmReset = true">
                <RotateCcwIcon class="size-6 shrink-0" aria-hidden="true" /> Reset to planned times
              </button>
            </template>
          </section>

          <section class="divide-y overflow-hidden rounded-2xl border">
            <div class="px-4 py-3">
              <div class="flex min-h-10 items-center gap-3">
                <Label for="uploads-switch" class="min-w-0 flex-1 flex-col items-start gap-0 text-base font-normal leading-normal">
                  <span class="font-semibold">Photo uploads</span>
                  <span :class="data.uploadsOpen ? 'text-muted-foreground' : 'font-semibold text-red-800'">{{ data.uploadsOpen ? 'Open' : 'Closed' }}</span>
                </Label>
                <Switch id="uploads-switch" aria-label="Photo uploads" :model-value="data.uploadsOpen" :disabled="saving" @update:model-value="setUploads" />
              </div>
              <p v-if="failed?.where === 'uploads'" class="mt-1 text-base font-semibold text-red-800" role="alert">
                {{ failed.text }}
              </p>
            </div>
            <!-- Live all morning by default (the owner's call); locking keeps what everyone else
                 sees as it is, for example once the rounds are over. A deliberate act, so a named
                 button rather than a switch. -->
            <div class="px-4 py-3">
              <div class="flex min-h-10 items-center gap-3">
                <p class="min-w-0 flex-1 text-base">
                  <span class="block font-semibold">Public scoreboard</span>
                  <span v-if="data.frozenAt" class="block font-semibold text-warning">Locked at {{ formatClock(data.frozenAt) }}</span>
                  <span v-else class="block text-muted-foreground">Live</span>
                </p>
                <Button size="sm" variant="outline" :disabled="saving" @click="scoreboardButton()">
                  {{ !data.frozenAt ? 'Lock scores' : 'Unlock scores' }}
                </Button>
              </div>
              <p v-if="failed?.where === 'scoreboard'" class="mt-1 text-base font-semibold text-red-800" role="alert">
                {{ failed.text }}
              </p>
            </div>
            <!-- The answers to the puzzle card, under Help › Misc once shown. -->
            <div class="px-4 py-3">
              <div class="flex min-h-10 items-center gap-3">
                <p class="min-w-0 flex-1 text-base">
                  <span class="block font-semibold">{{ TYPES.title }}</span>
                  <span class="block text-muted-foreground">{{ data.typesShown ? 'Shown in Help' : 'Hidden' }}</span>
                </p>
                <Button size="sm" variant="outline" :disabled="saving" @click="typesButton()">
                  {{ data.typesShown ? 'Hide' : 'Show' }}
                </Button>
              </div>
              <p v-if="failed?.where === 'types'" class="mt-1 text-base font-semibold text-red-800" role="alert">
                {{ failed.text }}
              </p>
            </div>
            <!-- One morning shows the time alone; an event over several days picks the weekday or
                 the date. -->
            <div class="px-4 py-3">
              <div class="flex min-h-10 items-center gap-3">
                <p class="min-w-0 flex-1 text-base font-semibold">
                  Photo times
                </p>
                <div class="w-44 shrink-0">
                  <SelectSheet :model-value="savingTimes ?? data.photoTimes" title="Photo times" :sections="timeOptions" :disabled="saving" @update:model-value="setPhotoTimes" />
                </div>
              </div>
              <p v-if="failed?.where === 'times'" class="mt-1 text-base font-semibold text-red-800" role="alert">
                {{ failed.text }}
              </p>
            </div>
          </section>

          <section v-if="blockedRows.length" class="overflow-hidden rounded-2xl border">
            <h2 class="px-4 pt-3 text-base font-semibold">
              Blocked phones
            </h2>
            <ul class="mt-1 divide-y">
              <li v-for="b in blockedRows" :key="b.deviceId" class="flex min-h-14 items-center gap-3 px-4 py-2">
                <div class="min-w-0 flex-1 text-base">
                  <p class="font-mono font-bold">
                    {{ deviceCode(b.deviceId) }}
                  </p>
                  <CreditLine :parts="[groupName(b.groupId), formatClock(b.blockedAt)]" class="text-muted-foreground" />
                </div>
                <Button size="sm" variant="outline" @click="unblock(b)">
                  Unblock
                </Button>
              </li>
            </ul>
            <p v-if="failed?.where === 'blocks'" class="px-4 pb-3 text-base font-semibold text-red-800" role="alert">
              {{ failed.text }}
            </p>
          </section>
        </TabsContent>

        <TabsContent value="groups" class="mt-4">
          <CommitteeGroupList :groups="data.groups" @changed="refresh()" />
        </TabsContent>
      </template>
    </Tabs>

    <Dialog v-model:open="confirmStartNow">
      <DialogContent class="w-[calc(100vw-2rem)] max-w-md" :show-close-button="false">
        <DialogTitle>Start round {{ (nextRound ?? 0) + 1 }} now?</DialogTitle>
        <DialogDescription>
          <span v-for="line in startNowLines" :key="line" class="block">{{ line }}</span>
        </DialogDescription>
        <div class="grid grid-cols-2 gap-2">
          <Button variant="outline" @click="confirmStartNow = false">
            Cancel
          </Button>
          <Button @click="confirmStartNow = false; startNextNow()">
            Start round {{ (nextRound ?? 0) + 1 }}
          </Button>
        </div>
      </DialogContent>
    </Dialog>

    <Dialog v-model:open="confirmReset">
      <DialogContent class="w-[calc(100vw-2rem)] max-w-md" :show-close-button="false">
        <DialogTitle>Reset to planned times?</DialogTitle>
        <!-- Only where it puts the morning: that's what the lead is deciding on. -->
        <DialogDescription>
          <span class="block">After: <template v-for="part in joined(whereNow(PLANNED_START))" :key="part"><span class="whitespace-nowrap">{{ part }}</span>{{ ' ' }}</template></span>
          <span v-if="lastEnds(PLANNED_START)" class="block">{{ lastEnds(PLANNED_START) }}</span>
        </DialogDescription>
        <div class="grid grid-cols-2 gap-2">
          <Button variant="outline" @click="confirmReset = false">
            Cancel
          </Button>
          <Button @click="confirmReset = false; moveRounds(PLANNED_START)">
            Reset
          </Button>
        </div>
      </DialogContent>
    </Dialog>

    <Dialog v-model:open="confirmUnlock">
      <DialogContent class="w-[calc(100vw-2rem)] max-w-md" :show-close-button="false">
        <DialogTitle>Unlock the public scores?</DialogTitle>
        <DialogDescription>The public scoreboard goes live with the current totals.</DialogDescription>
        <div class="grid grid-cols-2 gap-2">
          <Button variant="outline" @click="confirmUnlock = false">
            Cancel
          </Button>
          <Button @click="confirmUnlock = false; setSwitch({ frozen: false }, 'scoreboard')">
            Unlock
          </Button>
        </div>
      </DialogContent>
    </Dialog>

    <Dialog v-model:open="confirmShowTypes">
      <DialogContent class="w-[calc(100vw-2rem)] max-w-md" :show-close-button="false">
        <DialogTitle>Show the {{ TYPES.title }}?</DialogTitle>
        <DialogDescription>Everyone can read the answers under Help.</DialogDescription>
        <div class="grid grid-cols-2 gap-2">
          <Button variant="outline" @click="confirmShowTypes = false">
            Cancel
          </Button>
          <Button @click="confirmShowTypes = false; setSwitch({ typesShown: true }, 'types')">
            Show
          </Button>
        </div>
      </DialogContent>
    </Dialog>

    <Dialog v-model:open="confirmClose">
      <DialogContent class="w-[calc(100vw-2rem)] max-w-md" :show-close-button="false">
        <DialogTitle>Close uploads?</DialogTitle>
        <DialogDescription>Waiting photos won't send until uploads reopen.</DialogDescription>
        <div class="grid grid-cols-2 gap-2">
          <Button variant="outline" @click="confirmClose = false">
            Cancel
          </Button>
          <Button variant="destructive" @click="confirmClose = false; setSwitch({ uploadsOpen: false }, 'uploads')">
            Close uploads
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  </main>
</template>
