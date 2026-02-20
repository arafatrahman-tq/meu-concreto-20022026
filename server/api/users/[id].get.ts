import { eq } from 'drizzle-orm'
import { users } from '#server/database/schema'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'ID required' })

  const user = await db.select().from(users).where(eq(users.id, parseInt(id))).get()

  if (!user) {
    throw createError({ statusCode: 404, statusMessage: 'User not found' })
  }

  return { user }
})
