import { getAuthSession } from '../utils/session'

// Routes that do NOT require authentication
const PUBLIC_PATHS = [
  '/api/auth/login',
  '/api/setup-admin'
]

export default defineEventHandler(async (event) => {
  const path = getRequestURL(event).pathname

  // Only enforce on server API routes
  if (!path.startsWith('/api/')) return

  // Allow public endpoints through
  if (PUBLIC_PATHS.some(p => path.startsWith(p))) return

  const session = await getAuthSession(event)

  if (!session.data?.userId) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized. Please log in.'
    })
  }

  // Inject into event context for all downstream handlers
  event.context.auth = {
    userId: session.data.userId,
    authorizedCompanyIds: session.data.authorizedCompanyIds ?? [],
    role: session.data.role
  }
})
