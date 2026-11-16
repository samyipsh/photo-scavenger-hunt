<script setup lang="ts">
import type { SheetOption, SheetSection } from '~/components/OptionList.vue'
import { computed, ref, watch } from 'vue'
import { ChevronDownIcon } from '@lucide/vue'

// A dropdown that opens as a sheet from the bottom, in the app's own style, instead of the
// phone's built-in picker. The closed field looks like Input and shows the option's `short`
// label when it has one ("Group 3"), so two fields fit side by side. A long list gets a search
// box with `search` (its accessible name). A caller that saves each choice binds
// :model-value and @update:model-value rather than v-model, so it decides what the field shows
// (the choice being saved, or the saved one back after a failure) and a choice that failed can
// be picked again; `disabled` while it saves.
type Option = SheetOption & { short?: string }
const props = defineProps<{ sections: (Omit<SheetSection, 'options'> & { options: Option[] })[], title: string, placeholder?: string, search?: string, disabled?: boolean }>()
const model = defineModel<string>({ required: true })
const emit = defineEmits<{ change: [value: string] }>()

const open = ref(false)
const options = computed(() => props.sections.flatMap(s => s.options))
const current = computed(() => options.value.find(o => o.value === model.value) ?? null)
function pick(o: SheetOption) {
  open.value = false
  if (o.value === model.value) return
  model.value = o.value
  emit('change', o.value)
}

// Every word typed starts a word of the option, in any order: "fl col" finds Flower colours.
const query = ref('')
watch(open, () => {
  query.value = ''
})
const shown = computed(() => {
  const typed = query.value.toLowerCase().match(/[a-z0-9]+/g) ?? []
  if (!typed.length) return props.sections
  const fits = (o: Option) => {
    const have = o.label.toLowerCase().match(/[a-z0-9]+/g) ?? []
    return typed.every(t => have.some(w => w.startsWith(t)))
  }
  return props.sections.map(s => ({ ...s, options: s.options.filter(fits) })).filter(s => s.options.length)
})
</script>

<template>
  <button
    type="button" aria-haspopup="dialog" :aria-label="`${title}: ${current?.label ?? placeholder ?? ''}`"
    class="relative flex h-11 w-full min-w-0 items-center rounded-lg border border-input bg-background pl-3 pr-9 text-left text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:bg-muted disabled:opacity-50"
    :class="!current && 'text-muted-foreground'" :disabled="disabled"
    @click="open = true"
  >
    <span class="truncate">{{ current?.short ?? current?.label ?? placeholder }}</span>
    <ChevronDownIcon class="pointer-events-none absolute right-2.5 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
  </button>

  <BottomSheet v-model:open="open" :title="title">
    <Input v-if="search" v-model="query" type="search" placeholder="Search" :aria-label="search" autocomplete="off" class="mb-1 shrink-0" />
    <OptionList v-if="open" :sections="shown" :label="title" :current="model" @pick="pick" />
    <p v-if="search && !shown.length" class="py-6 text-center text-base text-muted-foreground">
      No {{ title.toLowerCase() }} called that.
    </p>
  </BottomSheet>
</template>
