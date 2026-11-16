import { ref } from 'vue'
import { toast } from 'vue-sonner'

type Likeable = { id: string, likes: number, liked: boolean }

// Liking a photo, from the grid's heart, the photo view's heart or a double-tap on the photo.
// One request per photo at a time, each saying the state it wants, so quick taps can't race.
// `burst` counts likes for the heart animation on the big photo. A like that doesn't save is
// put back and goes to `onFailed`, so the photo view can say so beside its heart; without one,
// the grid falls back to a toast.
// Likes still being saved, shared by every screen, so a refreshed list can leave those alone.
const liking = new Set<string>()
export const likePending = (id: string) => liking.has(id)

export function useLikes(onFailed?: (p: Likeable, text: string) => void) {
  const burst = ref(0)
  async function toggleLike(p: Likeable, onlyLike = false) {
    if (onlyLike && p.liked) {
      burst.value++
      return
    }
    if (liking.has(p.id)) return
    liking.add(p.id)
    const was = { likes: p.likes, liked: p.liked }
    p.liked = !p.liked
    p.likes += p.liked ? 1 : -1
    if (p.liked) burst.value++
    try {
      Object.assign(p, await $fetch<{ likes: number, liked: boolean }>(`/api/photos/${p.id}/like`, { method: 'POST', body: { liked: p.liked }, headers: { 'x-device-id': deviceId() } }))
    }
    catch (err) {
      Object.assign(p, was)
      if (onFailed) onFailed(p, errorText(err, 'Check your signal.'))
      else toast.error(errorText(err))
    }
    finally {
      liking.delete(p.id)
    }
  }
  return { burst, toggleLike }
}
