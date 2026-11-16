<script setup lang="ts">
import type { SavedRow, ScoreEntry } from '~/composables/useScoreQueue'
import { computed, nextTick, ref, shallowRef, watch } from 'vue'
import { WifiOffIcon } from '@lucide/vue'
import { ago } from '~/utils/time'

// One score fixed from the scores grid without leaving it: the station and group, the score,
// Missed, and Save. It goes through the same score queue as the station page
// (composables/useScoreQueue.ts), so a save with no signal keeps trying from any page, and a
// newer score from someone else is offered rather than overwritten. What's typed here stays in
// the sheet until Save, so closing it changes nothing.
const open = defineModel<boolean>('open', { required: true })
const props = defineProps<{ stationId: string, stationName: string, groupId: string, groupName: string, row: SavedRow | null }>()
const emit = defineEmits<{ saved: [row: SavedRow] }>()

const scores = useScoreQueue(() => props.stationId)
const entry = shallowRef<ScoreEntry | null>(null)
const draft = ref('')
const missed = ref(false)
const problem = ref<string | null>(null)
// Save was pressed here, so the sheet closes once that save lands.
const sent = ref(false)
const box = ref<{ $el: HTMLInputElement } | null>(null)

watch(open, async (v) => {
  if (!v) return
  // The queue may already hold a newer score, or one still sending, for this cell.
  const e = scores.sync(props.groupId, props.row ?? { raw: null, missed: false, updatedAt: null })
  entry.value = e
  draft.value = e.value
  missed.value = e.missed
  problem.value = null
  sent.value = false
  await nextTick()
  setTimeout(() => box.value?.$el.focus(), 50)
}, { immediate: true })

const changed = computed(() => !!entry.value && scores.changed({ ...entry.value, value: draft.value, missed: missed.value }))

// The saved score is selected whenever the box gets the cursor, so typing replaces it.
function selectAll() {
  const el = box.value?.$el
  if (el?.value) setTimeout(() => el.setSelectionRange(0, el.value.length))
}

function save() {
  const e = entry.value
  if (!e || e.saving || !changed.value) return
  const raw = draft.value.trim() === '' ? null : Number(draft.value.replace(',', '.'))
  if (!missed.value && (raw === null || !Number.isFinite(raw))) {
    problem.value = 'Type a number, or tap Missed.'
    return
  }
  problem.value = null
  scores.edit(e, { value: draft.value, missed: missed.value })
  sent.value = scores.save(e)
}
// Once a save from here lands, the grid gets the new score and the sheet closes. A clash or a
// refusal stays in the sheet; with no signal it says so and keeps trying.
watch(() => entry.value?.saving, (now, before) => {
  const e = entry.value
  if (!before || now || !e || !sent.value || e.pending) return
  sent.value = false
  if (e.conflict || e.failed || !e.saved) return
  emit('saved', e.saved)
  open.value = false
})
function keepTheirs() {
  const e = entry.value
  if (!e?.saved) return
  scores.keepTheirs(e)
  emit('saved', e.saved)
  open.value = false
}
function saveMine() {
  const e = entry.value
  if (!e) return
  sent.value = true
  scores.saveMine(e)
}
</script>

<template>
  <BottomSheet v-model:open="open" :title="stationName" :description="groupName">
    <div v-if="entry?.conflict" class="text-base" role="alert">
      <p>
        Someone else saved {{ entry.saved?.missed ? '"missed"' : entry.saved?.raw }} {{ entry.saved?.updatedAt ? ago(entry.saved.updatedAt) : '' }}.
      </p>
      <div class="mt-3 grid grid-cols-2 gap-2">
        <Button variant="outline" @click="keepTheirs()">
          Keep {{ entry.saved?.missed ? 'missed' : entry.saved?.raw }}
        </Button>
        <Button variant="outline" :disabled="entry.saving" @click="saveMine()">
          {{ entry.missed ? 'Save missed' : `Save my ${entry.value}` }}
        </Button>
      </div>
    </div>
    <form v-else id="score-sheet-form" @submit.prevent="save()">
      <div class="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
        <Input
          ref="box"
          :model-value="missed ? 'Missed' : draft"
          :aria-label="`${groupName} score`"
          inputmode="decimal"
          enterkeyhint="done"
          placeholder="Score"
          class="h-12 text-lg tabular-nums"
          :disabled="missed"
          :aria-invalid="!!problem"
          @update:model-value="v => { draft = String(v); problem = null }"
          @focus="selectAll"
        />
        <!-- Dark grey when on, as on the station page: green means "counts" in this app. -->
        <Button
          type="button"
          variant="outline"
          class="h-12 px-3"
          :class="missed ? 'border-muted-foreground bg-muted-foreground text-background hover:bg-muted-foreground hover:text-background' : 'text-muted-foreground'"
          :aria-pressed="missed"
          @click="missed = !missed; problem = null"
        >
          Missed
        </Button>
      </div>
      <p v-if="problem" class="mt-2 text-base font-semibold text-red-800" role="alert">
        {{ problem }}
      </p>
      <p v-else-if="entry?.failed" class="mt-2 text-base font-semibold text-red-800" role="alert">
        {{ entry.failed }}
      </p>
      <p v-else-if="entry?.pending && !entry.saving" class="mt-2 flex items-center gap-1.5 text-base font-medium text-warning" role="status">
        <WifiOffIcon class="size-5 shrink-0" aria-hidden="true" />No signal. It saves by itself.
      </p>
    </form>
    <template v-if="!entry?.conflict" #footer>
      <Button v-if="entry?.pending && !entry.saving" variant="outline" size="lg" class="w-full" @click="open = false">
        Close
      </Button>
      <Button v-else type="submit" form="score-sheet-form" size="lg" class="w-full" :disabled="!!entry?.saving || !changed">
        {{ entry?.saving ? 'Saving…' : 'Save' }}
      </Button>
    </template>
  </BottomSheet>
</template>
