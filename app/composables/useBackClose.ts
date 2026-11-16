import type { Ref } from 'vue'
import { isRef, onScopeDispose, watch } from 'vue'

// Android's Back closes what's open over a page, top first (the menu, a sheet, a dialog, the
// full-size photo, a sheet's second step), as Android apps do. Anything that should behave so
// opts in while it's open:
//
//   useBackClose(open)                          a v-model ref; Back sets it false
//   useBackClose(() => step !== null, goBack)   anything else, with how to close it
//
// BottomSheet opts every sheet in; dialogs and other overlays opt in where they're defined.
//
// It uses the browser's CloseWatcher, made for this: Back goes to the newest watcher instead of
// leaving the page, and nothing touches the history or the router. Chrome and Firefox have it;
// where it's missing it does nothing. iPhones have no Back button: sheets close there by swiping
// down or the X. The full-size photo and picking photos also keep history entries of their own,
// so iPhone's swipe back closes those (see PhotoViewer and the gallery).

// Not in TypeScript's DOM types yet.
interface CloseWatcherLike {
  onclose: (() => void) | null
  destroy: () => void
}
type CloseWatcherClass = new () => CloseWatcherLike

export function useBackClose(open: Ref<boolean>): void
export function useBackClose(isOpen: Ref<boolean> | (() => boolean), close: () => void): void
export function useBackClose(isOpen: Ref<boolean> | (() => boolean), close?: () => void) {
  const Watcher = import.meta.client ? (window as unknown as { CloseWatcher?: CloseWatcherClass }).CloseWatcher : undefined
  if (!Watcher) return
  const shut = close ?? (() => { (isOpen as Ref<boolean>).value = false })
  let watcher: CloseWatcherLike | null = null
  watch(() => (isRef(isOpen) ? isOpen.value : isOpen()), (now) => {
    if (now && !watcher) {
      // Watchers stack in the order overlays opened. One opened with no tap since the last was
      // made shares a Back with it (the browser's rule against trapping people on a page).
      const w = new Watcher()
      w.onclose = () => {
        if (watcher !== w) return
        watcher = null
        shut()
      }
      watcher = w
    }
    else if (!now && watcher) {
      // Closed some other way. The watcher goes a moment later: Escape closes the top overlay
      // through reka and then reaches the newest watcher too, which must be this one (and does
      // nothing) rather than the one under it.
      const w = watcher
      watcher = null
      setTimeout(() => w.destroy())
    }
  }, { immediate: true, flush: 'sync' })
  // Unmounted while open: the same, in case the Escape that closed it unmounted it.
  onScopeDispose(() => {
    const w = watcher
    watcher = null
    if (w) setTimeout(() => w.destroy())
  })
}
