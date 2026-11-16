<script setup lang="ts">
import { computed, ref } from 'vue'
import { CameraIcon, CheckIcon, ImageUpIcon, Loader2Icon, UsersIcon, XIcon } from '@lucide/vue'
import type { QuestChallenge, QuestPhoto } from '~/types/api'
import { capitalise } from '~/utils/photoName'

const props = withDefaults(defineProps<{
  // The group's link token: an unfinished race photo is kept for this group.
  token: string
  challenge: QuestChallenge | null
  // The group's photos for it; for the animals race, every photo that adds an animal, Spot it
  // ones included (each photo's `animal`).
  photos: QuestPhoto[]
  // Those still sending, with their thumbnails once they're ready.
  uploading: { id: string, previewUrl: string | null }[]
  // Why this phone can't send now (uploads closed, this phone blocked, the group full), or null.
  cantSend: { title: string, detail?: string } | null
  animalsFound: string[]
  coloursFound: string[]
  // Every challenge and the ones the group has: an animal that's a Spot it challenge the group
  // hasn't earned is sent there for its points, and still counts for Animals spotted.
  challenges?: QuestChallenge[]
  done?: string[]
}>(), { challenges: () => [], done: () => [] })
const open = defineModel<boolean>('open', { required: true })
// `view` opens one of the photos already sent, in the photo view, to see it big or fix it.
// `pick` with a challenge sends a race photo to that Spot it challenge instead.
// `camera` opens the camera for this challenge: the page shows its photo full screen first
// (QuestShotReview), and keeps it there even if this sheet closes. A race's photo, from the
// camera or the phone, comes straight here to be named; other photos chosen from the phone go
// straight in, since they were looked at in the picker.
const emit = defineEmits<{ pick: [files: File[], label: string | null, challengeId?: string], view: [photoId: string], camera: [] }>()

const libraryInput = ref<HTMLInputElement>()
const kind = computed(() => props.challenge?.awardKind ?? null)

// An animal or flower photo is taken first, then named, then sent. Until it's sent it's a draft
// kept on the phone (useDrafts), so closing the sheet or leaving the page doesn't lose it.
// While there is one, the sheet opens on it: a new photo for that race means discarding it first.
// Naming it is the look before it goes: its thumbnail opens it full screen (QuestDraftScreen),
// where it can be cropped and turned, and its X closes back to here.
const drafts = useDrafts(() => props.token)
const draft = computed(() => kind.value && props.challenge ? drafts.get(props.challenge.id) : null)
const label = computed({
  get: () => draft.value?.label ?? '',
  set: (v: string) => {
    if (props.challenge) drafts.name(props.challenge.id, v)
  },
})

function onFiles(e: Event) {
  const input = e.target as HTMLInputElement
  const files = [...(input.files ?? [])]
  input.value = ''
  if (files.length === 0) return
  if (kind.value && props.challenge) {
    drafts.hold(props.challenge.id, kind.value, files[0]!)
    return
  }
  emit('pick', files, null)
  open.value = false
}

// Under each photo in a race's sheet: its animal or colour. A Spot it animal (a swan sent for
// Swan) has no label of its own; the animal it adds names it.
const nameOf = (p: QuestPhoto) => p.label ?? p.animal
const spots = computed(() => kind.value === 'animal' ? spotAnimals(props.challenges).filter(s => !props.done.includes(s.id)) : [])
const spot = computed(() => kind.value === 'animal' ? spotItFor(label.value, spots.value) : null)
const already = computed(() => !spot.value && !!label.value.trim() && (kind.value === 'animal' ? props.animalsFound : props.coloursFound).includes(normaliseLabel(label.value)))
const sendText = computed(() => {
  const n = label.value.trim()
  if (!n) return kind.value === 'colour' ? 'Choose a colour' : 'Pick or type a name'
  if (spot.value) return `Send for ${spot.value.title}`
  if (already.value) return 'Send anyway'
  return `Send ${capitalise(n)}${kind.value === 'colour' ? ' flower' : ''}`
})
function send() {
  const d = draft.value
  const n = label.value.trim()
  if (!d || !n || props.cantSend) return
  if (spot.value) emit('pick', [d.file], null, spot.value.id)
  else emit('pick', [d.file], n)
  drafts.discard(d.challengeId)
  open.value = false
}

