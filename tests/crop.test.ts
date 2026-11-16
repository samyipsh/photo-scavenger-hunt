import { describe, expect, it } from 'vitest'
import { cropPlan, dragFrame, fitPhoto, framePixels, FULL_FRAME, isFullFrame, latestOnly, turnedSize, turnFrameClockwise, unturnFrame } from '../app/utils/crop'

const MIN = 0.1

describe('dragFrame', () => {
  it('moves a corner, leaving the opposite corner where it was', () => {
    expect(dragFrame(FULL_FRAME, 'nw', 0.2, 0.3, MIN, MIN)).toEqual({ x: 0.2, y: 0.3, w: 0.8, h: 0.7 })
    const se = dragFrame(FULL_FRAME, 'se', -0.25, -0.5, MIN, MIN)
    expect(se).toEqual({ x: 0, y: 0, w: 0.75, h: 0.5 })
  })
  it('moves one edge only', () => {
    expect(dragFrame(FULL_FRAME, 'e', -0.4, 0.3, MIN, MIN)).toEqual({ x: 0, y: 0, w: 0.6, h: 1 })
    expect(dragFrame(FULL_FRAME, 'n', 0.2, 0.25, MIN, MIN)).toEqual({ x: 0, y: 0.25, w: 1, h: 0.75 })
  })
  it('never leaves the photo', () => {
    const r = dragFrame({ x: 0.2, y: 0.2, w: 0.5, h: 0.5 }, 'nw', -1, -1, MIN, MIN)
    expect(r).toEqual({ x: 0, y: 0, w: 0.7, h: 0.7 })
    expect(dragFrame({ x: 0.2, y: 0.2, w: 0.5, h: 0.5 }, 'se', 1, 1, MIN, MIN)).toEqual({ x: 0.2, y: 0.2, w: 0.8, h: 0.8 })
  })
  it('keeps a smallest size, so the handles stay apart', () => {
    const r = dragFrame(FULL_FRAME, 'w', 2, 0, MIN, MIN)
    expect(r.w).toBeCloseTo(MIN)
    expect(r.x).toBeCloseTo(1 - MIN)
    expect(dragFrame(FULL_FRAME, 's', 0, -2, MIN, MIN).h).toBeCloseTo(MIN)
  })
  it('moves the whole frame without changing its size, inside the photo', () => {
    const moved = dragFrame({ x: 0.1, y: 0.1, w: 0.5, h: 0.4 }, 'move', 0.2, -0.05, MIN, MIN)
    expect(moved.x).toBeCloseTo(0.3)
    expect(moved.y).toBeCloseTo(0.05)
    expect([moved.w, moved.h]).toEqual([0.5, 0.4])
    expect(dragFrame({ x: 0.1, y: 0.1, w: 0.5, h: 0.4 }, 'move', 1, 1, MIN, MIN)).toEqual({ x: 0.5, y: 0.6, w: 0.5, h: 0.4 })
  })
})

describe('framePixels', () => {
  it('turns a frame into whole pixels inside the photo', () => {
    expect(framePixels({ x: 0.25, y: 0.5, w: 0.5, h: 0.5 }, 4000, 3000)).toEqual({ x: 1000, y: 1500, w: 2000, h: 1500 })
    expect(framePixels({ x: 0.999, y: 0, w: 0.5, h: 1 }, 100, 100)).toEqual({ x: 99, y: 0, w: 1, h: 100 })
  })
})

describe('isFullFrame', () => {
  it('treats a frame round the whole photo as no crop', () => {
    expect(isFullFrame(FULL_FRAME)).toBe(true)
    expect(isFullFrame({ x: 0.001, y: 0, w: 0.998, h: 1 })).toBe(true)
    expect(isFullFrame({ x: 0.05, y: 0, w: 0.95, h: 1 })).toBe(false)
  })
})

describe('fitPhoto', () => {
  it('fits a photo at its own shape, centred', () => {
    expect(fitPhoto(300, 600, 4000, 3000)).toEqual({ left: 0, top: 187.5, w: 300, h: 225 })
    expect(fitPhoto(400, 300, 3000, 4000)).toEqual({ left: 87.5, top: 0, w: 225, h: 300 })
  })
})

