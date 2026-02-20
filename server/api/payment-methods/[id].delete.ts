import { paymentMethods } from '../../database/schema'
import { db } from '../../utils/db'
import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'ID required' })
  const paymentMethodId = parseInt(id)

  try {
    const [deletedPaymentMethod] = await db.delete(paymentMethods)
      .where(eq(paymentMethods.id, paymentMethodId))
      .returning()

    if (!deletedPaymentMethod) {
      throw createError({ statusCode: 404, statusMessage: 'Payment Method not found' })
    }

    return { success: true, id: paymentMethodId }
  } catch (e: any) {
    console.error('Delete Payment Method Error:', e)
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal Server Error',
      data: { message: e.message }
    })
  }
})
