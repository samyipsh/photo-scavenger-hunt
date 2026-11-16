// Shrinks a phone photo before upload: a 2048 px album copy and a 400 px thumbnail.
// Re-encoding through a canvas also drops the photo's GPS data. Also crops and turns a photo
// before it's sent (cropPhoto).
import { type CropRect, cropPlan } from '~/utils/crop'

export class PhotoDecodeError extends Error {}

const LARGE_EDGE = 2048
const THUMB_EDGE = 400

async function decode(file: Blob): Promise<{ source: CanvasImageSource, width: number, height: number, close: () => void }> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
    return { source: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close() }
  }
  catch {
    // Older Safari: an <img> applies the photo's rotation on its own.
    const url = URL.createObjectURL(file)
    try {
      const img = new Image()
      img.src = url
      await img.decode()
      return { source: img, width: img.naturalWidth, height: img.naturalHeight, close: () => URL.revokeObjectURL(url) }
    }
    catch {
      URL.revokeObjectURL(url)
      throw new PhotoDecodeError('this phone can\'t open the photo.')
    }
  }
}

// A canvas of the given size to draw on, and its picture as a JPEG once drawn.
function canvasOf(width: number, height: number) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new PhotoDecodeError('This phone couldn\'t prepare the photo.')
  const jpeg = (quality: number) => new Promise<{ blob: Blob, width: number, height: number }>((resolve, reject) => {
    canvas.toBlob((blob) => {
      canvas.width = 0
      canvas.height = 0
      if (blob) resolve({ blob, width, height })
      else reject(new PhotoDecodeError('This phone couldn\'t prepare the photo.'))
    }, 'image/jpeg', quality)
  })
  return { ctx, jpeg }
}

// The whole of `source` as a JPEG at most `edge` on its long side.
function toJpeg(source: CanvasImageSource, width: number, height: number, edge: number, quality: number) {
  const scale = Math.min(1, edge / Math.max(width, height))
  const w = Math.round(width * scale)
  const h = Math.round(height * scale)
  const { ctx, jpeg } = canvasOf(w, h)
  ctx.drawImage(source, 0, 0, w, h)
  return jpeg(quality)
}

// The part of a photo inside `frame`, turned `turns` quarter turns anticlockwise (the frame is on
// the photo as turned; see cropPlan), from the photo upright as the phone took it (decode follows
// its EXIF), as a new JPEG. It's then queued like any photo: hashed, shrunk to the album copy and
// thumbnail below and sent. Nothing bigger than the album copy is needed, and a high quality here
// keeps that second encoding from showing.
export async function cropPhoto(file: Blob, frame: CropRect, turns = 0): Promise<File> {
  const img = await decode(file)
  try {
    const plan = cropPlan(frame, turns, img.width, img.height, LARGE_EDGE)
    const { ctx, jpeg } = canvasOf(plan.width, plan.height)
    ctx.translate(plan.width / 2, plan.height / 2)
    ctx.rotate(plan.angle)
    ctx.drawImage(img.source, plan.from.x, plan.from.y, plan.from.w, plan.from.h, -plan.drawW / 2, -plan.drawH / 2, plan.drawW, plan.drawH)
    const out = await jpeg(0.92)
    return new File([out.blob], 'photo.jpg', { type: 'image/jpeg', lastModified: Date.now() })
  }
  finally {
    img.close()
  }
}

export async function shrinkPhoto(file: Blob) {
  const img = await decode(file)
  try {
    let large = await toJpeg(img.source, img.width, img.height, LARGE_EDGE, 0.85)
    for (const q of [0.72, 0.6]) {
      if (large.blob.size <= MAX_LARGE_BYTES) break
      large = await toJpeg(img.source, img.width, img.height, LARGE_EDGE, q)
    }
    const thumb = await toJpeg(img.source, img.width, img.height, THUMB_EDGE, 0.75)
    return { large: large.blob, thumb: thumb.blob, width: large.width, height: large.height }
  }
  finally {
    img.close()
  }
}
