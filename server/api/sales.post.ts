import {
  sales,
  saleItems,
  quotes,
  companies,
  sellers
} from '../database/schema'
import { saleSchema } from '../utils/schemas'
import { db } from '../utils/db'
import { eq, and } from 'drizzle-orm'
import { createNotification } from '../utils/notifications'
import { getWhatsappConfig, sendWhatsappPDF } from '../utils/whatsapp'
import { generateDocumentPDF } from '../utils/pdf'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const result = saleSchema.safeParse(body)

  if (!result.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Validation Error',
      data: result.error.flatten()
    })
  }

  const { items, ...saleData } = result.data

  // If quoteId is provided, verify it exists and belongs to the company
  if (saleData.quoteId) {
    const existingQuotes = await db
      .select()
      .from(quotes)
      .where(
        and(
          eq(quotes.id, saleData.quoteId),
          eq(quotes.companyId, saleData.companyId)
        )
      )
      .limit(1)

    if (existingQuotes.length === 0) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Quote not found or does not belong to this company'
      })
    }
  }

  try {
    const insertedSale = await db.transaction(async (tx) => {
      // 1. Calculate totals from items
      let subtotal = 0
      const processedItems = items.map((item: any) => {
        const lineTotal = Math.round(item.quantity * item.unitPrice)
        subtotal += lineTotal
        return {
          ...item,
          totalPrice: lineTotal
        }
      })

      const total = Math.max(0, subtotal - (saleData.discount || 0))

      // 2. Create Sale
      const [newSale] = await tx
        .insert(sales)
        .values({
          ...saleData,
          subtotal,
          total,
          date: saleData.date ? new Date(saleData.date) : new Date(),
          deliveryDate: saleData.deliveryDate
            ? new Date(saleData.deliveryDate)
            : null
        })
        .returning()

      if (!newSale) {
        throw new Error('Failed to create sale record')
      }

      // 3. Create Sale Items
      if (processedItems.length > 0) {
        await tx.insert(saleItems).values(
          processedItems.map((item: any) => ({
            saleId: newSale.id,
            productId: item.productId,
            productName: item.productName,
            description: item.description,
            unit: item.unit,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            totalPrice: item.totalPrice,
            fck: item.fck,
            slump: item.slump,
            stoneSize: item.stoneSize
          }))
        )
      }

      return newSale
    })

    if (!insertedSale) {
      throw new Error('Transaction completed but no sale returned')
    }

    // Fetch complete sale with items using query builder (validates schema relations)
    const sale = await db.query.sales.findFirst({
      where: eq(sales.id, insertedSale.id),
      with: {
        items: true
      }
    })

    if (!sale) {
      throw new Error('Failed to retrieve created sale')
    }

    // ── WhatsApp PDF Push ──
    try {
      const waSettings = await getWhatsappConfig(sale.companyId)
      const connected = waSettings?.isConnected && waSettings?.phoneNumber

      if (
        connected
        && (waSettings.quotePdfToSeller || waSettings.quotePdfToCustomer)
      ) {
        const company = await db
          .select()
          .from(companies)
          .where(eq(companies.id, sale.companyId))
          .get()
        const seller = sale.sellerId
          ? await db
              .select()
              .from(sellers)
              .where(eq(sellers.id, sale.sellerId))
              .get()
          : null

        if (company) {
          const pdfBuffer = await generateDocumentPDF({
            id: sale.id,
            customerName: sale.customerName,
            customerDocument: sale.customerDocument || null,
            customerPhone: sale.customerPhone || null,
            customerAddress: sale.customerAddress || null,
            date: new Date(sale.date as any),
            deliveryDate: sale.deliveryDate
              ? new Date(sale.deliveryDate as any)
              : null,
            validUntil: null,
            subtotal: sale.subtotal,
            discount: sale.discount,
            total: sale.total,
            notes: sale.notes || null,
            company: {
              name: company.name,
              document: company.document,
              phone: company.phone,
              email: company.email,
              address: company.address,
              city: company.city,
              state: company.state
            },
            items: (sale.items ?? []).map(i => ({
              productName: i.productName,
              quantity: i.quantity,
              unit: i.unit || 'm3',
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

          const fileName = `PedidoVenda_${String(sale.id).padStart(5, '0')}.pdf`
          const caption = `📄 Pedido de Venda: ${sale.customerName}\nTotal: ${new Intl.NumberFormat(
            'pt-BR',
            {
              style: 'currency',
              currency: 'BRL'
            }
          ).format(sale.total / 100)}`

          if (waSettings.quotePdfToSeller && seller?.phone) {
            console.log(`[WA PUSH SALE] Sending to Seller: ${seller.phone}`)
            await sendWhatsappPDF(
              config,
              [seller.phone],
              pdfBuffer,
              fileName,
              caption
            )
          } else if (waSettings.quotePdfToSeller && !seller?.phone) {
            console.warn(`[WA PUSH SALE] Skip Seller: no phone number found`)
          }

          if (waSettings.quotePdfToCustomer && sale.customerPhone) {
            await sendWhatsappPDF(
              config,
              [sale.customerPhone],
              pdfBuffer,
              fileName,
              caption
            )
          } else if (waSettings.quotePdfToCustomer && !sale.customerPhone) {
            console.warn(`[WA PUSH SALE] Skip Customer: no phone number found`)
          }
        }
      }
    } catch (waErr) {
      console.error('WhatsApp Push Error:', waErr)
    }

    // Notification trigger
    const totalDisplay = new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(sale.total / 100)
    await createNotification({
      companyId: sale.companyId,
      type: 'sale',
      title: 'Nova venda registrada',
      body: `${sale.customerName} — ${totalDisplay}`,
      link: '/vendas',
      icon: 'i-heroicons-shopping-cart'
    })

    return { sale }
  } catch (e: any) {
    console.error('Create Sale Error:', e)
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal Server Error',
      data: { message: e.message }
    })
  }
})
