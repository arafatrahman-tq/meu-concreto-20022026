export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const companyId = query.companyId
    ? parseInt(query.companyId as string)
    : undefined
  const status = query.status as 'draft' | 'sent' | 'approved' | 'rejected' | 'expired'

  let allQuotes

  if (companyId) {
    allQuotes = await db.query.quotes.findMany({
      where: (quotes, { eq, and }) => {
        const conds = [eq(quotes.companyId, companyId)]
        if (status) conds.push(eq(quotes.status, status))
        return and(...conds)
      },
      with: {
        items: true
      },
      orderBy: (quotes, { desc }) => [desc(quotes.createdAt)]
    })
  } else {
    allQuotes = await db.query.quotes.findMany({
      with: {
        items: true
      },
      orderBy: (quotes, { desc }) => [desc(quotes.createdAt)]
    })
  }

  return {
    quotes: allQuotes
  }
})
