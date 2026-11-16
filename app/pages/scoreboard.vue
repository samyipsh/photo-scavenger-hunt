<script setup lang="ts">
import type { PublicScoreboard } from '~/types/api'
import { FLOWER_COLOURS } from '#shared/utils/awards'
import { COLOURS_CHALLENGE } from '~~/data/challenges'
import { EVENT } from '~~/data/event'
import { computed, nextTick, ref, watch } from 'vue'
import { ChevronDownIcon, ChevronRightIcon, LockIcon, RefreshCwIcon, SquareArrowUpRightIcon, TrophyIcon, WifiOffIcon } from '@lucide/vue'
import { NuxtLink } from '#components'
import { formatClock } from '#shared/utils/rotation'
import type { GroupStanding, Scoreboard } from '#shared/utils/scoring'

// A refresh that fails keeps the scores showing (useLastGood), with a line saying so.
const { data: fresh, error, refresh } = await useFetch<PublicScoreboard>('/api/scoreboard', { lazy: true, timeout: 10_000 })
const data = useLastGood(fresh, error)
useVisibleInterval(() => refresh(), 15_000)
const mine = ref<MyGroup | null>(null)
onMounted(() => {
  mine.value = readMyGroup()
})
useHead({ title: `Scoreboard · ${EVENT.appName}` })

// A link from a group's page (`?group=g3`) opens that group's breakdown, brought into view once
// the scores first load (a group placed low would otherwise open below the fold).
const route = useRoute()
const open = ref<string | null>(typeof route.query.group === 'string' ? route.query.group : null)
let scrolled = false
watch(data, (d) => {
  if (!d || !open.value || scrolled) return
  scrolled = true
  nextTick(() => document.getElementById(`standing-${open.value}`)?.scrollIntoView({ block: 'nearest' }))
}, { immediate: true })
// This phone's group. Older phones remembered only the name.
const isMine = (g: GroupStanding) => !!mine.value && (mine.value.id ? mine.value.id === g.id : mine.value.name === g.name)
const groupName = (id: string) => data.value?.groups.find(g => g.id === id)?.name ?? ''
// Leaders by number, "Group 3" or "Groups 1, 3 and 5", so the line fits beside the prize at 360.
const numberOf = (id: string) => data.value?.groups.find(g => g.id === id)?.number ?? 0
function leaderText(ids: string[]) {
  if (ids.length === 1) return `Group ${numberOf(ids[0]!)}`
  return `Groups ${new Intl.ListFormat('en-GB', { type: 'conjunction' }).format(ids.map(numberOf).sort((x, y) => x - y).map(String))}`
}
const best = (pick: (g: GroupStanding) => number) => Math.max(0, ...(data.value?.groups ?? []).map(pick))