describe('rotation', () => {
  // A frame on the photo as it shows after `turns` quarter turns anticlockwise.
  const frame = { x: 0.1, y: 0.2, w: 0.5, h: 0.4 }
  const near = (a: { x: number, y: number, w: number, h: number }, b: typeof a) => {
    for (const k of ['x', 'y', 'w', 'h'] as const) expect(a[k]).toBeCloseTo(b[k])
  }

  it('swaps width and height on a quarter or three-quarter turn', () => {
    expect(turnedSize(4000, 3000, 0)).toEqual({ w: 4000, h: 3000 })
    expect(turnedSize(4000, 3000, 1)).toEqual({ w: 3000, h: 4000 })
    expect(turnedSize(4000, 3000, 2)).toEqual({ w: 4000, h: 3000 })
    expect(turnedSize(4000, 3000, 3)).toEqual({ w: 3000, h: 4000 })
  })

  it('maps a frame on the turned photo back to the photo as taken', () => {
    near(unturnFrame(frame, 0), frame)
    // A quarter turn anticlockwise: the photo's right edge is now its top.
    near(unturnFrame(frame, 1), { x: 0.4, y: 0.1, w: 0.4, h: 0.5 })
    near(unturnFrame(frame, 2), { x: 0.4, y: 0.4, w: 0.5, h: 0.4 })
    near(unturnFrame(frame, 3), { x: 0.2, y: 0.4, w: 0.4, h: 0.5 })
    // The whole photo stays the whole photo, and four turns are none.
    near(unturnFrame(FULL_FRAME, 1), FULL_FRAME)
    near(unturnFrame(frame, 4), frame)
  })

  it('a corner of the turned photo comes from the right corner of the photo as taken', () => {
    // Top-left of the photo after one turn anticlockwise was its top-right.
    near(unturnFrame({ x: 0, y: 0, w: 0.1, h: 0.1 }, 1), { x: 0.9, y: 0, w: 0.1, h: 0.1 })
    // After two turns it was the bottom-right; after three, the bottom-left.
    near(unturnFrame({ x: 0, y: 0, w: 0.1, h: 0.1 }, 2), { x: 0.9, y: 0.9, w: 0.1, h: 0.1 })
    near(unturnFrame({ x: 0, y: 0, w: 0.1, h: 0.1 }, 3), { x: 0, y: 0.9, w: 0.1, h: 0.1 })
  })

  it('Rotate turns the frame with the photo, so a crop keeps the same part of it', () => {
    // A crop on the upright photo, then Rotate (a quarter clockwise, three anticlockwise) up to
    // four times: each frame still maps back to the same area of the photo as taken.
    let f = frame
    let turns = 0
    for (let i = 0; i < 4; i++) {
      f = turnFrameClockwise(f)
      turns = (turns + 3) % 4
      near(unturnFrame(f, turns), frame)
    }
    near(f, frame)
    // The top-left corner goes to the top-right; the whole photo stays whole.
    near(turnFrameClockwise({ x: 0, y: 0, w: 0.1, h: 0.2 }), { x: 0.8, y: 0, w: 0.2, h: 0.1 })
    near(turnFrameClockwise(FULL_FRAME), FULL_FRAME)
  })

  it('plans the crop for each turn: where to draw from, the size made and the angle', () => {
    // A 4000 × 3000 photo as taken.
    expect(cropPlan(frame, 0, 4000, 3000, 2048)).toEqual({ from: { x: 400, y: 600, w: 2000, h: 1200 }, width: 2000, height: 1200, drawW: 2000, drawH: 1200, angle: 0 })
    expect(cropPlan(frame, 1, 4000, 3000, 2048)).toEqual({ from: { x: 1600, y: 300, w: 1600, h: 1500 }, width: 1500, height: 1600, drawW: 1600, drawH: 1500, angle: -Math.PI / 2 })
    expect(cropPlan(frame, 2, 4000, 3000, 2048)).toEqual({ from: { x: 1600, y: 1200, w: 2000, h: 1200 }, width: 2000, height: 1200, drawW: 2000, drawH: 1200, angle: -Math.PI })
    expect(cropPlan(frame, 3, 4000, 3000, 2048)).toEqual({ from: { x: 800, y: 1200, w: 1600, h: 1500 }, width: 1500, height: 1600, drawW: 1600, drawH: 1500, angle: -3 * Math.PI / 2 })
  })

  it('keeps a turned photo within the album copy\'s 2048 px', () => {
    expect(cropPlan(FULL_FRAME, 1, 4000, 3000, 2048)).toEqual({ from: { x: 0, y: 0, w: 4000, h: 3000 }, width: 1536, height: 2048, drawW: 2048, drawH: 1536, angle: -Math.PI / 2 })
  })
})

describe('latestOnly', () => {
  // Work that finishes when told to, like a crop of a big photo.
  function later<T>(value: T) {
    let finish!: () => void
    const done = new Promise<T>((resolve) => { finish = () => resolve(value) })
    return { work: () => done, finish: () => finish() }
  }
  it('gives the result when nothing else happened', async () => {
    const gate = latestOnly()
    expect(await gate.run(async () => 'cropped')).toBe('cropped')
  })
  it('drops a result that arrives after crop was closed', async () => {
    const gate = latestOnly()
    const slow = later('cropped')
    const result = gate.run(slow.work)
    gate.cancel()
    slow.finish()
    expect(await result).toBeNull()
  })
  it('drops an earlier result once another crop starts', async () => {
    const gate = latestOnly()
    const first = later('first')
    const firstResult = gate.run(first.work)
    const second = gate.run(async () => 'second')
    first.finish()
    expect(await firstResult).toBeNull()
    expect(await second).toBe('second')
  })
  it('drops a failure that arrives after crop was closed, and passes on a current one', async () => {
    const gate = latestOnly()
    let fail!: () => void
    const result = gate.run(() => new Promise((_, reject) => { fail = () => reject(new Error('no')) }))
    gate.cancel()
    fail()
    expect(await result).toBeNull()
    await expect(gate.run(async () => { throw new Error('no') })).rejects.toThrow('no')
  })
})
