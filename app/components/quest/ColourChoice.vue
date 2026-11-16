<script setup lang="ts">
import { CheckIcon } from '@lucide/vue'
import { RadioGroupItem, RadioGroupRoot } from 'reka-ui'
import { FLOWER_COLOURS, FLOWER_SWATCH as SWATCH } from '#shared/utils/awards'
import { capitalise } from '~/utils/photoName'

// Pick a flower colour from swatches. Each tile carries a radio mark in its corner, filled for
// the chosen one, so the choice can't be mistaken for the small grey tick on a colour the group
// already has. Reka's radio group, so the arrow keys move between colours as a radio group
// promises.
withDefaults(defineProps<{ found?: string[] }>(), { found: () => [] })
const label = defineModel<string>({ required: true })

</script>

<template>
  <!-- Every row the same height; the chosen tile gets a green edge, tint and a filled radio mark. -->
  <RadioGroupRoot
    :model-value="label" class="grid auto-rows-fr grid-cols-3 gap-2" aria-label="Flower colour" loop
    @update:model-value="v => label = String(v)"
  >
    <RadioGroupItem
      v-for="c in FLOWER_COLOURS" :key="c" :value="c"
      class="group relative flex min-h-16 flex-col items-center justify-center gap-1.5 rounded-xl border border-border/70 px-1 py-2 text-center text-base font-medium leading-5 outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 active:bg-muted data-[state=checked]:border-primary data-[state=checked]:bg-primary/10 data-[state=checked]:font-semibold data-[state=checked]:text-primary data-[state=checked]:ring-1 data-[state=checked]:ring-primary"
    >
      <span class="absolute left-2 top-2 flex size-5 items-center justify-center rounded-full border-2 border-border bg-background group-data-[state=checked]:border-primary group-data-[state=checked]:bg-primary" aria-hidden="true">
        <span class="hidden size-2 rounded-full bg-primary-foreground group-data-[state=checked]:block" />
      </span>
      <span class="relative size-7 shrink-0 rounded-full border border-black/15" :style="{ background: SWATCH[c] }" aria-hidden="true">
        <span v-if="found.includes(c)" class="absolute -bottom-1 -right-1.5 flex size-4 items-center justify-center rounded-full bg-muted-foreground text-background ring-2 ring-background">
          <CheckIcon class="size-3" :stroke-width="3" />
        </span>
      </span>
      <span>{{ capitalise(c) }}<span v-if="found.includes(c)" class="sr-only">, already counted</span></span>
    </RadioGroupItem>
  </RadioGroupRoot>
</template>
