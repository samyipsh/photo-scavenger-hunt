<script setup lang="ts">
import { nextTick, onMounted, ref } from 'vue'
import { CheckIcon, ChevronRightIcon } from '@lucide/vue'

// A long list to choose one from, in sections, inside a sheet. Rows run to the content's edges
// (their tap area spills into the gutter), each can carry its points as the green pill (filled
// once the group has them) or a short note, and the current one is ticked. One that opens a
// second step (`next`: naming an animal or colour) ends in a chevron, after any pill. A filter
// sheet scrolls the current one into view; a sheet for moving a photo starts at the top, since
// the current challenge is the one being left. Plain buttons, one tap picks: no listbox roles,
// which would promise arrow-key moves.
export interface SheetOption { value: string, label: string, short?: string, points?: number, earned?: boolean, note?: string, next?: boolean }
// `type` is the kind of challenge a section holds, for callers that add to one.
export interface SheetSection { title?: string, type?: string, options: SheetOption[] }

const props = withDefaults(defineProps<{ sections: SheetSection[], label: string, current?: string, disabled?: boolean, scrollToCurrent?: boolean }>(), { scrollToCurrent: true })
const emit = defineEmits<{ pick: [option: SheetOption] }>()

const list = ref<HTMLElement | null>(null)
onMounted(async () => {
  if (!props.scrollToCurrent) return
  await nextTick()
  list.value?.querySelector('[aria-current="true"]')?.scrollIntoView({ block: 'center' })
})
</script>

<template>
  <div ref="list" role="group" :aria-label="label" class="-mx-4 min-h-0 overflow-y-auto overscroll-contain px-4 pb-1">
    <div v-for="(s, i) in sections" :key="i" role="group" :aria-label="s.title">
      <!-- Section titles stay at the top while their rows scroll under them. -->
      <p v-if="s.title" class="sticky top-0 z-10 bg-popover pb-1 pt-4 text-base font-semibold text-muted-foreground" aria-hidden="true">
        {{ s.title }}
      </p>
      <button
        v-for="o in s.options" :key="o.value" type="button" :aria-current="o.value === current ? 'true' : undefined"
        class="-mx-3 flex min-h-12 w-[calc(100%+1.5rem)] items-center gap-3 rounded-xl px-3 py-2 text-left text-base active:bg-muted disabled:opacity-50"
        :class="o.value === current && 'font-semibold'" :disabled="disabled"
        @click="emit('pick', o)"
      >
        <span class="min-w-0 flex-1">{{ o.label }}</span>
        <span v-if="o.note" class="shrink-0 text-muted-foreground">{{ o.note }}</span>
        <QuestPointsPill v-else-if="o.points" :points="o.points" :earned="o.earned" />
        <span v-if="o.earned" class="sr-only">, already earned</span>
        <CheckIcon v-if="o.value === current" class="size-5 shrink-0 text-primary" aria-hidden="true" />
        <ChevronRightIcon v-else-if="o.next" class="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
      </button>
    </div>
  </div>
</template>
