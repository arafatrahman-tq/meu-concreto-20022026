import { eq } from 'drizzle-orm'
import { companies } from '../../database/schema'
import { companyUpdateSchema } from '../../utils/schemas'
import { db } from '../../utils/db'
import { requireCompanyAccess } from '../../utils/session'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'ID required' })
  requireCompanyAccess(event, parseInt(id))

  const body = await readBody(event)
  const result = companyUpdateSchema.safeParse(body)

  if (!result.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Validation Error',
      data: result.error.flatten()
    })
  }

  try {
    const updatedCompany = await db.update(companies)
      .set({
        ...result.data,
        updatedAt: new Date()
      })
      .where(eq(companies.id, parseInt(id)))
      .returning()
      .get()

    if (!updatedCompany) {
      throw createError({ statusCode: 404, statusMessage: 'Company not found' })
    }

    return { company: updatedCompany }
  } catch (e: unknown) {
    console.error('Database Error:', e)
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal Server Error',
      data: { message: e instanceof Error ? e.message : 'Unknown error' }
    })
  }
})
