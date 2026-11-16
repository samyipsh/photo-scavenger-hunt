<script setup lang="ts">
import type { Overview } from '~/types/api'
import { EVENT, stations as stationSeeds } from '~~/data/event'
import { computed, ref, watch } from 'vue'
import { ChevronRightIcon, ClipboardListIcon, ClockAlertIcon, EyeOffIcon, ListChecksIcon, LogOutIcon, PawPrintIcon, ScanEyeIcon, SlidersHorizontalIcon, TriangleAlertIcon, UsersIcon, WifiOffIcon } from '@lucide/vue'
import { dueGroups, formatClock, phaseAt, playingAt, roundsEndedAt } from '#shared/utils/rotation'

useHead({ title: `Committee · ${EVENT.appName}` })
const route = useRoute()
const { loggedIn, fetch: fetchSession, clear } = useUserSession()
// The public demo shows its passphrase, so anyone can try these pages.
const demo = useDemo()

const passphrase = ref('')
const signingIn = ref(false)
const signInError = ref('')
// A wrong passphrase stops looking wrong as soon as it's changed.
watch(passphrase, () => {
  signInError.value = ''
})
async function signIn() {
  signingIn.value = true
  signInError.value = ''
  try {
    await $fetch('/api/committee/login', { method: 'POST', body: { passphrase: passphrase.value } })
    await fetchSession()
    passphrase.value = ''
    const next = typeof route.query.next === 'string' && route.query.next.startsWith('/c') ? route.query.next : null
    if (next) await navigateTo(next, { replace: true })
  }
  catch (err) {
    signInError.value = errorText(err)
  }
  finally {
    signingIn.value = false
  }
}

const { data: fresh, refresh, error, status } = await useFetch<Overview>('/api/committee/overview', { lazy: true, immediate: false, timeout: 15_000, headers: { 'x-device-id': deviceId() } })
// A refresh that fails keeps the last overview that loaded (useLastGood) and says it may be out
// of date, rather than turning into the error page.
const data = useLastGood(fresh, error)
useSignInAgain(error)
watch(loggedIn, v => v && refresh(), { immediate: true })
// Keeps the counts and round times current while the page is open (another lead may move them).
useVisibleInterval(() => loggedIn.value && refresh(), 30_000)

const SHORT: Record<string, string> = Object.fromEntries(stationSeeds.map(s => [s.id, s.short]))
const now = useClock(30_000)
// Each scored station with every score due there, oldest first, and who's playing there now.
const stationRows = computed(() => {
  const d = data.value
  if (!d) return []
  const groups = d.groups.filter(g => !g.hidden)
  return d.stations.filter(s => s.scored).map((s) => {
    const due = dueGroups({ slot: s.slot, groups, scores: d.scores.filter(r => r.stationId === s.id), now: now.value, firstRoundAt: d.firstRoundAt })
    const playing = playingAt(s.slot, groups, now.value, d.firstRoundAt)
    return {
      ...s,
      due: due.length,
      dueGroups: due,
      line: due.length > 1 ? `${due.length} scores due` : due[0] ? `Due: ${due[0].name}` : playing ? `Now: ${playing.name}` : s.place,
    }
  })
})

// A save this phone is still sending, or a score typed and not saved (composables/useScoreQueue.ts).
const queued = computed(() => {
  const q = scoreQueueStatus.value
  if (!q) return null
  const station = data.value?.stations.find(s => s.id === q.stationId)?.name
  const group = data.value?.groups.find(g => g.id === q.groupId)?.name
  return { ...q, where: [station, group].filter(Boolean).join(' · ') }
})

