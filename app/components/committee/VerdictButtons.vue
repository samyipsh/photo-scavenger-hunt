<script setup lang="ts">
import { computed, ref } from 'vue'
import { CheckIcon, Loader2Icon, XIcon } from '@lucide/vue'

// The judge's verdict, one control wherever a photo is judged: the queue, and the full-screen
// photo view. Two halves in one outline. A photo counts unless a judge says otherwise, so one
// half is always filled: Counts in green, or Doesn't count in red once rejected.
// In the queue nothing is decided yet, so both halves act and the filled Counts is the usual
// answer. Once a judge has decided (`settled`, or `rejected`), the filled half is that decision:
// tapping it again changes nothing, so it has no pressed look, only a small nod of its icon.
// `saving` puts a spinner in the half that was tapped until the decision is saved.
const props = defineProps<{ rejected?: boolean, disabled?: boolean, settled?: boolean, saving?: 'counts' | 'reject' | null }>()
const emit = defineEmits<{ counts: [], reject: [] }>()

type Side = 'counts' | 'reject'
const holds = computed<Side>(() => props.rejected ? 'reject' : 'counts')
const decided = computed(() => props.settled || props.rejected)
const nod = ref<Side | null>(null)
let nodTimer: ReturnType<typeof setTimeout> | undefined
function tap(side: Side) {
  if (props.disabled || props.saving) return
  if (decided.value && holds.value === side) {
    nod.value = side
    clearTimeout(nodTimer)
    nodTimer = setTimeout(() => { nod.value = null }, 300)
    return
  }
  if (side === 'counts') emit('counts')
  else emit('reject')
}
// The filled half, then the outline half; only a half that acts darkens under the finger.
function look(side: Side) {
  const filled = holds.value === side
  const acts = !(decided.value && filled)
  if (!filled) return 'z-0 border-border bg-background text-foreground active:bg-muted'
  const colour = side === 'counts' ? 'border-primary bg-primary text-primary-foreground' : 'border-destructive bg-destructive text-white'
  return `z-[1] ${colour} ${acts ? (side === 'counts' ? 'active:bg-primary/85' : 'active:bg-destructive/85') : 'cursor-default'}`
}
</script>

<template>
  <div role="group" aria-label="Verdict" class="flex" :class="disabled && 'opacity-50'">
    <!-- px-2 and the tighter gap keep "Doesn't count" on one line at 360 px. -->
    <button
      type="button" class="flex h-12 min-w-0 flex-1 items-center justify-center gap-2 rounded-l-lg border px-2 text-lg font-medium outline-none transition-colors focus-visible:z-[2] focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none max-[380px]:gap-1"
      :class="look('reject')" :disabled="disabled" :aria-pressed="decided ? holds === 'reject' : undefined" :aria-busy="saving === 'reject' || undefined"
      @click="tap('reject')"
    >
      <Loader2Icon v-if="saving === 'reject'" class="size-5 shrink-0 animate-spin" aria-hidden="true" />
      <XIcon v-else class="size-5 shrink-0" :class="[holds !== 'reject' && 'text-destructive', nod === 'reject' && 'verdict-nod']" aria-hidden="true" />
      Doesn't count
    </button>
    <button
      type="button" class="-ml-px flex h-12 min-w-0 flex-1 items-center justify-center gap-2 rounded-r-lg border px-2 text-lg font-medium outline-none transition-colors focus-visible:z-[2] focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none"
      :class="look('counts')" :disabled="disabled" :aria-pressed="decided ? holds === 'counts' : undefined" :aria-busy="saving === 'counts' || undefined"
      @click="tap('counts')"
    >
      <Loader2Icon v-if="saving === 'counts'" class="size-5 shrink-0 animate-spin" aria-hidden="true" />
      <CheckIcon v-else class="size-5 shrink-0" :class="[holds !== 'counts' && 'text-primary', nod === 'counts' && 'verdict-nod']" aria-hidden="true" />
      Counts
    </button>
  </div>
</template>

<style scoped>
.verdict-nod {
  animation: verdict-nod 300ms ease-out;
}
@keyframes verdict-nod {
  40% { transform: scale(1.3); }
}
</style>
