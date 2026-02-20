import { schedules, sales, companies, whatsappSettings } from '../database/schema'
import { scheduleSchema } from '../utils/schemas'
import { db } from '../utils/db'
import { eq, and } from 'drizzle-orm'
import { requireCompanyAccess } from '../utils/session'
import { createNotification } from '../utils/notifications'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const result = scheduleSchema.safeParse(body)

  if (!result.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Validation Error',
      data: result.error.flatten()
    })
  }

  const scheduleData = result.data

  // Security check: Verify user has access to this company
  requireCompanyAccess(event, scheduleData.companyId)

  // Fetch company and WhatsApp settings
  const company = await db.query.companies.findFirst({
    where: eq(companies.id, scheduleData.companyId),
    columns: { name: true }
  })

  const waSettings = await db.query.whatsappSettings.findFirst({
    where: eq(whatsappSettings.companyId, scheduleData.companyId),
    columns: { schedulesReminderRecipients: true }
  })

  // If saleId is provided, verify it exists and belongs to the company
  if (scheduleData.saleId) {
    const existingSale = await db.select().from(sales).where(and(
      eq(sales.id, scheduleData.saleId),
      eq(sales.companyId, scheduleData.companyId)
    )).limit(1).get()

    if (!existingSale) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Venda não encontrada ou não pertence a esta empresa'
      })
    }
  }

  try {
    const [newSchedule] = await db.insert(schedules).values({
      ...scheduleData,
      date: new Date(scheduleData.date)
    }).returning()

    if (!newSchedule) {
      throw new Error('Falha ao criar agendamento')
    }

    const formattedDate = new Date(newSchedule.date).toLocaleDateString('pt-BR')
    const timeStr = newSchedule.startTime ? ` às ${newSchedule.startTime}` : ''

    // WhatsApp Message
    const waMessage = [
      `📅 *Novo Agendamento — ${company?.name || 'Meu Concreto'}*`,
      `📌 *${newSchedule.title}*`,
      `📅 Data: ${formattedDate}${timeStr}`,
      newSchedule.customerName ? `👤 Cliente: ${newSchedule.customerName}` : null,
      newSchedule.location ? `📍 Local: ${newSchedule.location}` : null,
      newSchedule.description ? `📝 Obs: ${newSchedule.description}` : null,
      ``,
      `_Enviado por Meu Concreto_`
    ].filter(Boolean).join('\n')

    // Create app notification & WhatsApp alert
    await createNotification({
      companyId: newSchedule.companyId,
      type: 'schedule',
      title: 'Novo Agendamento',
      body: `${newSchedule.title} — ${formattedDate}${timeStr}`,
      link: `/agendamentos?id=${newSchedule.id}`,
      icon: 'i-heroicons-calendar-days',
      whatsapp: {
        toNumbers: waSettings?.schedulesReminderRecipients || [],
        message: waMessage
      }
    })

    return { schedule: newSchedule }
  } catch (e: any) {
    console.error('Create Schedule Error:', e)
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal Server Error',
      data: { message: e.message }
    })
  }
})