// Each race opens a group's photos for it in the gallery. The names match the group page's Awards
// tab and the gallery. A board saved before Most liked photo was dropped still has that race; only
// these are shown.
const AWARDS = [
  { key: 'animals', title: 'Most animals spotted', unit: 'animal', count: (g: GroupStanding) => g.animals.length, link: (g: GroupStanding) => `/gallery?group=${g.id}&challenge=animals` },
  { key: 'colours', title: 'Most flower colours', unit: 'colour', count: (g: GroupStanding) => g.colours.length, link: (g: GroupStanding) => `/gallery?group=${g.id}&challenge=${COLOURS_CHALLENGE}` },
  { key: 'photos', title: 'Most photos', unit: 'photo', count: (g: GroupStanding) => g.photoCount, link: (g: GroupStanding) => `/gallery?group=${g.id}` },
] as const
type AwardKey = typeof AWARDS[number]['key']
const plural = (n: number, unit: string) => `${n} ${unit}${n === 1 ? '' : 's'}`
// Each race: who leads and with how many, then, for this phone's group, where it stands: leading
// (or tied for the lead), or how far behind. Nothing about second place. One leader opens their
// photos; a tie opens a sheet of the joint leaders, each opening theirs.
const awards = computed(() => {
  const groups = data.value?.groups ?? []
  return data.value
    ? AWARDS.map((a) => {
        const leaders = data.value!.awardLeaders[a.key] ?? []
        const top = best(a.count)
        const me = groups.find(isMine)
        const chase = me && !leaders.includes(me.id) && top > 0 ? `You're ${top - a.count(me)} behind` : ''
        const leaderGroups = leaders.map(id => groups.find(g => g.id === id)).filter((g): g is GroupStanding => !!g)
        return { key: a.key as AwardKey, title: a.title, unit: a.unit, leaders, leaderGroups, best: top, chase, mineLeads: leaderGroups.some(isMine), to: leaderGroups.length === 1 ? a.link(leaderGroups[0]!) : null, links: leaderGroups.map(g => ({ id: g.id, name: g.name, to: a.link(g), mine: isMine(g) })) }
      })
    : []
})
// The joint leaders of a tied race, in a sheet.
const tieOpen = ref(false)
const tieKey = ref<AwardKey | null>(null)
const tie = computed(() => awards.value.find(a => a.key === tieKey.value) ?? null)
function openTie(key: AwardKey) {
  tieKey.value = key
  tieOpen.value = true
}
// The award races a group holds, for its breakdown: each with its count and its prize (counted in
// its photo points), opening its photos for that race. Races it doesn't hold aren't listed there.
const heldRaces = (g: GroupStanding) => AWARDS.filter(a => data.value?.awardLeaders[a.key]?.includes(g.id) && data.value.awardBonus[a.key]).map(a => ({
  key: a.key,
  title: a.title,
  // Bare counts, short enough to share a 360 px line with the prize.
  count: String(a.count(g)),
  aria: a.key === 'colours' ? `${g.colours.length} of ${FLOWER_COLOURS.length} colours` : plural(a.count(g), a.unit),
  prize: data.value!.awardBonus[a.key],
  to: a.link(g),
}))
const medal = (place: number) => place === 1 ? 'bg-amber-400 text-amber-950' : place === 2 ? 'bg-zinc-300 text-zinc-900' : place === 3 ? 'bg-orange-300 text-orange-950' : 'bg-muted text-foreground'
// Tied totals are split on photo points; say so, so nobody wonders why.
function tieNote(g: GroupStanding) {
  const tied = (data.value?.groups ?? []).filter(o => o.id !== g.id && o.total === g.total)
  if (tied.length === 0) return ''
  return tied.every(o => o.place === g.place) ? 'Tied' : 'Tied on points, split on photo points'
}
const ordinal = (n: number) => `${n}${n % 10 === 1 && n % 100 !== 11 ? 'st' : n % 10 === 2 && n % 100 !== 12 ? 'nd' : n % 10 === 3 && n % 100 !== 13 ? 'rd' : 'th'}`
const fmt = (n: number | null) => n === null ? '–' : Number.isInteger(n) ? String(n) : n.toFixed(1)
</script>

