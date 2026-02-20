import { eq, and } from 'drizzle-orm'
import { paymentMethods } from '../database/schema'
import { db } from '../utils/db'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const companyId = query.companyId ? parseInt(query.companyId as string) : undefined
  const activeOnly = query.active === 'true'

  if (!companyId) {
    throw createError({ statusCode: 400, statusMessage: 'Company ID is required' })
  }

  try {
    let whereClause = eq(paymentMethods.companyId, companyId)

    if (activeOnly) {
      // @ts-ignore - drizzle-orm type issue with conditional and/where clauses
      whereClause = and(whereClause, eq(paymentMethods.active, true))
    }

    const result = await db.select().from(paymentMethods).where(whereClause).all()

    return { paymentMethods: result }
  } catch (e: any) {
    console.error('Get Payment Methods Error:', e)
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal Server Error',
      data: { message: e.message }
    })
  }
})
