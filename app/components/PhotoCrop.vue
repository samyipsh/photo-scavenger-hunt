<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useElementSize } from '@vueuse/core'
import { Loader2Icon, RotateCwSquareIcon } from '@lucide/vue'
import { toast } from 'vue-sonner'
import { type CropHandle, type CropRect, dragFrame, fitPhoto, FULL_FRAME, isFullFrame, latestOnly, turnedSize, turnFrameClockwise } from '~/utils/crop'
import { FULL_SCREEN_DIALOG } from '~/utils/fullScreen'

// Cropping and turning a photo before it's sent, taking after Google Photos: "Cancel" top left,
// "Rotate" top right, the photo, and nothing under it until something changes; then "Reset" and
// "Done" (the edit is only kept for the photo not sent yet, so it isn't "Save"), Done green and
// two thirds of the row, since it's what most people tap. Their room is kept while they're hidden,
// so the photo never jumps under a finger. Cancel leaves without changing anything, as Back does.
// The buttons sit on the page's 16 px gutter; the photo sits 32 px in on the light grey canvas
// between them, as in the check, which keeps the frame's handles clear of the phone's edge-swipe
// Back.
// A frame sits round the whole photo; its corners and edges drag to any shape, and a drag inside
// it moves it. Outside it fades into the canvas. Rotate turns the photo a quarter turn clockwise
// (the owner's choice; iOS Photos goes the other way), and the frame turns with it, so a crop
// isn't lost; Reset puts back the whole photo, upright. Done makes the copy with `crop` (a null
// frame when it's neither cropped nor turned) and applies what that returns, unless cropping was
// closed meanwhile (latestOnly), so a slow crop never lands late. `src` is always the photo as taken, so cropping again starts from the last
// frame and turn.
const props = defineProps<{ src: string, frame: CropRect | null, turns?: number, crop: (frame: CropRect | null, turns: number) => Promise<() => void> }>()
const open = defineModel<boolean>('open', { required: true })
useBackClose(open)

const rect = ref<CropRect>({ ...FULL_FRAME })
// Quarter turns anticlockwise, as crop.ts counts them (a clockwise tap adds three); the frame is
// on the photo as turned.
const turned = ref(0)
const busy = ref(false)
const gate = latestOnly()
// The frame and turn cropping opened on, to tell whether anything changed since.
const start = ref<{ rect: CropRect, turned: number }>({ rect: { ...FULL_FRAME }, turned: 0 })
watch(open, (o) => {
  if (o) {
    rect.value = { ...(props.frame ?? FULL_FRAME) }
    turned.value = props.turns ?? 0
    start.value = { rect: { ...rect.value }, turned: turned.value }
  }
  else {
    gate.cancel()
    busy.value = false
  }
}, { immediate: true })
const whole = computed(() => isFullFrame(rect.value) && turned.value === 0)
const near = (a: number, b: number) => Math.abs(a - b) < 0.001
const changed = computed(() => {
  const a = rect.value
  const b = start.value.rect
  return turned.value !== start.value.turned || !near(a.x, b.x) || !near(a.y, b.y) || !near(a.w, b.w) || !near(a.h, b.h)
})
// Each tap turns a quarter clockwise: three quarters the way `turned` counts. The frame turns too.
function rotate() {
  turned.value = (turned.value + 3) % 4
  rect.value = turnFrameClockwise(rect.value)
}
function reset() {
  turned.value = 0
  rect.value = { ...FULL_FRAME }
}

// Where the photo sits on screen, at its own shape: in the same space, with the same gutters,
// as the check's photo.
const stage = ref<HTMLElement>()
const { width: stageW, height: stageH } = useElementSize(stage)
const natural = ref<{ w: number, h: number } | null>(null)
watch(() => props.src, () => { natural.value = null })
function onLoad(e: Event) {
  const img = e.target as HTMLImageElement
  natural.value = { w: img.naturalWidth, h: img.naturalHeight }
}
const box = computed(() => {
  if (!natural.value || !stageW.value || !stageH.value) return null
  const size = turnedSize(natural.value.w, natural.value.h, turned.value)
  return fitPhoto(stageW.value, stageH.value, size.w, size.h)
})
const px = (v: number) => `${v}px`
const boxStyle = computed(() => box.value
  ? { left: px(box.value.left), top: px(box.value.top), width: px(box.value.w), height: px(box.value.h) }
  : { visibility: 'hidden' as const })
// The photo itself, at its own shape in the box once turned: centred, then turned.
const imgStyle = computed(() => {
  const b = box.value
  if (!b) return {}
  const [w, h] = turned.value % 2 ? [b.h, b.w] : [b.w, b.h]
  return { width: px(w), height: px(h), transform: `translate(-50%, -50%) rotate(${-90 * turned.value}deg)` }
})
const framePx = computed(() => box.value
  ? { left: rect.value.x * box.value.w, top: rect.value.y * box.value.h, w: rect.value.w * box.value.w, h: rect.value.h * box.value.h }
  : null)