// What each row says, so the page reads as a dashboard. Anything off normal is amber. Overdue
// scores at one station are named, as on the scores grid ("The Mind G2 overdue").
const overdue = computed(() => stationRows.value.reduce((n, s) => n + s.due, 0))
const scoresLine = computed(() => {
  if (!data.value) return null
  const late = stationRows.value.filter(s => s.due)
  if (late.length === 1) {
    const s = late[0]!
    return { text: `${SHORT[s.id] ?? s.name} ${s.dueGroups.map(g => `G${g.number}`).join(', ')} overdue`, alert: true }
  }
  if (overdue.value) return { text: `${overdue.value} overdue`, alert: true }
  return roundsEndedAt(now.value, data.value.firstRoundAt) > 0 ? { text: 'All in', alert: false } : null
})
const beforeRounds = computed(() => !!data.value && phaseAt(now.value, data.value.firstRoundAt).kind === 'before')
// "Round 2 · ends 10:25 am", as on the Controls tab, then anything switched off, in amber. Each
// part stays whole and keeps the dot after it, so no line starts with "·".
const controlsLine = computed(() => {
  const d = data.value
  if (!d) return null
  const p = phaseAt(now.value, d.firstRoundAt)
  const phase = p.kind === 'round'
    ? [`Round ${p.index + 1}`, `ends ${formatClock(p.endsAt)}`]
    : p.kind === 'before' ? ['Round 1', `starts ${formatClock(p.startsAt)}`] : ['All rounds done']
  const off = [d.frozenAt ? 'Locked' : null, d.uploadsOpen ? null : 'Uploads closed'].filter((s): s is string => !!s)
  const parts = [...phase.map(text => ({ text, off: false })), ...off.map(text => ({ text, off: true }))]
  return parts.map((part, i) => ({ ...part, text: i < parts.length - 1 ? `${part.text} ·` : part.text }))
})
const tools = computed(() => [
  {
    to: '/c/judge',
    icon: ScanEyeIcon,
    title: 'Judge photos',
    line: data.value ? (data.value.unchecked ? `${data.value.unchecked} to check` : 'All caught up') : error.value ? 'Couldn\'t load' : 'Loading…',
    alert: false,
  },
  // Photos out of the gallery with their files kept, to unhide or delete for good.
  { to: '/c/hidden', icon: EyeOffIcon, title: 'Hidden photos', line: data.value ? (data.value.hiddenPhotos ? `${data.value.hiddenPhotos} ${data.value.hiddenPhotos === 1 ? 'photo' : 'photos'}` : 'None') : null, alert: false },
  { to: '/c/scores', icon: ClipboardListIcon, title: 'Scores', line: scoresLine.value?.text ?? null, alert: !!scoresLine.value?.alert },
  { to: '/c/scores?tab=controls', icon: SlidersHorizontalIcon, title: 'Controls', line: null, alert: false, controls: true },
  { to: '/c/scores?tab=groups', icon: UsersIcon, title: 'Groups', line: null, alert: false },
  { to: '/c/animals', icon: PawPrintIcon, title: 'Animal names', line: null, alert: false },
])

async function signOut() {
  await $fetch('/api/committee/logout', { method: 'POST' })
  await clear()
}
</script>

