import { companies } from '../database/schema'
import { db } from '../utils/db'

export default defineEventHandler(async () => {
  const allCompanies = await db.select().from(companies).all()
  return { companies: allCompanies }
})
