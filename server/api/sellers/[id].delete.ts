import { eq } from 'drizzle-orm'
import { sellers } from '#server/database/schema'
import { db } from '#server/utils/db'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'ID required' })
  const sellerId = parseInt(id)

  try {
    const [deleted] = await db.delete(sellers).where(eq(sellers.id, sellerId)).returning()
    if (!deleted) throw createError({ statusCode: 404, statusMessage: 'Seller not found' })
    return { success: true, id: sellerId }
  } catch (e: unknown) {
    if ((e as { statusCode?: number }).statusCode) throw e
    console.error('Delete Seller Error:', e)
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal Server Error',
      data: { message: e instanceof Error ? e.message : 'Unknown error' }
    })
  }
})
