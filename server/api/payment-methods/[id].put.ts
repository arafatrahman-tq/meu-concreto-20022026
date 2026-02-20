import { paymentMethods } from '../../database/schema'
import { paymentMethodUpdateSchema } from '../../utils/schemas'
import { db } from '../../utils/db'
import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'ID required' })
  const paymentMethodId = parseInt(id)

  const body = await readBody(event)
  const result = paymentMethodUpdateSchema.safeParse(body)

  if (!result.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Validation Error',
      data: result.error.flatten()
    })
  }

  const data = result.data

  try {
    const [updatedPaymentMethod] = await db.update(paymentMethods)
      .set(data)
      .where(eq(paymentMethods.id, paymentMethodId))
      .returning()

    if (!updatedPaymentMethod) {
      throw createError({ statusCode: 404, statusMessage: 'Payment Method not found' })
    }

    return { paymentMethod: updatedPaymentMethod }
  } catch (e: any) {
    console.error('Update Payment Method Error:', e)
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal Server Error',
      data: { message: e.message }
    })
  }
})
