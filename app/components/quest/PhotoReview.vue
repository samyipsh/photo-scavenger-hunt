<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { CameraIcon, ChevronDownIcon, FlowerIcon, PawPrintIcon, SlidersHorizontalIcon } from '@lucide/vue'
import { PHOTO_DRAFT } from '~/composables/useUploadQueue'
import { photoName } from '~/utils/photoName'
import type { QuestChallenge } from '~/types/api'

// A photo from "Take a photo", before it's sent: the photo, where it goes (just a photo unless a
// challenge is chosen, in the same picker as everywhere else), then Add to gallery. The button
// says the same whatever is chosen: the field above it names the challenge.
// The photo is a draft kept on the phone (useDrafts, under PHOTO_DRAFT), so swiping the sheet
// down or leaving the page doesn't lose it; the upload strip offers it again.
// This sheet is where the bottom bar's camera photo is first looked at, so it works like the
// full-screen check after other cameras (QuestShotReview): "Edit" by the title; the X discards,
// asking first for a camera photo (Back does the same); and a camera photo can be taken again
// ("Retake"): the camera opens at once, and the new photo takes the old one's
// place, keeping its challenge. Closing the camera without one keeps the old one.
// The photo shrinks to leave room for the challenge field on a short screen.
const props = defineProps<{
  token: string
  challenges: QuestChallenge[]
  // What the group already has, so the picker can say what won't add.
  done: string[]
  animalsFound: string[]
  coloursFound: string[]
  // Why this phone can't send now (uploads closed, this phone blocked, the group full), or null.
  cantSend: { title: string, detail?: string } | null
}>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ send: [file: File, target: { challengeId: string | null, label: string | null }] }>()

const drafts = useDrafts(() => props.token)
const draft = computed(() => drafts.get(PHOTO_DRAFT))
// Sent or deleted somewhere else: nothing left to show.
watch(draft, (d) => {
  if (!d) open.value = false
})

const picking = ref(false)
const pick = computed(() => draft.value?.pick ?? null)
const chosen = computed(() => pick.value ? props.challenges.find(c => c.id === pick.value!.challengeId) ?? null : null)
// "Swan", "Kingfisher", "Orange flower".
const placeName = computed(() => chosen.value ? photoName(chosen.value, pick.value?.label) : '')

function onPick(choice: { challengeId: string | null, label: string | null }) {
  drafts.choose(PHOTO_DRAFT, choice.challengeId ? { challengeId: choice.challengeId, label: choice.label } : null)
  picking.value = false
}
function send() {
  const d = draft.value
  if (!d || props.cantSend) return
  emit('send', d.file, { challengeId: chosen.value?.id ?? null, label: chosen.value ? pick.value?.label ?? null : null })
  drafts.discard(PHOTO_DRAFT)
}
const camera = ref<HTMLInputElement>()
function onRetake(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (file) drafts.retake(PHOTO_DRAFT, file)
}

const { cropping, cropSrc, openCrop, cropTo } = useDraftCrop(() => props.token, PHOTO_DRAFT)
// The X: a camera photo asks first, one from the phone just goes. Back does the same.
const { asking, dismiss, confirm } = usePhotoDiscard({
  camera: () => !!draft.value?.camera,
  discard: () => drafts.discard(PHOTO_DRAFT),
  active: () => open.value && !!draft.value,
})
</script>

<template>
  <BottomSheet v-model:open="open" title="New photo" content-class="max-h-[92dvh]" :dismiss="dismiss" dismiss-label="Discard photo">
    <template #title>
      <!-- "Edit" (crop and rotate) on the title's line, before the X. -->
      <div class="flex items-center justify-between gap-2">
        <DrawerTitle class="text-left text-xl font-bold leading-tight">
          New photo
        </DrawerTitle>
        <Button v-if="draft && !cantSend" variant="ghost" class="-my-2 gap-2 px-3" @click="openCrop">
          Edit <SlidersHorizontalIcon />
        </Button>
      </div>
    </template>
    <!-- A column the photo shrinks in, so the field under it always shows whole. -->
    <div v-if="draft" class="-mx-4 flex min-h-0 flex-col gap-3 px-4 pb-1">
      <!-- At its own shape, so a portrait photo has no bars beside it. -->
      <img :src="draft.url" alt="The photo to send" class="mx-auto block max-h-[46dvh] min-h-0 w-auto max-w-full shrink rounded-xl bg-muted object-contain">

      <!-- Looks like a field, opens the challenge picker; just a photo until something's chosen.
           Not while the photo can't be sent. -->
      <button
        v-if="!cantSend" type="button" class="flex min-h-12 w-full shrink-0 items-center gap-2 rounded-xl border border-input bg-background px-3 text-left text-base active:bg-muted"
        aria-haspopup="dialog" :aria-label="`Challenge: ${chosen ? placeName : 'none, just a photo'}. Change`" @click="picking = true"
      >
        <PawPrintIcon v-if="chosen?.awardKind === 'animal'" class="size-5 shrink-0" aria-hidden="true" />
        <FlowerIcon v-else-if="chosen?.awardKind === 'colour'" class="size-5 shrink-0" aria-hidden="true" />
        <span class="min-w-0 flex-1 truncate font-medium">{{ chosen ? placeName : 'Just a photo, no challenge' }}</span>
        <QuestPointsPill v-if="chosen && chosen.points" :points="chosen.points" :earned="done.includes(chosen.id)" />
        <ChevronDownIcon class="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
      </button>
    </div>

    <!-- Can't send (uploads closed, phone blocked, group full): why; the X still discards. -->
    <template #footer>
      <div v-if="cantSend" class="rounded-xl border border-warning/50 bg-warning-soft p-3 text-base" role="status">
        <p class="font-semibold">
          {{ cantSend.title }}
        </p>
        <p v-if="cantSend.detail">
          {{ cantSend.detail }}
        </p>
      </div>
      <div v-else class="grid gap-2">
        <Button size="lg" @click="send">
          Add to gallery
        </Button>
        <Button v-if="draft?.camera" size="lg" variant="outline" @click="camera?.click()">
          <CameraIcon /> Retake
        </Button>
      </div>
      <input ref="camera" type="file" accept="image/*" capture="environment" class="hidden" aria-hidden="true" tabindex="-1" @change="onRetake">
    </template>
  </BottomSheet>

  <QuestDiscardDialog v-model:open="asking" @discard="confirm" />
  <PhotoCrop v-if="draft" v-model:open="cropping" :src="cropSrc" :frame="draft.frame ?? null" :turns="draft.turns ?? 0" :crop="cropTo" />
  <PickChallengeSheet
    v-if="draft" v-model:open="picking" :challenges="challenges" :challenge-id="pick?.challengeId ?? null" :label="pick?.label ?? null"
    :thumb-url="draft.url" :done="done" :animals-found="animalsFound" :colours-found="coloursFound" @pick="onPick"
  />
</template>
