<script lang="ts" setup>
import type { HTMLAttributes } from 'vue'
import { cn } from 'cn'

const props = defineProps<{
  class?: HTMLAttributes['class']
}>()
</script>

<template>
  <div
    data-slot="drawer-header"
    :class="cn('gap-0.5 p-4 md:gap-0.5 md:text-left flex flex-col', props.class)"
  >
    <slot />
  </div>
</template>
