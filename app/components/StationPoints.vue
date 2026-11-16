<script setup lang="ts">
import { RANK_SCALE } from '~~/data/event'
import { placePoints } from '#shared/utils/scoring'

// What each place at a station is worth, as columns to scale like the guide site's ladder: the
// points on top, the place below. Then how a tie splits them. On the participant guide page.
const props = defineProps<{ groups: number }>()
const points = computed(() => placePoints(props.groups, RANK_SCALE))
</script>

<template>
  <div>
    <ol class="flex items-end gap-2" aria-label="Station points by place">
      <li v-for="p in points.places" :key="p.place" class="flex min-w-0 flex-1 flex-col text-center">
        <span class="text-lg font-bold tabular-nums">{{ p.points }}</span>
        <span class="mt-1 rounded-t-md border-t-[3px] border-primary bg-primary/10" :style="{ height: `${p.share * 4}rem` }" aria-hidden="true" />
        <span class="border-t pt-1 text-base text-muted-foreground">{{ p.place }}</span>
      </li>
    </ol>
    <p class="mt-4 text-base">
      Tied groups split their places' points, so two tied for first get {{ points.tiedFirst }} each.
    </p>
  </div>
</template>
