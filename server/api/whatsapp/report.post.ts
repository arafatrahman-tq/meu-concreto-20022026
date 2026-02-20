import { getWhatsappConfig, sendWhatsappMessage, buildReportMessage } from '../../utils/whatsapp'
import { db } from '../../utils/db'
import { sales, quotes, transactions } from '../../database/schema'
import { eq, and, gte } from 'drizzle-orm'
import { requireCompanyAccess } from '../../utils/session'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const companyId = Number(query.companyId)
  if (!companyId) throw createError({ statusCode: 400, message: 'companyId required' })

  // Security check: Verify user has access to this company
  requireCompanyAccess(event, companyId)

  const config = await getWhatsappConfig(companyId)
  if (!config) throw createError({ statusCode: 404, message: 'WhatsApp não configurado.' })
  if (!config.phoneNumber) throw createError({ statusCode: 400, message: 'Número de WhatsApp não configurado.' })

  const recipients = (config.reportRecipients as string[]) ?? []
  if (recipients.length === 0) {
    throw createError({ statusCode: 400, message: 'Nenhum destinatário de relatório configurado.' })
  }

  // ── Build report data (current day stats)
  const startOfDay = new Date()
  startOfDay.setHours(0, 0, 0, 0)

  // Sales today
  const salesRows = await db
    .select()
    .from(sales)
    .where(and(eq(sales.companyId, companyId), gte(sales.date, startOfDay)))

  const salesTotal = salesRows.reduce((acc: number, s) => acc + s.total, 0)
  const salesCount = salesRows.length

  // Pending quotes
  const quotesRows = await db
    .select()
    .from(quotes)
    .where(and(eq(quotes.companyId, companyId), eq(quotes.status, 'sent')))

  const pendingQuotes = quotesRows.length
  const pendingQuotesTotal = quotesRows.reduce((acc: number, q) => acc + q.total, 0)

  // Transactions today
  const txRows = await db
    .select()
    .from(transactions)
    .where(and(eq(transactions.companyId, companyId), gte(transactions.date, startOfDay)))

  const incomeTotal = txRows.filter(t => t.type === 'income').reduce((acc: number, t) => acc + t.amount, 0)
  const expenseTotal = txRows.filter(t => t.type === 'expense').reduce((acc: number, t) => acc + t.amount, 0)

  // Company name from query context (or use a generic fallback)
  const body = await readBody(event).catch(() => ({}))
  const companyName = (body as Record<string, string>).companyName ?? 'Meu Concreto'

  const text = buildReportMessage({
    companyName,
    schedule: config.reportSchedule ?? 'daily',
    salesTotal,
    salesCount,
    pendingQuotes,
    pendingQuotesTotal,
    incomeTotal,
    expenseTotal
  })

  const result = await sendWhatsappMessage(config, recipients, text)

  return {
    ok: result.sent.length > 0,
    sent: result.sent,
    failed: result.failed,
    message: result.sent.length > 0
      ? `Relatório enviado para ${result.sent.length} destinatário(s).`
      : 'Falha ao enviar relatório.'
  }
})