// The X on the photo discards it: one from the camera asks first, as everywhere (one chosen from
// the phone is still on the phone, so it just goes). Back still closes the sheet and keeps it.
const viewing = ref(false)
useBackClose(viewing)
const { asking, dismiss, confirm } = usePhotoDiscard({
  camera: () => !!draft.value?.camera,
  discard: () => {
    const d = draft.value
    if (d) drafts.discard(d.challengeId)
  },
})

const title = computed(() => props.challenge?.title ?? 'Just a photo')
const counted = computed(() => !kind.value && !!props.challenge && props.photos.some(p => p.verdict !== 'rejected'))
const rejectedReason = computed(() => {
  if (!props.photos.length || props.photos.some(p => p.verdict !== 'rejected')) return null
  return props.photos.find(p => p.verdict === 'rejected')?.rejectReason ?? 'Doesn\'t match the challenge'
})
</script>

<template>
  <BottomSheet v-model:open="open" :title="title" content-class="max-h-[92dvh]">
    <template #title>
      <!-- The same "+50" as the challenge's row, filled once it counts, right after the title as
           in the photo view. -->
      <DrawerTitle class="text-left text-xl font-bold leading-7">
        {{ title }}<QuestPointsPill v-if="challenge?.points" :points="challenge.points" :earned="counted" class="ml-2 align-top" />
      </DrawerTitle>
    </template>

    <div class="-mx-4 min-h-0 space-y-3 overflow-y-auto px-4 pb-1 text-base">
      <p v-if="!challenge">
        Not for a challenge. It goes in the gallery and counts towards Most photos.
      </p>
      <!-- A race's rule shows until its photo is taken; then naming it takes the space. -->
      <p v-else-if="challenge.hint && !draft">
        {{ challenge.hint }}
      </p>
      <p v-if="challenge?.flavour" class="italic text-muted-foreground">
        {{ challenge.flavour }}
      </p>
      <p v-if="challenge?.whoInShot" class="flex items-center gap-2 font-medium">
        <UsersIcon class="size-5 shrink-0" aria-hidden="true" /><span><span class="sr-only">In the photo: </span>{{ challenge.whoInShot }}</span>
      </p>

      <!-- The race photo just taken, waiting for its animal or colour. Room above it for the X. -->
      <form v-if="draft" id="race-send" class="space-y-3 pt-3.5" @submit.prevent="send">
        <!-- The whole photo at its own shape, 112 px tall, so a crop shows here too. A tap opens it
             full size, as any small photo does, to crop or turn it there. -->
        <div class="relative w-fit max-w-full">
          <button type="button" class="relative block max-w-full overflow-hidden rounded-xl bg-muted active:opacity-80" aria-label="See the photo full size" @click="viewing = true">
            <img :src="draft.url" alt="" class="block h-28 w-auto max-w-full object-contain">
          </button>
          <!-- A 28 px badge on the corner, inside a 44 px tap area. -->
          <button type="button" class="absolute -right-3.5 -top-3.5 flex size-11 items-center justify-center rounded-full active:opacity-70" aria-label="Discard this photo" @click="dismiss">
            <span class="flex size-7 items-center justify-center rounded-full bg-foreground text-background ring-2 ring-background">
              <XIcon class="size-4" :stroke-width="2.5" aria-hidden="true" />
            </span>
          </button>
        </div>
        <QuestRaceLabel v-model="label" :kind="draft.kind === 'colour' ? 'colour' : 'animal'" :found="draft.kind === 'animal' ? animalsFound : coloursFound" :spots="draft.kind === 'animal' ? spots : []" />
      </form>

      <!-- The ticked thumbnails say whose photos these are; no heading needed. -->
      <div v-if="!draft && (photos.length || uploading.length)" class="space-y-2">
        <div class="flex gap-2 overflow-x-auto pb-1">
          <div v-for="p in photos" :key="p.id" class="w-20 shrink-0">
            <button type="button" class="relative block active:opacity-80" :aria-label="`Open photo${nameOf(p) ? `: ${nameOf(p)}` : ''}`" @click="emit('view', p.id)">
              <img :src="p.thumbUrl" alt="" class="size-20 rounded-lg object-cover" loading="lazy">
              <span
                class="absolute right-1 top-1 flex size-6 items-center justify-center rounded-full ring-2 ring-white"
                :class="p.verdict === 'rejected' ? 'bg-destructive text-white' : 'bg-primary text-primary-foreground'"
                :aria-label="p.verdict === 'rejected' ? 'Doesn\'t count' : 'Counts'"
              ><XIcon v-if="p.verdict === 'rejected'" class="size-4" /><CheckIcon v-else class="size-4" /></span>
            </button>
            <p v-if="kind && nameOf(p)" class="mt-0.5 line-clamp-2 text-base leading-tight">
              {{ capitalise(normaliseLabel(nameOf(p)!)) }}
            </p>
          </div>
          <!-- A photo still sending: its own thumbnail under the bottom bar's spinner. -->
          <div v-for="u in uploading" :key="u.id" class="relative size-20 shrink-0 overflow-hidden rounded-lg bg-muted" role="img" aria-label="Sending">
            <img v-if="u.previewUrl" :src="u.previewUrl" alt="" class="size-full object-cover">
            <span class="absolute inset-0 flex items-center justify-center" :class="u.previewUrl && 'bg-black/35'">
              <Loader2Icon class="size-6 animate-spin" :class="u.previewUrl ? 'text-white' : 'text-muted-foreground'" />
            </span>
          </div>
        </div>
        <!-- The verdict, in the app's one vocabulary, under the photos. The solid pill and the
             ticks already say no more points are coming. -->
        <p v-if="counted" class="font-medium text-success">
          Counts
        </p>
        <p v-else-if="rejectedReason" class="font-medium text-destructive">
          Doesn't count: {{ rejectedReason }}
        </p>
      </div>
    </div>

    <!-- Pinned under the content, so the main button stays in reach with the keyboard up. -->
    <template #footer>
      <!-- Amber, like the page's banner, and saying which of the three it is. -->
      <div v-if="cantSend" class="rounded-xl border border-warning/50 bg-warning-soft p-3 text-base" role="status">
        <p class="font-semibold">
          {{ cantSend.title }}
        </p>
        <p v-if="cantSend.detail">
          {{ cantSend.detail }}
        </p>
      </div>
      <!-- Already counted: it still sends, as a choice rather than the main action. -->
      <Button v-else-if="draft" type="submit" form="race-send" size="lg" class="w-full" :variant="already ? 'outline' : 'default'" :disabled="!label.trim()">
        {{ sendText }}
        <span v-if="spot" class="inline-flex items-center rounded-full bg-primary-foreground px-2.5 text-base font-bold leading-7 tabular-nums text-primary">+{{ spot.points }}</span>
      </Button>
      <!-- Once the challenge counts, the camera drops from solid green to a soft green: another
           photo adds no points, but it's still the first way to send one, and stays apart from
           the outlined button under it. Like the cameras on Awards, a little stronger to hold up
           in sun. -->
      <div v-else class="grid gap-2">
        <Button size="lg" :variant="counted ? 'outline' : 'default'" :class="counted && 'border-primary/40 bg-primary/15 text-primary hover:bg-primary/20 hover:text-primary'" @click="emit('camera')">
          <CameraIcon /> Take a photo
        </Button>
        <Button size="lg" variant="outline" @click="libraryInput?.click()">
          <ImageUpIcon /> Choose from your photos
        </Button>
      </div>
      <input ref="libraryInput" type="file" accept="image/*" :multiple="!kind" class="hidden" @change="onFiles">
    </template>
  </BottomSheet>
  <QuestDraftScreen
    v-if="draft" :key="draft.challengeId" v-model:open="viewing" :token="token" :draft-key="draft.challengeId"
    :title="kind === 'colour' ? 'Your flower photo' : 'Your animal photo'" close-label="Close" @close="viewing = false"
  />
  <QuestDiscardDialog v-model:open="asking" @discard="confirm" />
</template>
