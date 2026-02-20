import { eq } from 'drizzle-orm'
import {
  users,
  userAuth,
  userCompanies,
  companies
} from '../../database/schema'
import { loginSchema } from '../../utils/schemas'
import { db } from '../../utils/db'
import { getAuthSession } from '../../utils/session'
import bcrypt from 'bcryptjs'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const result = loginSchema.safeParse(body)

  if (!result.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Validation Error',
      data: result.error.flatten()
    })
  }

  const { email, password, hwid } = result.data

  const user = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .get()

  if (!user) {
    // Timing attack protection
    await bcrypt.hash('dummy', 10)
    throw createError({
      statusCode: 401,
      statusMessage: 'Invalid credentials'
    })
  }

  const auth = await db
    .select()
    .from(userAuth)
    .where(eq(userAuth.userId, user.id))
    .get()

  if (!auth) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Auth record missing'
    })
  }

  const isValid = await bcrypt.compare(password, auth.passwordHash)

  if (!isValid) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Invalid credentials'
    })
  }

  if (hwid) {
    if (!auth.hwid) {
      // First login with HWID - bind it
      await db.update(userAuth).set({ hwid }).where(eq(userAuth.id, auth.id))
    } else if (auth.hwid !== hwid) {
      // HWID mismatch
      throw createError({
        statusCode: 403,
        statusMessage: 'Device mismatch. Access denied.',
        data: { reason: 'HWID mismatch' }
      })
    }
  }

  // Update last login
  await db
    .update(userAuth)
    .set({ lastLogin: new Date(), updatedAt: new Date() })
    .where(eq(userAuth.id, auth.id))

  // Fetch all companies this user belongs to via junction table
  const userCompanyList = await db
    .select({
      id: companies.id,
      name: companies.name,
      role: userCompanies.role
    })
    .from(userCompanies)
    .innerJoin(companies, eq(userCompanies.companyId, companies.id))
    .where(eq(userCompanies.userId, user.id))
    .all()

  // Create server-side signed session
  const session = await getAuthSession(event)
  await session.update({
    userId: user.id,
    authorizedCompanyIds: userCompanyList.map(c => c.id),
    role: user.role
  })

  return {
    message: 'Login successful',
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      companyId: user.companyId
    },
    companies: userCompanyList
  }
})
