import { describe, expect, it } from 'vitest'
import { fromStoredPhoto, toStoredPhoto } from '../app/utils/queueStore'

describe('stored photos', () => {
  it('keeps a draft photo as bytes and gets the same File back', async () => {
    const file = new File([new Uint8Array([0xFF, 0xD8, 0xFF, 1, 2, 3])], 'IMG_1.jpg', { type: 'image/jpeg', lastModified: 1_700_000_000_000 })
    const stored = await toStoredPhoto(file)
    expect(stored.bytes).toBeInstanceOf(ArrayBuffer)
    const back = fromStoredPhoto(structuredClone(stored))
    expect(back).toBeInstanceOf(File)
    expect([back.name, back.type, back.lastModified, back.size]).toEqual(['IMG_1.jpg', 'image/jpeg', 1_700_000_000_000, 6])
    expect(new Uint8Array(await back.arrayBuffer())).toEqual(new Uint8Array([0xFF, 0xD8, 0xFF, 1, 2, 3]))
  })
  it('still loads a draft saved as a File by an earlier version', () => {
    const file = new File(['x'], 'old.jpg', { type: 'image/jpeg' })
    expect(fromStoredPhoto(file)).toBe(file)
  })
})
