import { and, eq } from 'drizzle-orm'
import { photos } from '../../../db/schema'

// One photo's judging details, for the committee's actions in the gallery.
export default defineEventHandler(async (event) => {
  await requireCommittee(event)
  // In demo mode a visitor's photo stays with the phone that sent it, even for the committee.
  const photo = await useDb(event).select().from(photos).where(and(eq(photos.id, getRouterParam(event, 'id') ?? ''), demoPhotos(event))).get()
  if (!photo) throw createError({ statusCode: 404, statusMessage: 'Photo not found' })
  return photo
})
