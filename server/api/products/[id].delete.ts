import { eq } from 'drizzle-orm'
import { products } from '../../database/schema'
import { db } from '../../utils/db'
import { requireCompanyAccess } from '../../utils/session'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'ID required' })

  const existing = await db.select({ companyId: products.companyId })
    .from(products).where(eq(products.id, parseInt(id))).get()
  if (!existing) throw createError({ statusCode: 404, statusMessage: 'Product not found' })
  requireCompanyAccess(event, existing.companyId)

  try {
    const deletedProduct = await db.delete(products)
      .where(eq(products.id, parseInt(id)))
      .returning()
      .get()

    if (!deletedProduct) {
      throw createError({ statusCode: 404, statusMessage: 'Product not found' })
    }

    return { message: 'Product deleted successfully', product: deletedProduct }
  } catch (e: unknown) {
    console.error('Database Error:', e)
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal Server Error',
      data: { message: e instanceof Error ? e.message : 'Unknown error' }
    })
  }
})
