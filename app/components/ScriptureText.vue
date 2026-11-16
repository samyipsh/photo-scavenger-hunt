<script setup lang="ts">
import { parseParagraph, passageUrl } from '#shared/utils/typesOfChrist'

// One paragraph of the Types of Christ page, its marks drawn (shared/utils/typesOfChrist.ts): bold,
// and Bible references as green links. A reference whose verses came with the page shows them
// (`open`); any other opens the passage on BibleGateway. Each link's padding makes it 44 px tall
// without spacing the lines.
const props = defineProps<{ text: string, verses: Record<string, unknown> }>()
const emit = defineEmits<{ open: [passage: string] }>()
const segments = computed(() => parseParagraph(props.text))
function tap(e: MouseEvent, passage: string) {
  if (!props.verses[passage] || e.metaKey || e.ctrlKey || e.shiftKey) return
  e.preventDefault()
  emit('open', passage)
}
</script>

<template>
  <p>
    <template v-for="(s, i) in segments" :key="i">
      <strong v-if="s.kind === 'bold'" class="font-semibold">{{ s.text }}</strong>
      <a
        v-else-if="s.kind === 'ref'" :href="passageUrl(s.passage)" target="_blank" rel="noopener"
        class="whitespace-nowrap py-2.5 font-medium text-primary underline decoration-primary/40 underline-offset-4"
        :aria-haspopup="verses[s.passage] ? 'dialog' : undefined"
        @click="tap($event, s.passage)"
      >{{ s.text }}</a>
      <template v-else>
        {{ s.text }}
      </template>
    </template>
  </p>
</template>
