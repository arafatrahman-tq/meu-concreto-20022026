import { eq, desc, and } from 'drizzle-orm'
import { sales } from '../database/schema'
import { db } from '../utils/db'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const companyId = query.companyId
    ? parseInt(query.companyId as string)
    : undefined
  const status = query.status as string

  try {
    let whereClause = undefined

    if (companyId) {
      if (status) {
        whereClause = and(
          eq(sales.companyId, companyId),
          eq(sales.status, status as any)
        )
      } else {
        whereClause = eq(sales.companyId, companyId)
      }
    }

    // Use query builder with relations support
    const allSales = await db.query.sales.findMany({
      where: whereClause,
      orderBy: [desc(sales.createdAt)],
      with: { seller: true, items: true, transactions: true }
    })

    return { sales: allSales }
  } catch (e: any) {
    console.error('Get Sales Error:', e)
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal Server Error',
      data: { message: e.message }
    })
  }
})
