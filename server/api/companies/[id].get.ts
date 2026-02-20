import { eq } from 'drizzle-orm'
import { companies } from '../../database/schema'
import { db } from '../../utils/db'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'ID required' })

  const company = await db.select().from(companies).where(eq(companies.id, parseInt(id))).get()

  if (!company) {
    throw createError({ statusCode: 404, statusMessage: 'Company not found' })
  }

  return { company }
})
