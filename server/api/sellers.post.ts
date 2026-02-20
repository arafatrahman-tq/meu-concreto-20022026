import { sellers } from '#server/database/schema'
import { sellerSchema } from '#server/utils/schemas'
import { db } from '#server/utils/db'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const result = sellerSchema.safeParse(body)

  if (!result.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Validation Error',
      data: result.error.flatten()
    })
  }

  try {
    const [newSeller] = await db.insert(sellers).values(result.data).returning()
    return { seller: newSeller }
  } catch (e: unknown) {
    console.error('Create Seller Error:', e)
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal Server Error',
      data: { message: e instanceof Error ? e.message : 'Unknown error' }
    })
  }
})