<template>
  <main class="mx-auto min-h-dvh max-w-lg px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-2">
    <template v-if="!loggedIn">
      <CommitteeHeader title="Committee" back="/" />
      <form class="mt-6 space-y-3" @submit.prevent="signIn">
        <p v-if="demo?.demo" class="text-base">
          Demo passphrase: <span class="font-mono font-semibold">{{ demo.passphrase }}</span>
        </p>
        <Label for="passphrase" class="text-base font-semibold">Passphrase</Label>
        <Input id="passphrase" v-model="passphrase" type="text" autocomplete="off" autocapitalize="none" autocorrect="off" spellcheck="false" enterkeyhint="go" placeholder="From the committee chat" :aria-invalid="!!signInError" aria-describedby="passphrase-error" />
        <p v-if="signInError" id="passphrase-error" class="text-base font-medium text-red-800" role="alert">
          {{ signInError }}
        </p>
        <Button type="submit" size="lg" class="w-full" :disabled="!passphrase.trim() || signingIn">
          {{ signingIn ? 'Signing in…' : 'Sign in' }}
        </Button>
      </form>
    </template>

    <template v-else>
      <CommitteeHeader title="Committee" />

      <div v-if="error && !data" class="mt-4 flex flex-col items-start gap-3">
        <p class="text-base">
          The committee page couldn't load.
        </p>
        <Button variant="outline" @click="refresh()">
          Try again
        </Button>
      </div>
      <!-- A refresh that failed after a good load: the page stays as it was, and says so. -->
      <div v-else-if="error" class="mt-4 flex min-h-12 items-center gap-3 rounded-2xl bg-warning-soft py-1 pl-4 pr-1 text-base" role="status">
        <WifiOffIcon class="size-5 shrink-0 text-warning" aria-hidden="true" />
        <p class="min-w-0 flex-1">
          <span class="whitespace-nowrap font-semibold">No signal ·</span>
          {{ ' ' }}<span class="whitespace-nowrap">may be out of date</span>
        </p>
        <Button variant="ghost" class="shrink-0 text-primary hover:text-primary" :disabled="status === 'pending'" @click="refresh()">
          Retry
        </Button>
      </div>

      <!-- Every list below is the same grouped style: a 24 px icon column, then the text column,
           so all the titles line up, inset 16 px. A station's icon shows only when a score is due
           there; otherwise its column stays empty. -->
      <NuxtLink v-if="queued" :to="queued.to" class="mt-4 flex min-h-14 items-center gap-3 rounded-2xl bg-warning-soft px-4 py-3 active:opacity-80" aria-live="polite">
        <WifiOffIcon v-if="queued.kind === 'waiting'" class="size-6 shrink-0 text-warning" />
        <TriangleAlertIcon v-else class="size-6 shrink-0 text-warning" />
        <span class="min-w-0 flex-1 text-base">
          <span class="block font-semibold">{{ queued.label }}</span>
          <span v-if="queued.where" class="block text-muted-foreground">{{ queued.where }}</span>
        </span>
        <ChevronRightIcon class="size-5 shrink-0 text-muted-foreground" />
      </NuxtLink>

      <ul class="mt-4 divide-y overflow-hidden rounded-2xl border">
        <li v-for="t in tools" :key="t.to">
          <NuxtLink :to="t.to" class="flex min-h-14 items-center gap-3 px-4 py-3 active:bg-muted">
            <component :is="t.icon" class="size-6 shrink-0 text-primary" />
            <span class="min-w-0 flex-1 text-base">
              <span class="block font-semibold">{{ t.title }}</span>
              <span v-if="t.controls && controlsLine" class="block text-muted-foreground">
                <template v-for="part in controlsLine" :key="part.text"><span class="whitespace-nowrap" :class="part.off && 'font-semibold text-warning'">{{ part.text }}</span>{{ ' ' }}</template>
              </span>
              <span v-else-if="t.line" class="block" :class="t.alert ? 'font-semibold text-warning' : 'text-muted-foreground'">{{ t.line }}</span>
            </span>
            <ChevronRightIcon class="size-5 shrink-0 text-muted-foreground" />
          </NuxtLink>
        </li>
      </ul>

      <!-- Before the rounds start, the briefing is the job at hand, so it comes before the
           stations; after that it sits at the bottom. -->
      <NuxtLink v-if="beforeRounds" to="/c/briefing" class="mt-6 flex min-h-14 items-center gap-3 rounded-2xl border px-4 py-3 active:bg-muted">
        <ListChecksIcon class="size-6 shrink-0 text-primary" />
        <span class="min-w-0 flex-1 text-base font-semibold">Briefing</span>
        <ChevronRightIcon class="size-5 shrink-0 text-muted-foreground" />
      </NuxtLink>

      <!-- Every station, with any score due there in amber. -->
      <section v-if="stationRows.length" class="mt-6">
        <h2 class="text-xl font-bold">
          Stations
        </h2>
        <ul class="mt-2 divide-y overflow-hidden rounded-2xl border">
          <li v-for="s in stationRows" :key="s.id">
            <NuxtLink :to="`/c/station/${s.id}`" class="flex min-h-14 items-center gap-3 px-4 py-3 active:bg-muted">
              <ClockAlertIcon v-if="s.due" class="size-6 shrink-0 text-warning" />
              <span v-else class="size-6 shrink-0" aria-hidden="true" />
              <span class="min-w-0 flex-1 text-base">
                <span class="block font-semibold">{{ s.name }}</span>
                <span class="block" :class="s.due ? 'font-semibold text-warning' : 'text-muted-foreground'">{{ s.line }}</span>
              </span>
              <ChevronRightIcon class="size-5 shrink-0 text-muted-foreground" />
            </NuxtLink>
          </li>
        </ul>
      </section>

      <NuxtLink v-if="!beforeRounds" to="/c/briefing" class="mt-6 flex min-h-14 items-center gap-3 rounded-2xl border px-4 py-3 active:bg-muted">
        <ListChecksIcon class="size-6 shrink-0 text-primary" />
        <span class="min-w-0 flex-1 text-base font-semibold">Briefing</span>
        <ChevronRightIcon class="size-5 shrink-0 text-muted-foreground" />
      </NuxtLink>

      <Button variant="link" class="mt-4 px-0 text-muted-foreground underline" @click="signOut">
        <LogOutIcon /> Sign out
      </Button>
    </template>
  </main>
</template>
