<script setup lang="ts">
import type { Overview } from '~/types/api'
import type { SavedRow } from '~/composables/useScoreQueue'
import { stations as stationSeeds } from '~~/data/event'
import { computed, onMounted, ref } from 'vue'
import { useEventListener, useResizeObserver } from '@vueuse/core'
import { CheckIcon, ClockAlertIcon } from '@lucide/vue'
import { dueGroups } from '#shared/utils/rotation'

// The scores page's raw-score grid: scored stations down, playing groups across. A cell opens a
// sheet to fix that one score in place, so the lead checking the paper sheets keeps their place;
// a station's name opens its page. A score is overdue when that group's round at the station
// has ended without one (dueGroups, the rule the station page and committee home use); games
// not played yet aren't flagged.
const props = defineProps<{ data: Overview, now: number }>()
const emit = defineEmits<{ saved: [score: { stationId: string, groupId: string, row: SavedRow }] }>()

const SHORT: Record<string, string> = Object.fromEntries(stationSeeds.map(s => [s.id, s.short]))
// Station names take 7rem: "Codenames" (91 px) plus the 16 px gutter and a little room.
// Every score column is at least 2.75rem (44 px), a full tap target. Below 420 px the grid runs
// edge to edge, so 7rem + 6 × 44 px = 376 px fits a 390 px phone; on a narrower one it scrolls
// sideways a little, with the names pinned and the cut-off edge faded.
const LABEL_REM = 7
const CELL_MIN_REM = 2.75

const groups = computed(() => props.data.groups.filter(g => !g.hidden))
const rows = computed(() => props.data.stations.filter(s => s.scored).map((s) => {
  const label = SHORT[s.id] ?? s.name
  const scores = props.data.scores.filter(c => c.stationId === s.id)
  const due = new Set(dueGroups({ slot: s.slot, groups: groups.value, scores, now: props.now, firstRoundAt: props.data.firstRoundAt }).map(g => g.id))
  return {
    id: s.id,
    name: s.name,
    label,
    cells: groups.value.map((g) => {
      const score = scores.find(c => c.groupId === g.id)
      // Missed counts as entered, with its own mark, so the grid matches the paper sheet cell
      // for cell.
      const missed = !!score?.missed
      const raw = score && !missed ? score.raw : null
      const missing = !score || (score.raw == null && !missed)
      const overdue = due.has(g.id)
      const state = raw != null ? String(raw) : missed ? 'missed' : overdue ? 'overdue' : 'no score'
      return { group: g, score, raw, missed, missing, overdue, ariaLabel: `${label}, G${g.number}: ${state}` }
    }),
  }
}))
const missingCount = computed(() => rows.value.reduce((n, r) => n + r.cells.filter(c => c.missing).length, 0))
const anyMissed = computed(() => rows.value.some(r => r.cells.some(c => c.missed)))
const overdue = computed(() => rows.value
  .map(r => ({ station: r.label, groups: r.cells.filter(c => c.overdue).map(c => `G${c.group.number}`) }))
  .filter(m => m.groups.length))
const overdueCount = computed(() => overdue.value.reduce((n, m) => n + m.groups.length, 0))
const tableWidth = computed(() => `max(100%, ${LABEL_REM + groups.value.length * CELL_MIN_REM}rem)`)

// The fade on the right shows only while there's more of the grid off to that side.
const scroller = ref<HTMLElement | null>(null)
const moreRight = ref(false)
function checkEdge() {
  const el = scroller.value
  moreRight.value = !!el && el.scrollLeft + el.clientWidth < el.scrollWidth - 1
}
useEventListener(scroller, 'scroll', checkEdge, { passive: true })
useResizeObserver(scroller, checkEdge)
onMounted(checkEdge)

// The cell being fixed. Kept after the sheet closes, so its title doesn't change as it slides away.
type Row = (typeof rows.value)[number]
type Cell = Row['cells'][number]
const sheetOpen = ref(false)
const fixing = ref<{ stationId: string, stationName: string, groupId: string, groupName: string, row: SavedRow | null } | null>(null)
function fix(r: Row, c: Cell) {
  fixing.value = {
    stationId: r.id,
    stationName: r.name,
    groupId: c.group.id,
    groupName: c.group.name,
    row: c.score ? { raw: c.score.raw, missed: c.score.missed, updatedAt: c.score.updatedAt } : null,
  }
  sheetOpen.value = true
}
</script>

