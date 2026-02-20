import { eq } from 'drizzle-orm'
import { users } from '#server/database/schema'
import { db } from '#server/utils/db'
import { requireAdmin } from '#server/utils/session'

export default defineEventHandler(async (event) => {
  requireAdmin(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'ID required' })

  try {
    const deletedUser = await db.delete(users)
      .where(eq(users.id, parseInt(id)))
      .returning()
      .get()

    if (!deletedUser) {
      throw createError({ statusCode: 404, statusMessage: 'User not found' })
    }

    return { success: true, user: deletedUser }
  } catch (e: any) {
    console.error('Database Error:', e)
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal Server Error',
      data: { message: e.message }
    })
  }
})
