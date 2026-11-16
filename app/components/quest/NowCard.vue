<script setup lang="ts">
import { computed, ref } from 'vue'
import { ChevronDownIcon, MapPinIcon } from '@lucide/vue'
import { formatClock, phaseAt, ROUND_COUNT, roundEndsAt, roundStartsAt, slotFor } from '#shared/utils/rotation'
import type { QuestStation } from '~/types/api'
import { END_POINT } from '~~/data/event'
import { mapsUrl } from '~/utils/maps'

const props = defineProps<{ startSlot: number, stations: QuestStation[], now: number, firstRoundAt: number }>()

const bySlot = (slot: number) => props.stations.find(s => s.slot === slot)
const phase = computed(() => phaseAt(props.now, props.firstRoundAt))
const endsAt = computed(() => roundEndsAt(ROUND_COUNT - 1, props.firstRoundAt))

// A stop as the card shows it: its name, the line under it, and its map link. A stop without a
// fixed spot (the photo walk) has no coordinates, so no pin; its line says what to do instead.
interface Stop { name: string, line: string, map: string | null }
function stopOf(s: QuestStation | undefined): Stop | null {
  if (!s) return null
  return { name: s.name, line: s.place, map: s.lat !== null && s.lng !== null ? mapsUrl(s.lat, s.lng) : null }
}
// After the last round everyone heads to the roundup.
const roundup: Stop = { name: `Back to ${END_POINT.name}`, line: END_POINT.note, map: mapsUrl(END_POINT.lat, END_POINT.lng) }

// Where the group is now, or goes first; after the rounds, the roundup.
const here = computed(() => {
  const p = phase.value
  if (p.kind === 'before') return stopOf(bySlot(slotFor(props.startSlot, 0)))
  if (p.kind === 'round') return stopOf(bySlot(slotFor(props.startSlot, p.index)))
  return roundup
})
// "Next 10:25 am · One-syllable poetry"; in the last round, "Back to Trellis Garden".
const next = computed(() => {
  const p = phase.value
  if (p.kind !== 'round') return null
  if (p.index === ROUND_COUNT - 1) return { at: endsAt.value, name: `Back to ${END_POINT.short}` }
  const s = bySlot(slotFor(props.startSlot, p.index + 1))
  return s ? { at: roundStartsAt(p.index + 1, props.firstRoundAt), name: s.name } : null
})

const kicker = computed(() => {
  const p = phase.value
  if (p.kind === 'before') return `First stop · ${formatClock(p.startsAt)}`
  if (p.kind === 'round') return `Stop ${p.index + 1} of ${ROUND_COUNT}`
  return `${END_POINT.title} · ${formatClock(endsAt.value)}`
})

// Every stop in order, with the one the clock says is now highlighted, so a group that runs off
// the clock can still see where it is in the order. Stops already done shrink to their time and
// name; then the roundup, "Now" once the rounds are over.
const showAll = ref(false)
const stops = computed(() => {
  const p = phase.value
  return [
    ...Array.from({ length: ROUND_COUNT }, (_, i) => ({
      key: String(i),
      at: roundStartsAt(i, props.firstRoundAt),
      stop: stopOf(bySlot(slotFor(props.startSlot, i))),
      now: p.kind === 'round' && p.index === i,
      past: (p.kind === 'round' && i < p.index) || p.kind === 'after',
    })),
    { key: 'end', at: endsAt.value, stop: { ...roundup, line: '' }, now: p.kind === 'after', past: false },
  ]
})
</script>

<template>
  <!-- Compact, so the challenges start above the fold. The top line says where the group is in
       the order and opens the list of every stop in its place; each map pin sits on the content's
       right edge. -->
  <section class="overflow-hidden rounded-2xl border bg-card" aria-live="polite">
    <button
      type="button"
      class="flex min-h-11 w-full items-center gap-1 px-4 pt-1 text-left text-base leading-5 text-muted-foreground active:bg-muted"
      :class="showAll ? 'border-b pb-1' : '-mb-1.5'"
      :aria-expanded="showAll" @click="showAll = !showAll"
    >
      {{ kicker }}<span class="sr-only">: every stop</span>
      <ChevronDownIcon class="size-5 shrink-0 transition-transform" :class="showAll && 'rotate-180'" aria-hidden="true" />
    </button>

    <!-- Closed: where the group is now (or goes first), then the next stop below a rule. -->
    <template v-if="!showAll">
      <div v-if="here" class="flex items-center gap-2 px-4 pb-3">
        <div class="min-w-0 flex-1">
          <h2 class="text-lg font-bold leading-6 min-[380px]:text-xl">
            {{ here.name }}
          </h2>
          <p class="text-base leading-5">
            {{ here.line }}
          </p>
        </div>
        <!-- The icon's right edge on the content edge; the button keeps its 44 px. -->
        <Button
          v-if="here.map" as="a" :href="here.map" target="_blank" rel="noopener"
          variant="ghost" size="icon" class="-mr-3 shrink-0 text-muted-foreground" :aria-label="`Map: ${here.name}`"
        >
          <MapPinIcon class="size-5" />
        </Button>
      </div>
      <p v-if="next" class="border-t px-4 py-2.5 text-base leading-5 text-muted-foreground">
        Next {{ formatClock(next.at) }} · {{ next.name }}
      </p>
    </template>

    <!-- Open: every stop edge to edge, each a link to its map when it has a place. -->
    <ol v-else class="divide-y">
      <li v-for="s in stops" :key="s.key">
        <component
          :is="s.stop?.map && !s.past ? 'a' : 'div'" v-if="s.stop"
          :href="s.stop.map && !s.past ? s.stop.map : undefined" :target="s.stop.map && !s.past ? '_blank' : undefined" rel="noopener"
          class="flex min-h-12 items-start gap-3 px-4 py-2.5"
          :class="[s.now ? 'bg-foreground/7' : '', s.stop.map && !s.past ? 'active:bg-muted' : '', s.past ? 'text-muted-foreground' : '']"
          :aria-current="s.now ? 'step' : undefined"
        >
          <!-- "Now" in place of the time, as the station page says "Playing now". 72 px fits the
               widest time ("11:45 am"), so a 390 px phone keeps the photo walk's line to one. -->
          <span class="w-[4.5rem] shrink-0 text-base leading-tight tabular-nums" :class="s.now ? 'font-semibold' : s.past ? '' : 'text-muted-foreground'">{{ s.now ? 'Now' : formatClock(s.at) }}</span>
          <span class="min-w-0 flex-1">
            <span class="block text-base leading-tight" :class="!s.past && 'font-semibold'">{{ s.stop.name }}</span>
            <span v-if="!s.past && s.stop.line" class="block text-base text-muted-foreground">{{ s.stop.line }}</span>
          </span>
          <MapPinIcon v-if="s.stop.map && !s.past" class="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-label="map" />
        </component>
      </li>
    </ol>
  </section>
</template>
