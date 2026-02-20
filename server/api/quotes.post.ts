import { eq } from 'drizzle-orm'
import {
  quotes,
  quoteItems,
  companies,
  sellers,
  whatsappSettings
} from '../database/schema'
import { db } from '../utils/db'
import { quoteSchema } from '../utils/schemas'
import { createNotification } from '../utils/notifications'
import { generateDocumentPDF } from '../utils/pdf'
import { getWhatsappConfig, sendWhatsappPDF } from '../utils/whatsapp'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)

  const validation = quoteSchema.safeParse(body)

  if (!validation.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Validation Error',
      data: validation.error.flatten()
    })
  }

  const { items, ...quoteData } = validation.data

  // Calculate totals
  const subtotal = items.reduce(
    (sum, item) => sum + item.quantity * item.unitPrice,
    0
  )
  const total = subtotal - quoteData.discount

  try {
    const result = await db.transaction(async (tx) => {
      // 1. Create Quote
      const newQuote = await tx
        .insert(quotes)
        .values({
          companyId: quoteData.companyId,
          userId: quoteData.userId,
          sellerId: quoteData.sellerId,
          customerName: quoteData.customerName,
          customerDocument: quoteData.customerDocument,
          customerPhone: quoteData.customerPhone,
          customerAddress: quoteData.customerAddress,
          status: quoteData.status || 'draft',
          date: new Date(),
          validUntil: quoteData.validUntil
            ? new Date(quoteData.validUntil)
            : null,
          notes: quoteData.notes,
          subtotal,
          discount: quoteData.discount,
          total
        })
        .returning()
        .get()

      // 2. Create Items
      if (items.length > 0) {
        const itemsToInsert = items.map(item => ({
          quoteId: newQuote.id,
          productId: item.productId,
          productName: item.productName,
          description: item.description,
          unit: item.unit,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalPrice: item.quantity * item.unitPrice,
          fck: item.fck,
          slump: item.slump,
          stoneSize: item.stoneSize
        }))

        await tx.insert(quoteItems).values(itemsToInsert)
      }

      return newQuote
    })

    // Fetch full object with items
    const fullQuote = await db
      .select()
      .from(quotes)
      .where(eq(quotes.id, result.id))
      .get()
    if (!fullQuote)
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to retrieve quote after creation'
      })
    const createdItems = await db
      .select()
      .from(quoteItems)
      .where(eq(quoteItems.quoteId, result.id))
      .all()

    // ── WhatsApp PDF Push ──
    try {
      const waSettings = await getWhatsappConfig(quoteData.companyId)
      const connected = waSettings?.isConnected && waSettings?.phoneNumber

      if (
        connected
        && (waSettings.quotePdfToSeller || waSettings.quotePdfToCustomer)
      ) {
        // Prepare everything for PDF
        const company = await db
          .select()
          .from(companies)
          .where(eq(companies.id, quoteData.companyId))
          .get()
        const seller = quoteData.sellerId
          ? await db
              .select()
              .from(sellers)
              .where(eq(sellers.id, quoteData.sellerId))
              .get()
          : null

        if (company) {
          const pdfBuffer = await generateDocumentPDF({
            id: result.id,
            customerName: fullQuote.customerName,
            customerDocument: fullQuote.customerDocument || null,
            customerPhone: fullQuote.customerPhone || null,
            customerAddress: fullQuote.customerAddress || null,
            date: new Date(fullQuote.date as any),
            validUntil: fullQuote.validUntil
              ? new Date(fullQuote.validUntil as any)
              : null,
            subtotal: fullQuote.subtotal,
            discount: fullQuote.discount,
            total: fullQuote.total,
            notes: fullQuote.notes || null,
            company: {
              name: company.name,
              document: company.document,
              phone: company.phone,
              email: company.email,
              address: company.address,
              city: company.city,
              state: company.state
            },
            items: createdItems.map(i => ({
              productName: i.productName,
              quantity: i.quantity,
              unit: i.unit,
              unitPrice: i.unitPrice,
              totalPrice: i.totalPrice,
              fck: i.fck || null,
              slump: i.slump || null,
              stoneSize: i.stoneSize || null
            })),
            seller: seller
              ? { name: seller.name, phone: seller.phone || null }
              : null
          })

          const config = {
            apiUrl: waSettings.apiUrl!,
            apiKey: waSettings.apiKey!,
            phoneNumber: waSettings.phoneNumber!
          }

          const fileName = `Orcamento_${String(result.id).padStart(5, '0')}.pdf`
          const caption = `📄 Orçamento de ${fullQuote.customerName}\nTotal: ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(fullQuote.total / 100)}`

          // A. Send to Seller
          if (waSettings.quotePdfToSeller && seller?.phone) {
            await sendWhatsappPDF(
              config,
              [seller.phone],
              pdfBuffer,
              fileName,
              caption
            )
          } else if (waSettings.quotePdfToSeller && !seller?.phone) {
            console.warn(`[WA PUSH] Skip Seller: no phone number found`)
          }

          // B. Send to Customer
          if (waSettings.quotePdfToCustomer && fullQuote.customerPhone) {
            await sendWhatsappPDF(
              config,
              [fullQuote.customerPhone],
              pdfBuffer,
              fileName,
              caption
            )
          } else if (
            waSettings.quotePdfToCustomer
            && !fullQuote.customerPhone
          ) {
            console.warn(`[WA PUSH] Skip Customer: no phone number found`)
          }
        }
      }
    } catch (waErr) {
      console.error('WhatsApp Push Error:', waErr)
    }

    // Notification trigger
    const qtotal = new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format((fullQuote?.total ?? 0) / 100)
    await createNotification({
      companyId: quoteData.companyId,
      type: 'quote',
      title: 'Novo orçamento criado',
      body: `${quoteData.customerName} — ${qtotal}`,
      link: '/orcamentos',
      icon: 'i-heroicons-document-text'
    })

    return { quote: { ...fullQuote, items: createdItems } }
  } catch (e: any) {
    console.error('Database Error:', e)
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal Server Error',
      data: { message: e.message }
    })
  }
})
