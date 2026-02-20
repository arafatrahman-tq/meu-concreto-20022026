import { db } from '../utils/db'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const companyId = query.companyId
    ? parseInt(query.companyId as string)
    : undefined

  if (!companyId) {
    throw createError({ statusCode: 400, statusMessage: 'companyId required' })
  }

  // Fetch all quotes, sales, and all registered companies
  const [allQuotes, allSales, allCompanies] = await Promise.all([
    db.query.quotes.findMany({
      where: (q, { eq }) => eq(q.companyId, companyId),
      orderBy: (q, { desc }) => [desc(q.createdAt)]
    }),
    db.query.sales.findMany({
      where: (s, { eq }) => eq(s.companyId, companyId),
      orderBy: (s, { desc }) => [desc(s.createdAt)]
    }),
    db.query.companies.findMany()
  ])

  // Aggregate unique customers (merged from quotes, sales, and registered companies)
  const customerMap = new Map<
    string,
    {
      key: string
      name: string
      document: string
      phone: string
      address: string
      quotesCount: number
      salesCount: number
      totalSpent: number // cents
      totalQuoted: number // cents
      lastActivityAt: number // unix ms
      pendingQuotes: number
      approvedQuotes: number
      completedSales: number
      cancelledSales: number
    }
  >()

  // 1. Initialize from registered companies (source of truth)
  for (const comp of allCompanies) {
    // Skip self if it matches the current company context
    if (comp.id === companyId) continue

    const key = comp.document?.trim() || comp.name.trim().toLowerCase()

    customerMap.set(key, {
      key,
      name: comp.name,
      document: comp.document ?? '',
      phone: comp.phone ?? '',
      address: [comp.address, comp.city, comp.state].filter(Boolean).join(', '),
      quotesCount: 0,
      salesCount: 0,
      totalSpent: 0,
      totalQuoted: 0,
      lastActivityAt: 0,
      pendingQuotes: 0,
      approvedQuotes: 0,
      completedSales: 0,
      cancelledSales: 0
    })
  }

  // ── Process quotes ────────────────────────────────────────────────
  for (const q of allQuotes) {
    const key
      = q.customerDocument?.trim() || q.customerName.trim().toLowerCase()
    const ts
      = q.createdAt instanceof Date
        ? q.createdAt.getTime()
        : Number(q.createdAt) * 1000

    if (!customerMap.has(key)) {
      customerMap.set(key, {
        key,
        name: q.customerName,
        document: q.customerDocument ?? '',
        phone: q.customerPhone ?? '',
        address: q.customerAddress ?? '',
        quotesCount: 0,
        salesCount: 0,
        totalSpent: 0,
        totalQuoted: 0,
        lastActivityAt: ts,
        pendingQuotes: 0,
        approvedQuotes: 0,
        completedSales: 0,
        cancelledSales: 0
      })
    }

    const c = customerMap.get(key)!
    c.quotesCount++
    c.totalQuoted += q.total
    c.lastActivityAt = Math.max(c.lastActivityAt, ts)
    if (q.status === 'sent' || q.status === 'draft') c.pendingQuotes++
    if (q.status === 'approved') c.approvedQuotes++
    // Use most complete contact data available
    if (q.customerPhone && !c.phone) c.phone = q.customerPhone
    if (q.customerAddress && !c.address) c.address = q.customerAddress
  }

  // ── Process sales ─────────────────────────────────────────────────
  for (const s of allSales) {
    const key
      = s.customerDocument?.trim() || s.customerName.trim().toLowerCase()
    const ts
      = s.createdAt instanceof Date
        ? s.createdAt.getTime()
        : Number(s.createdAt) * 1000

    if (!customerMap.has(key)) {
      customerMap.set(key, {
        key,
        name: s.customerName,
        document: s.customerDocument ?? '',
        phone: s.customerPhone ?? '',
        address: s.customerAddress ?? '',
        quotesCount: 0,
        salesCount: 0,
        totalSpent: 0,
        totalQuoted: 0,
        lastActivityAt: ts,
        pendingQuotes: 0,
        approvedQuotes: 0,
        completedSales: 0,
        cancelledSales: 0
      })
    }

    const c = customerMap.get(key)!
    c.salesCount++
    c.lastActivityAt = Math.max(c.lastActivityAt, ts)
    if (s.status === 'completed') {
      c.totalSpent += s.total
      c.completedSales++
    }
    if (s.status === 'cancelled') c.cancelledSales++
    if (s.customerPhone && !c.phone) c.phone = s.customerPhone
    if (s.customerAddress && !c.address) c.address = s.customerAddress
  }

  const customers = Array.from(customerMap.values()).sort(
    (a, b) => b.lastActivityAt - a.lastActivityAt
  )

  return { customers }
})
