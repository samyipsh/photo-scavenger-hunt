<script setup lang="ts">
import { ChevronLeftIcon } from '@lucide/vue'

// A committee page's title, with an optional back arrow, a line above the title (the station's
// place, say) and room on the right for an action. Help's own pages (the guide, Types of Christ)
// use it too, for the same back arrow.
defineProps<{ title: string, back?: string, subtitle?: string }>()
</script>

<template>
  <header class="flex gap-2" :class="subtitle ? 'items-start' : 'items-center'">
    <!-- The 44 px button starts at the screen's edge, so all of it can be tapped. The 24 px icon
         sits 10 px inside it and the chevron's point 8 px inside the icon, so the icon is nudged
         2 px left to put the point on the 16 px content edge. -->
    <Button v-if="back" as-child variant="ghost" size="icon" class="-ml-4 shrink-0">
      <NuxtLink :to="back" aria-label="Back">
        <ChevronLeftIcon class="size-6 -translate-x-0.5" />
      </NuxtLink>
    </Button>
    <div class="min-w-0 flex-1">
      <p v-if="subtitle" class="text-base font-medium text-muted-foreground">
        {{ subtitle }}
      </p>
      <h1 class="text-2xl font-bold leading-tight">
        {{ title }}
      </h1>
    </div>
    <slot />
  </header>
</template>