<template>
  <section>
    <p v-if="missingCount === 0" class="flex items-center gap-2 text-base font-medium text-success">
      <CheckIcon class="size-5 shrink-0" /> All station scores in
    </p>
    <p v-else-if="overdueCount" class="flex gap-2 rounded-xl bg-warning-soft px-3 py-2 text-base">
      <ClockAlertIcon class="mt-0.5 size-5 shrink-0 text-warning" aria-hidden="true" />
      <span><span class="font-semibold">{{ overdueCount }} overdue</span><template v-if="overdueCount <= 6">: {{ overdue.map(m => `${m.station} ${m.groups.join(', ')}`).join(' · ') }}</template><template v-else>. See the marked cells.</template></span>
    </p>
    <!-- The frame is on a wrapper, which also scrolls the grid sideways when it can't fit: a
         card from 420 px, edge to edge below that, with lines only above and below. Only the rows
         have lines between them. Borders are on the cells (separate, not collapsed) so the pinned
         column keeps its own. -->
    <div class="relative -mx-4 min-[420px]:mx-0" :class="missingCount === 0 || overdueCount ? 'mt-2' : ''">
      <div ref="scroller" class="overflow-x-auto overscroll-x-contain border-y min-[420px]:rounded-2xl min-[420px]:border">
        <table class="table-fixed border-separate border-spacing-0 text-base" :style="{ width: tableWidth }">
          <thead>
            <tr>
              <th class="sticky left-0 z-10 border-b bg-background" :style="{ width: `${LABEL_REM}rem` }">
                <span class="sr-only">Station</span>
              </th>
              <th v-for="g in groups" :key="g.id" class="border-b px-0.5 py-2 text-center font-semibold">
                G{{ g.number }}
              </th>
            </tr>
          </thead>
          <tbody class="[&>tr:not(:last-child)>*]:border-b">
            <tr v-for="r in rows" :key="r.id">
              <th scope="row" class="sticky left-0 z-10 bg-background pl-4 pr-1 text-left font-normal">
                <NuxtLink :to="`/c/station/${r.id}`" class="flex min-h-11 items-center whitespace-nowrap active:opacity-70">{{ r.label }}</NuxtLink>
              </th>
              <td v-for="c in r.cells" :key="c.group.id" class="p-0 text-center tabular-nums" :class="c.overdue && 'bg-warning-soft'">
                <button
                  type="button" :aria-label="c.ariaLabel" aria-haspopup="dialog"
                  class="flex h-11 w-full items-center justify-center focus-visible:outline-2 focus-visible:-outline-offset-2 active:bg-muted"
                  @click="fix(r, c)"
                >
                  <template v-if="c.raw != null">{{ c.raw }}</template>
                  <span v-else-if="c.missed" class="text-muted-foreground" aria-hidden="true">×</span>
                  <ClockAlertIcon v-else-if="c.overdue" class="size-5 text-warning" aria-hidden="true" />
                  <!-- Quieter than a score, but still 3:1 on white, so it reads in the sun. -->
                  <span v-else class="text-muted-foreground/60" aria-hidden="true">–</span>
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-if="moreRight" class="pointer-events-none absolute inset-y-px right-0 w-10 bg-linear-to-l from-background to-transparent min-[420px]:right-px min-[420px]:rounded-r-2xl" aria-hidden="true" />
    </div>
    <p v-if="anyMissed" class="mt-2 text-base text-muted-foreground" aria-hidden="true">
      × Missed
    </p>

    <CommitteeScoreSheet
      v-if="fixing" v-model:open="sheetOpen" v-bind="fixing"
      @saved="row => fixing && emit('saved', { stationId: fixing.stationId, groupId: fixing.groupId, row })"
    />
  </section>
</template>
