import { useSession } from 'h3'
import type { H3Event } from 'h3'

// ─── Session shape stored server-side (signed/encrypted cookie) ───────────────
export interface SessionData {
  userId: number
  authorizedCompanyIds: number[]
  role: string
}

// Set NUXT_SESSION_SECRET in .env — must be ≥32 chars in production
const SESSION_PASSWORD
  = process.env.NUXT_SESSION_SECRET
    || 'meu-concreto-dev-only-secret-change-in-production!!'

export const getAuthSession = (event: H3Event) =>
  useSession<SessionData>(event, {
    password: SESSION_PASSWORD,
    name: 'mc_session',
    maxAge: 60 * 60 * 24 * 7, // 7 days
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production'
    }
  })

// ─── Ownership guard ──────────────────────────────────────────────────────────
// Call after fetching a resource — throws 403 if the resource's companyId
// is not in the authenticated user's authorized list.
export const requireCompanyAccess = (event: H3Event, companyId: number) => {
  const auth = event.context.auth
  if (!auth) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized. Please log in.' })
  }
  if (!auth.authorizedCompanyIds.includes(companyId)) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Forbidden: you do not have access to this company\'s data'
    })
  }
}

// ─── Role guard ───────────────────────────────────────────────────────────────
export const requireAdmin = (event: H3Event) => {
  const auth = event.context.auth
  if (!auth) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized. Please log in.' })
  }
  if (auth.role !== 'admin') {
    throw createError({
      statusCode: 403,
      statusMessage: 'Forbidden: administrative privileges required'
    })
  }
}
