import { eq } from 'drizzle-orm'
import { users } from '#server/database/schema'
import { userUpdateSchema } from '#server/utils/schemas'
import { db } from '#server/utils/db'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'ID required' })

  // Security: only admin or self can update
  const auth = event.context.auth
  if (!auth) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  if (auth.role !== 'admin' && auth.userId !== parseInt(id)) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }

  const body = await readBody(event)
  const result = userUpdateSchema.safeParse(body)

  if (!result.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Validation Error',
      data: result.error.flatten()
    })
  }

  try {
    const [updatedUser] = await db.update(users)
      .set({
        ...result.data,
        updatedAt: new Date()
      })
      .where(eq(users.id, parseInt(id)))
      .returning()

    if (!updatedUser) {
      throw createError({ statusCode: 404, statusMessage: 'User not found' })
    }

    return { user: updatedUser }
  } catch (e: any) {
    // Check for unique constraint violation
    if (e.cause?.code === 'SQLITE_CONSTRAINT'
      || e.message?.includes('UNIQUE constraint failed')
      || e.message?.includes('constraint failed')) {
      throw createError({
        statusCode: 409,
        statusMessage: 'Conflict',
        data: { message: 'Email or Document already in use' }
      })
    }

    console.error('Database Error:', e)
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal Server Error',
      data: { message: e.message }
    })
  }
})
