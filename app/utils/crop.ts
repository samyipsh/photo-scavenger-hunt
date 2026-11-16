// Cropping a photo: a frame on it, in fractions of the upright photo's width and height, so the
// same frame fits the photo on screen and the photo itself whatever their sizes.

export interface CropRect { x: number, y: number, w: number, h: number }

export const FULL_FRAME: CropRect = { x: 0, y: 0, w: 1, h: 1 }

// Within a pixel or so of the whole photo: nothing to crop.
export const isFullFrame = (r: CropRect) => r.x < 0.002 && r.y < 0.002 && r.w > 0.996 && r.h > 0.996

// What a drag moves: the whole frame, one edge, or a corner (its two edges).
export type CropHandle = 'move' | 'n' | 's' | 'e' | 'w' | 'nw' | 'ne' | 'sw' | 'se'

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

// The frame after dragging `handle` by (dx, dy), in fractions of the photo. It never leaves the
// photo, and never gets narrower than minW or shorter than minH, so its handles stay apart.
export function dragFrame(start: CropRect, handle: CropHandle, dx: number, dy: number, minW: number, minH: number): CropRect {
  let { x, y, w, h } = start
  if (handle === 'move') {
    return { x: clamp(x + dx, 0, 1 - w), y: clamp(y + dy, 0, 1 - h), w, h }
  }
  const right = x + w
  const bottom = y + h
  if (handle.includes('w')) {
    x = clamp(x + dx, 0, right - minW)
    w = right - x
  }
  if (handle.includes('e')) w = clamp(w + dx, minW, 1 - x)
  if (handle.includes('n')) {
    y = clamp(y + dy, 0, bottom - minH)
    h = bottom - y
  }
  if (handle.includes('s')) h = clamp(h + dy, minH, 1 - y)
  return { x, y, w, h }
}

// The frame in whole pixels of a photo this size, at least one pixel and inside the photo.
export function framePixels(r: CropRect, width: number, height: number) {
  const x = clamp(Math.round(r.x * width), 0, width - 1)
  const y = clamp(Math.round(r.y * height), 0, height - 1)
  return {
    x,
    y,
    w: clamp(Math.round(r.w * width), 1, width - x),
    h: clamp(Math.round(r.h * height), 1, height - y),
  }
}

// A photo of this size at its own shape, as big as fits in the space, centred.
export function fitPhoto(spaceW: number, spaceH: number, photoW: number, photoH: number) {
  const scale = Math.min(spaceW / photoW, spaceH / photoH)
  const w = photoW * scale
  const h = photoH * scale
  return { left: (spaceW - w) / 2, top: (spaceH - h) / 2, w, h }
}

// Rotation, counted in quarter turns anticlockwise. The Rotate button turns clockwise, which is
// three of these (PhotoCrop).
// `turns` is how many (0 to 3). The frame is always in fractions of the photo as it shows,
// turned; these map it back to the photo as taken, to draw from.

// The photo's size once turned: width and height swap on a quarter or three-quarter turn.
export const turnedSize = (width: number, height: number, turns: number) => turns % 2 ? { w: height, h: width } : { w: width, h: height }

// The same area of the photo once it turns a quarter clockwise, as Rotate turns it: a point
// (x, y) goes to (1 - y, x), so the frame's width and height swap.
export const turnFrameClockwise = (r: CropRect): CropRect => ({ x: 1 - r.y - r.h, y: r.x, w: r.h, h: r.w })

// A frame on the photo turned `turns` quarter turns anticlockwise, as the same area of the photo
// as taken. One quarter turn anticlockwise takes a point (x, y) of the photo to (y, 1 - x), so
// stepping back is a quarter clockwise; more turns step back one at a time.
export function unturnFrame(r: CropRect, turns: number): CropRect {
  let f = { ...r }
  for (let i = 0; i < ((turns % 4) + 4) % 4; i++) f = turnFrameClockwise(f)
  return f
}

// How to make the crop from a photo as taken, `width` × `height` pixels: the area to draw from
// (whole pixels), the size of the result once turned and fitted within `edge` on its long side,
// and the angle to turn it by (anticlockwise, in radians, as a canvas takes it negated).
export function cropPlan(frame: CropRect, turns: number, width: number, height: number, edge: number) {
  const t = ((turns % 4) + 4) % 4
  const from = framePixels(unturnFrame(frame, t), width, height)
  const out = turnedSize(from.w, from.h, t)
  const scale = Math.min(1, edge / Math.max(out.w, out.h))
  return {
    from,
    width: Math.round(out.w * scale),
    height: Math.round(out.h * scale),
    // The area drawn at this size, before it's turned.
    drawW: Math.round(from.w * scale),
    drawH: Math.round(from.h * scale),
    angle: t ? -t * Math.PI / 2 : 0,
  }
}

// Only the newest piece of work counts. `run` resolves to its work's result, or to null when
// `cancel` was called or another run started meanwhile, so a slow crop can never land after
// cropping was closed or redone. A stale run's failure is dropped too.
export function latestOnly() {
  let current = 0
  return {
    async run<T>(work: () => Promise<T>): Promise<T | null> {
      const mine = ++current
      try {
        const value = await work()
        return mine === current ? value : null
      }
      catch (err) {
        if (mine === current) throw err
        return null
      }
    },
    cancel() {
      current++
    },
  }
}
