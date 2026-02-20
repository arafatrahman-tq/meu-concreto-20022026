import { getWhatsappConfig, baileysCall, sendWhatsappMessage } from '../../utils/whatsapp'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { requireAdmin, requireCompanyAccess } from '../../utils/session'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const query = getQuery(event)
  const companyId = Number(query.companyId)
  if (!companyId) throw createError({ statusCode: 400, message: 'companyId required' })

  // Security check: Verify user has access to this company
  requireCompanyAccess(event, companyId)
  requireAdmin(event) // Testing is an admin task

  const config = await getWhatsappConfig(companyId)
  if (!config) throw createError({ statusCode: 404, message: 'WhatsApp não configurado.' })

  const mode = body.mode as 'ping' | 'message'

  // ── Ping: just test Baileys API connectivity
  if (mode === 'ping') {
    const result = await baileysCall(config, '/status/auth', { method: 'GET' })
    return {
      ok: result.ok,
      status: result.status,
      message: result.ok ? 'API do WhatsApp acessível.' : `Erro ao acessar API (HTTP ${result.status}).`
    }
  }

  // ── Message: send a test message to a specific number
  const toNumber = body.toNumber as string
  if (!toNumber || !/^\+\d{5,15}$/.test(toNumber)) {
    throw createError({ statusCode: 400, message: 'toNumber inválido. Use formato: +5511999999999' })
  }

  if (!config.phoneNumber) {
    throw createError({ statusCode: 400, message: 'Número de WhatsApp não configurado. Conecte primeiro.' })
  }

  const now = format(new Date(), 'dd/MM/yyyy \'às\' HH:mm', { locale: ptBR })
  const text = `✅ *Mensagem de Teste — Meu Concreto*\n\nConexão WhatsApp funcionando corretamente!\n📅 ${now}`

  const result = await sendWhatsappMessage(config, [toNumber], text)

  return {
    ok: result.sent.length > 0,
    sent: result.sent,
    failed: result.failed,
    message: result.sent.length > 0
      ? 'Mensagem de teste enviada com sucesso!'
      : 'Falha ao enviar mensagem. Verifique se o WhatsApp está conectado.'
  }
})
