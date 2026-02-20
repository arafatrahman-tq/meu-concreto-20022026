import { eq } from 'drizzle-orm'
import { products } from '../database/schema'
import { db } from '../utils/db'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const companyId = query.companyId ? parseInt(query.companyId as string) : undefined

  let allProducts

  if (companyId) {
    allProducts = await db.select().from(products).where(eq(products.companyId, companyId)).all()
  } else {
    // If no companyId is provided, should we return all? Or maybe just for admin?
    // For now, let's return all, but in a real app we'd probably require companyId or authentication context.
    allProducts = await db.select().from(products).all()
  }

  return {
    products: allProducts
  }
})
