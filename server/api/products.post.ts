import { products } from '../database/schema'
import { db } from '../utils/db'
import { productSchema } from '../utils/schemas'
import { createNotification } from '../utils/notifications'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)

  const validation = productSchema.safeParse(body)

  if (!validation.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Validation Error',
      data: validation.error.flatten()
    })
  }

  try {
    const newProduct = await db.insert(products).values(validation.data).returning().get()

    // Notification trigger
    await createNotification({
      companyId: newProduct.companyId,
      type: 'product',
      title: 'Novo produto cadastrado',
      body: `${newProduct.name}${newProduct.sku ? ` — SKU: ${newProduct.sku}` : ''}`,
      link: '/produtos',
      icon: 'i-lucide-package'
    })

    return { product: newProduct }
  } catch (e: any) {
    console.error('Database Error:', e)
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal Server Error',
      data: { message: e.message }
    })
  }
})