const frameStyle = computed(() => {
  const f = framePx.value
  return f ? { left: px(f.left), top: px(f.top), width: px(f.w), height: px(f.h) } : {}
})
// Outside the frame the photo fades into the canvas.
const VEIL = { boxShadow: '0 0 0 100vmax color-mix(in oklch, var(--muted) 80%, transparent)' }

// The 44 px handles. The smallest frame is two handles across, so the corners never overlap;
// the mid-edge handles show only while a side has room for three.
const HANDLE = 44
const MIN_PX = HANDLE * 2
const HANDLES: { handle: CropHandle, x: number, y: number, cursor: string }[] = [
  { handle: 'n', x: 0.5, y: 0, cursor: 'ns-resize' },
  { handle: 's', x: 0.5, y: 1, cursor: 'ns-resize' },
  { handle: 'w', x: 0, y: 0.5, cursor: 'ew-resize' },
  { handle: 'e', x: 1, y: 0.5, cursor: 'ew-resize' },
  { handle: 'nw', x: 0, y: 0, cursor: 'nwse-resize' },
  { handle: 'ne', x: 1, y: 0, cursor: 'nesw-resize' },
  { handle: 'sw', x: 0, y: 1, cursor: 'nesw-resize' },
  { handle: 'se', x: 1, y: 1, cursor: 'nwse-resize' },
]
const shown = computed(() => {
  const f = framePx.value
  if (!f) return []
  return HANDLES.filter(h => h.handle.length === 2
    || ((h.handle === 'n' || h.handle === 's') ? f.w >= HANDLE * 3 : f.h >= HANDLE * 3))
})
// Where each handle takes a touch, in the stage: 44 px round its point, but never out in the
// 32 px gutters, where a drag in from the screen's edge is the phone's Back (Android) or swipe
// back (Safari). A handle on the photo's side edge then reaches inwards only; its mark stays put.
const hits = computed(() => {
  const b = box.value
  const f = framePx.value
  if (!b || !f) return []
  return shown.value.map((h) => {
    const x = b.left + f.left + h.x * f.w
    const y = b.top + f.top + h.y * f.h
    return { ...h, left: Math.min(Math.max(x - HANDLE / 2, 0), stageW.value - HANDLE), top: y - HANDLE / 2 }
  })
})
// Each corner is an L drawn in from its point, white with a dark edge so it shows on any photo
// and on the canvas. Mirrored for each corner.
const FLIP: Record<string, string> = { nw: 'none', ne: 'scaleX(-1)', sw: 'scaleY(-1)', se: 'scale(-1, -1)' }
const CORNER = 'M3 25 V3 H25'

let drag: { handle: CropHandle, x: number, y: number, start: CropRect, id: number } | null = null
const dragging = ref(false)
function down(e: PointerEvent, handle: CropHandle) {
  if (!box.value || drag || busy.value) return
  stage.value?.setPointerCapture(e.pointerId)
  drag = { handle, x: e.clientX, y: e.clientY, start: { ...rect.value }, id: e.pointerId }
  dragging.value = true
}
function move(e: PointerEvent) {
  const b = box.value
  if (!drag || !b || e.pointerId !== drag.id) return
  rect.value = dragFrame(drag.start, drag.handle, (e.clientX - drag.x) / b.w, (e.clientY - drag.y) / b.h, Math.min(1, MIN_PX / b.w), Math.min(1, MIN_PX / b.h))
}
function up(e: PointerEvent) {
  if (drag?.id !== e.pointerId) return
  drag = null
  dragging.value = false
}

