import { eq } from 'drizzle-orm'
import { quotes } from '../../../database/schema'
import { db } from '../../../utils/db'
import { generateDocumentPDF, getPDFContext } from '../../../utils/pdf'
import { sendWhatsappPDF } from '../../../utils/whatsapp'
import { requireCompanyAccess } from '../../../utils/session'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'ID required' })
  const quoteId = parseInt(id)

  // 1. Fetch Quote with its items
  const quote = await db.query.quotes.findFirst({
    where: eq(quotes.id, quoteId),
    with: {
      items: true
    }
  })

  if (!quote) {
    throw createError({ statusCode: 404, statusMessage: 'Quote not found' })
  }

  // 2. Auth Check — Ensure user has access to this company
  requireCompanyAccess(event, quote.companyId)

  // 3. Fetch Context
  const { company, seller, waConfig } = await getPDFContext(
    quote.companyId,
    quote.sellerId
  )

  if (!waConfig?.apiUrl || !waConfig?.phoneNumber) {
    throw createError({
      statusCode: 400,
      statusMessage:
        'WhatsApp automation not configured (no active instance found)'
    })
  }

  // 4. Generate PDF
  const pdfBuffer = await generateDocumentPDF({
    id: quote.id,
    customerName: quote.customerName,
    customerDocument: quote.customerDocument || null,
    customerPhone: quote.customerPhone || null,
    customerAddress: quote.customerAddress || null,
    date: new Date(quote.date as any),
    validUntil: quote.validUntil ? new Date(quote.validUntil as any) : null,
    deliveryDate: null,
    subtotal: quote.subtotal,
    discount: quote.discount,
    total: quote.total,
    notes: quote.notes || null,
    company: {
      name: company.name,
      document: company.document,
      phone: company.phone,
      email: company.email,
      address: company.address,
      city: company.city,
      state: company.state
    },
    items: quote.items.map(i => ({
      productName: i.productName,
      quantity: i.quantity,
      unit: i.unit,
      unitPrice: i.unitPrice,
      totalPrice: i.totalPrice,
      fck: i.fck || null,
      slump: i.slump || null,
      stoneSize: i.stoneSize || null
    })),
    seller: seller ? { name: seller.name, phone: seller.phone || null } : null
  })

  // 5. Config Baileys API
  const config = {
    apiUrl: waConfig.apiUrl,
    apiKey: waConfig.apiKey,
    phoneNumber: waConfig.phoneNumber
  }

  const fileName = `Orcamento_${String(quote.id).padStart(5, '0')}.pdf`
  const caption = `📄 Orçamento de ${quote.customerName}\nTotal: ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(quote.total / 100)}`

  // 6. Collect Recipients based on settings
  const recipients: string[] = []

  if (waConfig.quotePdfToSeller && seller?.phone) {
    recipients.push(seller.phone)
  }

  if (waConfig.quotePdfToCustomer && quote.customerPhone) {
    recipients.push(quote.customerPhone)
  }

  if (recipients.length === 0) {
    // If specifically asked to send and both switches are off, maybe we should still send to customer?
    // But user asked to "fazer o mesmo processo", so we respect switches.
    throw createError({
      statusCode: 400,
      statusMessage:
        'Envio de PDF desativado nas configurações de integração (Vendedor/Cliente)'
    })
  }

  // 7. Send PDF via WhatsApp
  const results = await sendWhatsappPDF(
    config,
    recipients,
    pdfBuffer,
    fileName,
    caption
  )

  return {
    success: results.sent.length > 0,
    sent: results.sent,
    failed: results.failed
  }
})
