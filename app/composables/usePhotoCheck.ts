import { onScopeDispose, ref, watch } from 'vue'
import { useBackClose } from '~/composables/useBackClose'
import { useDrafts } from '~/composables/useUploadQueue'
import { cropPhoto } from '~/utils/image'
import type { CropRect } from '~/utils/crop'

// What the full-screen check (QuestShotReview), the New photo sheet (QuestPhotoReview) and a
// race's sheet share about a photo that hasn't been sent yet.

// The one rule for a photo's X: a camera photo asks first ("Discard this photo?"), since it
// isn't in the phone's own photos; one chosen from the phone just goes, as nothing is lost.
// While `active`, Android's Back does what the X does.
// Escape on a computer reaches both the top dialog and the newest Back handler. So Back is
// listened for again only a moment after the question closes, and a dialog's own Escape asks a
// moment later (`dismissSoon`); otherwise one key would open the question and close it at once,
// or close it and open it again.
export function usePhotoDiscard(opts: { camera: () => boolean, discard: () => void, active?: () => boolean }) {
  const asking = ref(false)
  const listening = ref(true)
  watch(asking, (on) => {
    if (on) listening.value = false
    else setTimeout(() => { listening.value = true })
  })
  function dismiss() {
    if (opts.camera()) asking.value = true
    else opts.discard()
  }
  function confirm() {
    asking.value = false
    opts.discard()
  }
  function dismissSoon() {
    setTimeout(() => {
      if (opts.active?.()) dismiss()
    })
  }
  if (opts.active) {
    const active = opts.active
    useBackClose(() => active() && listening.value, dismiss)
  }
  return { asking, dismiss, dismissSoon, confirm }
}

// Cropping a draft (useDrafts): PhotoCrop opens on the photo as taken (`cropSrc`), so cropping
// again starts from the last frame and turn, and `cropTo` makes the cropped, turned copy (a
// null frame: the photo as taken). What it returns puts that copy in the draft, unless the photo
// was taken again meanwhile; PhotoCrop calls it only if cropping is still open.
export function useDraftCrop(token: () => string, key: string) {
  const drafts = useDrafts(token)
  const cropping = ref(false)
  const cropSrc = ref('')
  let own: string | null = null
  function free() {
    if (own) URL.revokeObjectURL(own)
    own = null
  }
  function openCrop() {
    const d = drafts.get(key)
    if (!d) return
    free()
    own = d.original ? URL.createObjectURL(d.original) : null
    cropSrc.value = own ?? d.url
    cropping.value = true
  }
  watch(cropping, (on) => {
    if (!on) free()
  })
  onScopeDispose(free)
  async function cropTo(frame: CropRect | null, turns: number) {
    const d = drafts.get(key)
    if (!d) return () => {}
    const source = d.original ?? d.file
    const file = frame ? await cropPhoto(source, frame, turns) : source
    return () => {
      const now = drafts.get(key)
      if (now && (now.original ?? now.file) === source) drafts.crop(key, file, frame, turns)
    }
  }
  return { cropping, cropSrc, openCrop, cropTo }
}
