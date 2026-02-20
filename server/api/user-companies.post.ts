import { userCompanies } from '#server/database/schema'
import { userCompanySchema } from '#server/utils/schemas'
import { db } from '#server/utils/db'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const result = userCompanySchema.safeParse(body)

  if (!result.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Validation Error',
      data: result.error.flatten()
    })
  }

  const { userId, companyId, role } = result.data

  try {
    const [entry] = await db
      .insert(userCompanies)
      .values({
        userId,
        companyId,
        role: role as 'admin' | 'user' | 'manager',
        createdAt: new Date()
      })
      .returning()

    return { entry }
  } catch (e: any) {
    if (
      e.message?.includes('UNIQUE constraint')
      || e.message?.includes('constraint failed')
    ) {
      throw createError({
        statusCode: 409,
        statusMessage: 'User already belongs to this company',
        data: { message: 'Duplicate entry' }
      })
    }
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal Server Error'
    })
  }
})
