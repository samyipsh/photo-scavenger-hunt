<script setup lang="ts">
import { MapPinIcon } from '@lucide/vue'
import { EVENT, GROUP_COUNT } from '~~/data/event'
import { GUIDE } from '~~/data/guide'
import { mapsSearchUrl } from '~/utils/maps'

// The participant guide, from Help › Misc: the morning's timeline, then scoring. All of it is in
// data/guide.ts and the app's own files, so it shows without signal.
useHead({ title: `${GUIDE.title} · ${EVENT.appName}` })
const last = GUIDE.timeline.length - 1
</script>

<template>
  <main class="mx-auto min-h-dvh max-w-lg px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-2">
    <CommitteeHeader :title="GUIDE.title" back="/help" />
    <p class="text-base text-muted-foreground">
      {{ EVENT.dateLabel }} · {{ EVENT.venue }}
    </p>
    <p class="mt-3 text-base">
      {{ GUIDE.quest }}
    </p>

    <section class="mt-8" aria-labelledby="timeline">
      <h2 id="timeline" class="text-xl font-bold">
        Timeline
      </h2>
      <!-- The morning as a rail: the time, then a dot on the line. The rounds get a filled dot.
           Each place opens in Google Maps; its link reaches 44 px tall without spacing the rows. -->
      <ol class="mt-3">
        <li v-for="(row, i) in GUIDE.timeline" :key="row.time" class="grid grid-cols-[3rem_1fr] gap-x-3">
          <span class="text-right text-base font-bold tabular-nums">{{ row.time }}</span>
          <div class="relative min-w-0 pl-6" :class="i < last && 'pb-5'">
            <span class="absolute left-[5px] w-0.5 bg-border" :class="[i === 0 ? 'top-3' : 'top-0', i === last ? 'h-3' : 'bottom-0']" aria-hidden="true" />
            <span class="absolute left-0 top-1.5 size-3 rounded-full border-2 border-primary" :class="row.main ? 'bg-primary' : 'bg-background'" aria-hidden="true" />
            <p class="text-base">
              {{ row.what }}
            </p>
            <a v-if="row.where" :href="mapsSearchUrl(row.where.map)" target="_blank" rel="noopener" class="-my-2.5 inline-flex items-center gap-1.5 py-2.5 text-base font-medium text-primary active:opacity-70">
              <MapPinIcon class="size-4 shrink-0" aria-hidden="true" />{{ row.where.name }}
            </a>
          </div>
        </li>
      </ol>
    </section>

    <section class="mt-8" aria-labelledby="scoring">
      <h2 id="scoring" class="text-xl font-bold">
        Scoring
      </h2>
      <p class="mt-2 text-base">
        {{ GUIDE.scoringIntro }}
      </p>
      <StationPoints :groups="GROUP_COUNT" class="mt-4" />
      <p v-for="line in GUIDE.scoring" :key="line" class="mt-2 text-base">
        {{ line }}
      </p>
    </section>
  </main>
</template>
