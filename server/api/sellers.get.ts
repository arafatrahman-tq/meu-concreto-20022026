import { eq, and } from 'drizzle-orm'
import { sellers } from '#server/database/schema'
import { db } from '#server/utils/db'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const companyId = query.companyId ? parseInt(query.companyId as string) : undefined
  const activeOnly = query.active === 'true'

  if (!companyId) {
    throw createError({ statusCode: 400, statusMessage: 'companyId is required' })
  }

  try {
    let whereClause = eq(sellers.companyId, companyId)
    if (activeOnly) {
      // @ts-ignore - drizzle-orm conditional and
      whereClause = and(whereClause, eq(sellers.active, true))
    }
    const result = await db.select().from(sellers).where(whereClause).all()
    return { sellers: result }
  } catch (e: unknown) {
    console.error('Get Sellers Error:', e)
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal Server Error',
      data: { message: e instanceof Error ? e.message : 'Unknown error' }
    })
  }
})
