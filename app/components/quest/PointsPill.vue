<script setup lang="ts">
// A challenge's points, the same on every row and sheet: a green "+50" pill, filled once the
// group has earned them. After a photo that didn't count it's white with a red edge, so it
// doesn't turn muddy on the row's pink. An award race's "+100" is the same pill in gold: white
// with a tan edge while it's on offer, solid where the group holds it.
withDefaults(defineProps<{ points: number, earned?: boolean, rejected?: boolean, award?: boolean }>(), { earned: false, rejected: false, award: false })
</script>

<template>
  <span
    class="inline-flex shrink-0 items-center rounded-full px-2.5 text-base font-bold leading-7 tabular-nums"
    :class="award
      ? (earned ? 'bg-amber-400 text-amber-950' : 'bg-background text-amber-900 ring-1 ring-inset ring-yellow-700/40')
      : earned ? 'bg-primary text-primary-foreground' : rejected ? 'bg-background text-muted-foreground ring-1 ring-inset ring-destructive/40' : 'bg-primary/10 text-primary'"
  >+{{ points }}<span v-if="award" class="sr-only">{{ earned ? ' prize, held' : ' prize' }}</span></span>
</template>
