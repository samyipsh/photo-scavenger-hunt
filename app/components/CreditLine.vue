<script setup lang="ts">
import { computed } from 'vue'

// A photo's credit, "Group 6 · 10:16 am · Dev". Each part stays whole and keeps the dot after
// it, so a line never starts with "·" and "Group 6" never splits across lines. A part too long
// for a line on its own is cut short rather than widen the page. Empty parts are skipped.
const props = defineProps<{ parts: (string | null | undefined)[] }>()
const shown = computed(() => props.parts.filter((p): p is string => !!p))
</script>

<template>
  <p>
    <template v-for="(part, i) in shown" :key="i">
      <span class="inline-block max-w-full truncate align-top">{{ part }}{{ i < shown.length - 1 ? ' ·' : '' }}</span>{{ i < shown.length - 1 ? ' ' : '' }}
    </template>
  </p>
</template>
