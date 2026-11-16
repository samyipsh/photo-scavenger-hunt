<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { CameraIcon } from '@lucide/vue'
import { SHOT_DRAFT } from '~/composables/useUploadQueue'

// Straight after a challenge's camera: the photo full screen (QuestDraftScreen), before it goes
// anywhere, so a blurry shot can be taken again, cropped or turned. Under it, what it's for, Send
// and "Retake", which opens the camera at once and keeps this photo until a new one
// comes back. The X asks before discarding, and Back does the same (usePhotoDiscard). Focus
// starts on Send.
// The photo is a draft on the phone (useDrafts, under SHOT_DRAFT, with the challenge it's for),
// so taking another, switching apps or the tab being closed can't lose it; the upload strip
// offers it again. Nothing is queued or uploaded before Send, so its ID is only chosen then.
// It owns its camera input: call `take()` from a tap, so the browser lets it open the camera.
// Only the camera comes here; a photo chosen from the phone was already looked at in the picker,
// and a race's photo goes straight to its sheet to be named.
const props = defineProps<{
  token: string
  // What the photo is for ("Swan"), with its points.
  title: string
  points?: number
  earned?: boolean
}>()
const open = defineModel<boolean>('open', { required: true })
// The photo as it'll be sent (cropped, if it was), and the challenge it's for.
const emit = defineEmits<{ send: [file: File, challengeId: string | null] }>()

const drafts = useDrafts(() => props.token)
const draft = computed(() => drafts.get(SHOT_DRAFT))
// Sent or discarded: nothing left to show.
watch(draft, (d) => {
  if (!d) open.value = false
})

const input = ref<HTMLInputElement>()
// A new photo is for `target`; one from "Retake" replaces the photo on show.
let target: string | null = null
let again = false
function take(challengeId: string | null) {
  target = challengeId
  again = false
  input.value?.click()
}
function takeAnother() {
  again = true
  input.value?.click()
}
defineExpose({ take })
function onFile(e: Event) {
  const el = e.target as HTMLInputElement
  const file = el.files?.[0]
  el.value = ''
  if (!file) return
  if (again && draft.value) drafts.retake(SHOT_DRAFT, file)
  else drafts.hold(SHOT_DRAFT, 'photo', file, { camera: true, pick: target ? { challengeId: target, label: null } : null })
  open.value = true
}

function send() {
  const d = draft.value
  if (!d) return
  emit('send', d.file, d.pick?.challengeId ?? null)
  drafts.discard(SHOT_DRAFT)
}

const { asking, dismissSoon, confirm } = usePhotoDiscard({
  camera: () => true,
  discard: () => drafts.discard(SHOT_DRAFT),
  active: () => open.value && !!draft.value,
})
</script>

<template>
  <input ref="input" type="file" accept="image/*" capture="environment" class="hidden" aria-hidden="true" tabindex="-1" @change="onFile">
  <QuestDraftScreen v-model:open="open" :token="token" :draft-key="SHOT_DRAFT" :title="title" close-label="Discard photo" @close="dismissSoon">
    <!-- What it's for, then Send where the sheet's "Take a photo" was, and the camera again
         under it. -->
    <p class="text-xl font-bold leading-7">
      {{ title }}<QuestPointsPill v-if="points" :points="points" :earned="earned" class="ml-2 align-top" />
    </p>
    <div class="mt-3 grid gap-2">
      <Button size="lg" data-autofocus @click="send">
        Send
      </Button>
      <Button size="lg" variant="outline" @click="takeAnother">
        <CameraIcon /> Retake
      </Button>
    </div>
  </QuestDraftScreen>
  <QuestDiscardDialog v-model:open="asking" @discard="confirm" />
</template>