<template>
  <main class="mx-auto min-h-dvh max-w-lg px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-2">
    <!-- The title, with "● Live" on its right while the scores update. -->
    <div class="flex items-center justify-between gap-3">
      <h1 class="text-2xl font-bold leading-tight">
        Scoreboard
      </h1>
      <p v-if="data && !data.frozenAt && !error && data.provisional" class="flex items-center gap-2 text-base text-muted-foreground">
        <span class="size-2 rounded-full bg-primary" aria-hidden="true" />Live
      </p>
    </div>

    <!-- A failed refresh keeps the scores already showing; only a first load that fails says so. -->
    <div v-if="error && !data" class="mt-8 text-center">
      <p class="text-base">
        The scoreboard couldn't load. Check your signal.
      </p>
      <Button class="mt-3" @click="refresh()">
        Try again
      </Button>
    </div>

    <!-- The same shape as the loaded page: the status line, then rows as tall as a group's. -->
    <div v-else-if="!data" aria-busy="true">
      <div class="mt-5 space-y-3">
        <Skeleton v-for="n in 6" :key="n" class="h-[72px] w-full rounded-2xl" />
      </div>
    </div>

    <template v-else>
      <Alert v-if="data.frozenAt" class="mt-4 border-primary/40">
        <LockIcon />
        <AlertTitle>Scores locked at {{ formatClock(data.frozenAt) }}</AlertTitle>
        <AlertDescription>Final results at {{ EVENT.resultsAt }}, {{ EVENT.resultsPlace }}.</AlertDescription>
      </Alert>
      <!-- A refresh that fails keeps the last scores, and says they may be out of date. -->
      <div v-else-if="error" class="mt-3 flex items-center gap-2 text-base">
        <WifiOffIcon class="size-5 shrink-0 text-warning" aria-hidden="true" />
        <span class="min-w-0 flex-1">No signal · showing earlier scores</span>
        <Button variant="ghost" size="icon" class="-mr-2.5 shrink-0" aria-label="Try again" @click="refresh()">
          <RefreshCwIcon class="size-5" />
        </Button>
      </div>
      <p v-else-if="!data.provisional" class="mt-3 text-base font-medium">
        Final scores.
      </p>

      <ol class="mt-5 space-y-3">
        <li v-for="g in data.groups" :id="`standing-${g.id}`" :key="g.id" class="relative scroll-mt-4 rounded-2xl border" :class="isMine(g) && 'border-primary ring-1 ring-primary'">
          <span v-if="isMine(g)" class="absolute -top-3 left-3 rounded-full bg-primary px-2 text-base font-semibold leading-6 text-primary-foreground" aria-hidden="true">You</span>
          <button type="button" class="flex min-h-16 w-full items-center gap-2 p-3 text-left min-[380px]:gap-2.5" :aria-expanded="open === g.id" @click="open = open === g.id ? null : g.id">
            <span class="flex size-9 shrink-0 items-center justify-center rounded-full text-lg font-bold" :class="medal(g.place)">{{ g.place }}</span>
            <span class="min-w-0 flex-1">
              <span class="block text-lg font-bold leading-tight">{{ g.name }}<span v-if="isMine(g)" class="sr-only"> (your group)</span></span>
              <span class="block text-base text-muted-foreground">{{ g.photoTotal }} photo pts</span>
              <span v-if="tieNote(g)" class="block text-base font-medium text-foreground">{{ tieNote(g) }}</span>
            </span>
            <!-- The total sits level with the place and the chevron, centred on the row. -->
            <span class="shrink-0 text-right text-2xl font-bold tabular-nums">{{ fmt(g.total) }}</span>
            <ChevronDownIcon class="size-5 shrink-0 text-muted-foreground transition-transform" :class="open === g.id && 'rotate-180'" />
          </button>
          <div v-if="open === g.id" class="border-t px-3 pt-2" :class="heldRaces(g).length ? 'pb-1.5' : 'pb-3'">
            <!-- Every station, then the photo points and what makes them up. Points and prizes sit
                 flush right in one column (numbers padded so their digits end where a prize pill's
                 do). Challenges has a small square arrow after its name, as it opens its photos; each
                 award held follows as its own gold tile, a trophy on its left. -->
            <div class="grid grid-cols-[1fr_auto] items-center gap-x-2 text-base">
              <template v-for="s in data.stations" :key="s.id">
                <span class="flex min-h-11 items-center">{{ s.name }}</span>
                <span class="pr-2.5 text-right tabular-nums">
                  <span v-if="g.stationPlaces[s.id]" class="text-muted-foreground">{{ ordinal(g.stationPlaces[s.id]!) }} · </span>
                  {{ g.missed.includes(s.id) ? `${fmt(g.stationPoints[s.id] ?? null)} (missed)` : fmt(g.stationPoints[s.id] ?? null) }}
                </span>
              </template>
              <!-- Photo points: the challenges' points, plus the prize for each award race this group
                   leads. The races sit under it with their counts; a prize shows only where it's held. -->
              <p class="col-span-2 mt-2 grid grid-cols-subgrid items-center border-t pt-2 font-semibold">
                <span class="flex min-h-11 items-center">Photo points</span>
                <span class="pr-2.5 text-right tabular-nums">{{ fmt(g.photoTotal) }}</span>
              </p>
              <!-- No photos yet, no link: there's nothing to open, as with the race rows. -->
              <component
                :is="g.photoCount ? NuxtLink : 'div'" :to="g.photoCount ? `/gallery?group=${g.id}` : undefined"
                class="col-span-2 grid min-h-11 grid-cols-subgrid items-center" :class="g.photoCount && 'active:opacity-70'"
                :aria-label="g.photoCount ? `Challenges, ${g.challengesFound} found, ${g.photoPoints} points: see ${g.name}'s photos by challenge` : undefined"
              >
                <span>Challenges <span class="text-muted-foreground">· {{ g.challengesFound }} found</span><SquareArrowUpRightIcon v-if="g.photoCount" class="ml-1.5 inline size-4 align-[-2px] text-muted-foreground" aria-hidden="true" /></span>
                <span class="pr-2.5 text-right tabular-nums">{{ fmt(g.photoPoints) }}</span>
              </component>
              <!-- Each award it holds as its own soft gold tile: a trophy, the race and its count, and
                   the prize, flush with the points above. The tiles reach 6 px past the column and pad
                   6 px back in, 6 px from the card's sides and bottom, corners following the card's. -->
              <div v-if="heldRaces(g).length" class="col-span-2 -mx-1.5 mt-1 flex flex-col gap-1.5">
                <NuxtLink
                  v-for="a in heldRaces(g)" :key="a.key" :to="a.to" class="flex min-h-11 items-center gap-2 rounded-[10px] bg-amber-50 px-1.5 active:opacity-70"
                  :aria-label="`${a.title}, ${a.aria}, +${a.prize} prize: see ${g.name}'s photos`"
                >
                  <TrophyIcon class="size-5 shrink-0 text-amber-800" aria-hidden="true" />
                  <span class="min-w-0 flex-1">{{ a.title }} <span class="text-muted-foreground">· {{ a.count }}</span></span>
                  <QuestPointsPill award earned :points="a.prize" />
                </NuxtLink>
              </div>
            </div>
          </div>
        </li>
      </ol>

      <section class="mt-6">
        <h2 class="text-xl font-bold">
          Award races
        </h2>
        <!-- Each race: its name, who leads and with how many (a tie: the leaders, then the count on
             its own line), then where this phone's group stands; the prize on the right, level with
             the chevron. A race your group leads is unmistakable: a gold row, the prize solid (it's
             in your photo points), a trophy and "You're leading". Every race with a leader opens:
             one leader's photos, or a sheet of the joint leaders. The rows are spaced like the
             group cards above, so the prizes end where the totals do and the chevrons line up;
             a race with no leader yet keeps its chevron, faint. -->
        <ul class="mt-2 divide-y overflow-hidden rounded-2xl border">
          <li v-for="a in awards" :key="a.key" :class="a.mineLeads && 'bg-amber-50'">
            <component
              :is="a.to ? NuxtLink : a.leaders.length > 1 ? 'button' : 'div'" :to="a.to ?? undefined" :type="!a.to && a.leaders.length > 1 ? 'button' : undefined"
              class="flex w-full items-center gap-2 px-3 py-2.5 text-left min-[380px]:gap-2.5" :class="a.leaders.length && 'active:bg-muted'"
              @click="!a.to && a.leaders.length > 1 && openTie(a.key)"
            >
              <span class="min-w-0 flex-1">
                <!-- A race your group leads: the trophy left of its name, as in the breakdown. -->
                <span class="flex items-center gap-2 text-base font-semibold">
                  <TrophyIcon v-if="a.mineLeads" class="size-5 shrink-0 text-amber-800" aria-hidden="true" />{{ a.title }}
                </span>
                <!-- Leading alone: one line, "You're leading · 3 colours", since the leader is you.
                     Tied: the joint leaders, then "You're tied for the lead". -->
                <span v-if="a.mineLeads && a.leaders.length === 1" class="block text-base font-semibold text-amber-800">
                  You're leading · <span class="whitespace-nowrap tabular-nums">{{ plural(a.best, a.unit) }}</span>
                </span>
                <template v-else>
                  <template v-if="a.leaders.length > 1">
                    <span class="block text-base">{{ leaderText(a.leaders) }}</span>
                    <span class="block text-base tabular-nums">{{ plural(a.best, a.unit) }} each</span>
                  </template>
                  <span v-else-if="a.leaders.length" class="block text-base">
                    {{ leaderText(a.leaders) }} · <span class="whitespace-nowrap tabular-nums">{{ plural(a.best, a.unit) }}</span>
                  </span>
                  <span v-else class="block text-base text-muted-foreground">No one yet</span>
                  <span v-if="a.mineLeads" class="block text-base font-semibold text-amber-800">You're tied for the lead</span>
                  <span v-else-if="a.chase" class="block text-base text-muted-foreground">{{ a.chase }}</span>
                </template>
              </span>
              <!-- The prize sits centred with the chevron: outlined while it's on offer, solid where
                   your group holds it. -->
              <QuestPointsPill v-if="data.awardBonus[a.key]" award :points="data.awardBonus[a.key]" :earned="a.mineLeads" />
              <ChevronRightIcon class="size-5 shrink-0" :class="a.leaders.length ? 'text-muted-foreground' : 'text-muted-foreground/40'" aria-hidden="true" />
            </component>
          </li>
        </ul>
      </section>

      <BottomSheet v-model:open="tieOpen" :title="tie?.title ?? ''" :description="tie ? `Tied on ${plural(tie.best, tie.unit)} · each gets +${data.awardBonus[tie.key]}` : undefined">
        <!-- The joint leaders in the app's inset list. -->
        <ul v-if="tie" class="divide-y overflow-hidden rounded-2xl border">
          <li v-for="l in tie.links" :key="l.id">
            <NuxtLink :to="l.to" class="flex min-h-14 items-center gap-3 px-4 py-2 active:bg-muted">
              <span class="min-w-0 flex-1 text-base font-semibold">{{ l.name }}<span v-if="l.mine" class="ml-2 rounded-full bg-primary px-2 align-[1px] text-base font-semibold leading-6 text-primary-foreground">You</span></span>
              <ChevronRightIcon class="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
            </NuxtLink>
          </li>
        </ul>
      </BottomSheet>
    </template>
  </main>
</template>