async function save() {
  busy.value = true
  try {
    const apply = await gate.run(() => props.crop(whole.value ? null : { ...rect.value }, turned.value))
    if (!apply) return
    apply()
    open.value = false
  }
  catch {
    toast('Couldn\'t crop this photo', { id: 'crop' })
  }
  finally {
    busy.value = false
  }
}
const cancelButton = ref<{ $el: HTMLElement }>()
function focusCancel(e: Event) {
  e.preventDefault()
  cancelButton.value?.$el.focus()
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent :class="FULL_SCREEN_DIALOG" :show-close-button="false" @open-auto-focus="focusCancel">
      <DialogTitle class="sr-only">
        Edit photo
      </DialogTitle>
      <DialogDescription class="sr-only">
        Drag the corners or edges of the frame, or drag inside it to move it.
      </DialogDescription>
      <!-- Cancel's text on the left edge, Rotate's on the right. Only the buttons sit over the top
           handles that reach up into this row; the rest lets their touches through. -->
      <div class="pointer-events-none relative z-10 mx-auto flex w-full max-w-lg shrink-0 items-center justify-between px-4 pt-[env(safe-area-inset-top)]">
        <Button ref="cancelButton" variant="ghost" class="pointer-events-auto -ml-3 px-3" @click="open = false">
          Cancel
        </Button>
        <Button variant="ghost" class="pointer-events-auto -mr-3 gap-2 px-3" aria-label="Rotate clockwise" :disabled="busy" @click="rotate">
          Rotate <RotateCwSquareIcon />
        </Button>
      </div>
      <div class="relative min-h-0 flex-1 bg-muted">
        <!-- 32 px gutters, kept clear of handles (see `hits`). -->
        <div ref="stage" class="absolute inset-x-8 inset-y-4 touch-none select-none" role="group" aria-label="Crop area" @pointermove="move" @pointerup="up" @pointercancel="up">
          <!-- The photo, faded outside the frame into the canvas (a shadow round the frame,
               clipped to the photo), with thirds while a drag is on. -->
          <div class="absolute overflow-hidden bg-muted" :style="boxStyle">
            <img :src="src" alt="The photo to crop" draggable="false" class="absolute left-1/2 top-1/2 max-w-none" :style="imgStyle" @load="onLoad">
            <div class="absolute" :style="[frameStyle, VEIL]">
              <template v-if="dragging">
                <span v-for="n in 2" :key="`v${n}`" class="absolute inset-y-0 w-px bg-white/70" :style="{ left: `${n * 33.333}%` }" />
                <span v-for="n in 2" :key="`h${n}`" class="absolute inset-x-0 h-px bg-white/70" :style="{ top: `${n * 33.333}%` }" />
              </template>
            </div>
          </div>
          <!-- The frame's line, the area that moves it, and its handles' marks, over the photo but
               not clipped to it. The line is white with a dark edge either side, so it shows on
               the photo and the canvas. -->
          <div v-if="box" class="absolute" :style="boxStyle">
            <div class="absolute" :style="frameStyle">
              <div
                class="absolute inset-0 cursor-move border-2 border-white shadow-[0_0_0_1px_rgb(0_0_0/0.7),inset_0_0_0_1px_rgb(0_0_0/0.7)]"
                @pointerdown.prevent="down($event, 'move')"
              />
              <div
                v-for="h in shown" :key="h.handle"
                class="pointer-events-none absolute size-11 -translate-x-1/2 -translate-y-1/2" :style="{ left: `${h.x * 100}%`, top: `${h.y * 100}%` }"
              >
                <svg
                  v-if="h.handle.length === 2" viewBox="0 0 28 28" class="pointer-events-none absolute size-7" aria-hidden="true"
                  :class="{ 'left-1/2 top-1/2': h.handle === 'nw', 'right-1/2 top-1/2': h.handle === 'ne', 'bottom-1/2 left-1/2': h.handle === 'sw', 'bottom-1/2 right-1/2': h.handle === 'se' }"
                  :style="{ transform: FLIP[h.handle] }"
                >
                  <path :d="CORNER" fill="none" stroke="rgb(0 0 0 / 0.7)" stroke-width="7" stroke-linecap="round" stroke-linejoin="round" />
                  <path :d="CORNER" fill="none" stroke="white" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
                <span
                  v-else class="pointer-events-none absolute rounded-full bg-white shadow-[0_0_0_1.5px_rgb(0_0_0/0.7)]"
                  :class="{
                    'left-1/2 top-[23px] h-1 w-8 -translate-x-1/2': h.handle === 'n',
                    'bottom-[23px] left-1/2 h-1 w-8 -translate-x-1/2': h.handle === 's',
                    'left-[23px] top-1/2 h-8 w-1 -translate-y-1/2': h.handle === 'w',
                    'right-[23px] top-1/2 h-8 w-1 -translate-y-1/2': h.handle === 'e',
                  }"
                />
              </div>
            </div>
          </div>
          <!-- Where the handles take a touch: kept inside the stage, out of the gutters. -->
          <div
            v-for="h in hits" :key="h.handle" class="absolute size-11" :data-handle="h.handle"
            :style="{ left: px(h.left), top: px(h.top), cursor: h.cursor }" @pointerdown.prevent="down($event, h.handle)"
          />
        </div>
      </div>
      <!-- Once something changed: Reset a third of the row, but no wider than on a 412 px phone
           (123 px), and Done the rest. Kept in place while hidden, so the photo doesn't move when
           they appear. -->
      <div class="mx-auto grid w-full max-w-lg shrink-0 grid-cols-[min(calc((100%-0.75rem)/3),123px)_1fr] gap-3 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3" :class="!changed && 'invisible'">
        <Button size="lg" variant="outline" :disabled="whole || busy" @click="reset">
          Reset
        </Button>
        <Button size="lg" :disabled="busy" @click="save">
          <Loader2Icon v-if="busy" class="animate-spin" aria-hidden="true" />
          Done
        </Button>
      </div>
    </DialogContent>
  </Dialog>
</template>
