import { transactions } from '../database/schema'
import { transactionSchema } from '../utils/schemas'
import { db } from '../utils/db'
import { createNotification } from '../utils/notifications'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)

  const result = transactionSchema.safeParse(body)

  if (!result.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Validation Error',
      data: result.error.format()
    })
  }

  const data = result.data

  try {
    const newTransaction = await db.insert(transactions).values({
      ...data,
      date: data.date ? new Date(data.date) : new Date(),
      dueDate: data.dueDate ? new Date(data.dueDate) : undefined
    }).returning().get()

    // Notification trigger
    const tAmount = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format((newTransaction.amount ?? 0) / 100)
    const tTypeLabel = newTransaction.type === 'income' ? 'Receita' : 'Despesa'
    await createNotification({
      companyId: newTransaction.companyId,
      type: 'transaction',
      title: `Nova transação — ${tTypeLabel}`,
      body: `${newTransaction.description} — ${tAmount}`,
      link: '/transacoes',
      icon: newTransaction.type === 'income' ? 'i-heroicons-arrow-trending-up' : 'i-heroicons-arrow-trending-down'
    })

    return { transaction: newTransaction }
  } catch (e: any) {
    console.error('Create Transaction Error:', e)
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal Server Error',
      data: { message: e.message }
    })
  }
})
