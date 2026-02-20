import { paymentMethods } from '../database/schema'
import { paymentMethodSchema } from '../utils/schemas'
import { db } from '../utils/db'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const result = paymentMethodSchema.safeParse(body)

  if (!result.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Validation Error',
      data: result.error.flatten()
    })
  }

  const data = result.data

  try {
    const [newPaymentMethod] = await db.insert(paymentMethods).values({
      ...data,
      // Drizzle with mode: 'json' handles stringification automatically for SQLite text columns
      details: data.details
    }).returning()

    return { paymentMethod: newPaymentMethod }
  } catch (e: any) {
    console.error('Create Payment Method Error:', e)
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal Server Error',
      data: { message: e.message }
    })
  }
})
