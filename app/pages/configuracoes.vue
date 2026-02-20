<script setup lang="ts">
definePageMeta({ layout: 'default' })
useSeoMeta({ title: 'Configurações | Meu Concreto' })

const { user, companyId } = useAuth()
const toast = useToast()
const colorMode = useColorMode()

// ─────────────────────────────────────────────
// BR States
// ─────────────────────────────────────────────
const BR_STATES = [
  'AC',
  'AL',
  'AM',
  'AP',
  'BA',
  'CE',
  'DF',
  'ES',
  'GO',
  'MA',
  'MG',
  'MS',
  'MT',
  'PA',
  'PB',
  'PE',
  'PI',
  'PR',
  'RJ',
  'RN',
  'RO',
  'RR',
  'RS',
  'SC',
  'SE',
  'SP',
  'TO'
].map(s => ({ label: s, value: s }))

// ─────────────────────────────────────────────
// Input formatters
// ─────────────────────────────────────────────
const formatPhone = (v: string) => {
  const d = v.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 10)
    return d.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{4})(\d)/, '$1-$2')
  return d.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d)/, '$1-$2')
}
const formatZip = (v: string) => {
  const d = v.replace(/\D/g, '').slice(0, 8)
  return d.replace(/(\d{5})(\d)/, '$1-$2')
}

// ─────────────────────────────────────────────
// Company — fetch & form
// ─────────────────────────────────────────────
const {
  data: companyData,
  pending: loadingCompany,
  refresh: refreshCompany
} = await useFetch<{
  company: {
    name: string
    email?: string | null
    phone?: string | null
    address?: string | null
    city?: string | null
    state?: string | null
    zip?: string | null
    active: boolean
  }
}>(() => `/api/companies/${companyId.value}`)

const companyRaw = computed(() => companyData.value?.company ?? null)

const companyForm = reactive({
  name: '',
  email: '',
  phone: '',
  address: '',
  city: '',
  state: undefined as string | undefined,
  zip: '',
  active: true
})

// Populate form when data loads
watch(
  companyRaw,
  (c) => {
    if (!c) return
    companyForm.name = c.name ?? ''
    companyForm.email = c.email ?? ''
    companyForm.phone = c.phone ? formatPhone(c.phone) : ''
    companyForm.address = c.address ?? ''
    companyForm.city = c.city ?? ''
    companyForm.state = c.state ?? undefined
    companyForm.zip = c.zip ? formatZip(c.zip) : ''
    companyForm.active = c.active ?? true
  },
  { immediate: true }
)

// Masks
watch(
  () => companyForm.phone,
  (val) => {
    const masked = formatPhone(val)
    if (masked !== val) companyForm.phone = masked
  }
)
watch(
  () => companyForm.zip,
  (val) => {
    const masked = formatZip(val)
    if (masked !== val) companyForm.zip = masked
  }
)

// CEP lookup
const cepStatus = ref<'idle' | 'loading' | 'ok' | 'error'>('idle')
const cepMessage = ref('')

const lookupCep = async () => {
  const digits = companyForm.zip.replace(/\D/g, '')
  if (digits.length !== 8) return
  cepStatus.value = 'loading'
  cepMessage.value = ''
  try {
    const res = await $fetch<{
      logradouro: string
      bairro: string
      localidade: string
      uf: string
      erro?: boolean
    }>(`https://viacep.com.br/ws/${digits}/json/`)
    if (res.erro) {
      cepStatus.value = 'error'
      cepMessage.value = 'CEP não encontrado.'
      return
    }
    companyForm.address = [res.logradouro, res.bairro]
      .filter(Boolean)
      .join(', ')
    companyForm.city = res.localidade
    companyForm.state = res.uf
    cepStatus.value = 'ok'
    cepMessage.value = 'Endereço preenchido automaticamente.'
  } catch {
    cepStatus.value = 'error'
    cepMessage.value = 'Falha ao buscar CEP. Preencha manualmente.'
  }
}

watch(
  () => companyForm.zip,
  (val) => {
    if (val.replace(/\D/g, '').length === 8) lookupCep()
    else {
      cepStatus.value = 'idle'
      cepMessage.value = ''
    }
  }
)

const loadingSaveCompany = ref(false)

const handleSaveCompany = async () => {
  if (companyForm.name.trim().length < 3) {
    toast.add({
      title: 'Campos inválidos',
      description: 'O nome deve ter pelo menos 3 caracteres.',
      color: 'warning',
      icon: 'i-heroicons-exclamation-triangle'
    })
    return
  }
  if (
    companyForm.email
    && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(companyForm.email)
  ) {
    toast.add({
      title: 'Campos inválidos',
      description: 'E-mail inválido.',
      color: 'warning',
      icon: 'i-heroicons-exclamation-triangle'
    })
    return
  }
  if (companyForm.state && companyForm.state.length !== 2) {
    toast.add({
      title: 'Campos inválidos',
      description: 'Estado deve ter exatamente 2 letras (ex: SP).',
      color: 'warning',
      icon: 'i-heroicons-exclamation-triangle'
    })
    return
  }
  loadingSaveCompany.value = true
  try {
    await $fetch(`/api/companies/${companyId.value}`, {
      method: 'PUT',
      body: {
        name: companyForm.name.trim(),
        email: companyForm.email.trim() || undefined,
        phone: companyForm.phone.trim() || undefined,
        address: companyForm.address.trim() || undefined,
        city: companyForm.city.trim() || undefined,
        state: companyForm.state?.trim() || undefined,
        zip: companyForm.zip.trim() || undefined,
        active: companyForm.active
      }
    })
    toast.add({
      title: 'Empresa atualizada',
      description: 'Os dados da empresa foram salvos.',
      color: 'success',
      icon: 'i-heroicons-check-circle'
    })
    await refreshCompany()
  } catch (e: unknown) {
    const err = e as { data?: { statusMessage?: string }, message?: string }
    toast.add({
      title: 'Erro ao salvar',
      description:
        err?.data?.statusMessage ?? err?.message ?? 'Tente novamente.',
      color: 'error',
      icon: 'i-heroicons-exclamation-circle'
    })
  } finally {
    loadingSaveCompany.value = false
  }
}

// ─────────────────────────────────────────────
// User profile — form
// ─────────────────────────────────────────────
const profileForm = reactive({
  name: user.value?.name ?? '',
  phone: ''
})

watch(
  () => profileForm.phone,
  (val) => {
    const masked = formatPhone(val)
    if (masked !== val) profileForm.phone = masked
  }
)

const loadingSaveProfile = ref(false)

const handleSaveProfile = async () => {
  if (profileForm.name.trim().length < 3) {
    toast.add({
      title: 'Campos inválidos',
      description: 'O nome deve ter pelo menos 3 caracteres.',
      color: 'warning',
      icon: 'i-heroicons-exclamation-triangle'
    })
    return
  }
  if (!user.value?.id) return
  loadingSaveProfile.value = true
  try {
    await $fetch(`/api/users/${user.value.id}`, {
      method: 'PUT',
      body: {
        name: profileForm.name.trim(),
        phone: profileForm.phone.trim() || undefined
      }
    })
    // Update cookie session name
    if (user.value) user.value.name = profileForm.name.trim()
    toast.add({
      title: 'Perfil atualizado',
      description: 'Seus dados foram salvos com sucesso.',
      color: 'success',
      icon: 'i-heroicons-check-circle'
    })
  } catch (e: unknown) {
    const err = e as { data?: { statusMessage?: string }, message?: string }
    toast.add({
      title: 'Erro ao salvar',
      description:
        err?.data?.statusMessage ?? err?.message ?? 'Tente novamente.',
      color: 'error',
      icon: 'i-heroicons-exclamation-circle'
    })
  } finally {
    loadingSaveProfile.value = false
  }
}

// ─────────────────────────────────────────────
// WhatsApp
// ─────────────────────────────────────────────
const { data: waData, refresh: refreshWA } = await useFetch<{
  settings: {
    apiUrl: string
    apiKey?: string | null
    phoneNumber?: string | null
    isConnected: boolean
    alertsEnabled: boolean
    reportsEnabled: boolean
    quotePdfToSeller: boolean
    quotePdfToCustomer: boolean
    schedulesReminderEnabled: boolean
    schedulesReminderLeadTimeHours: number
    schedulesReminderRecipients: string[]
    alertRecipients: string[]
    reportRecipients: string[]
    reportSchedule: 'daily' | 'weekly' | 'monthly'
    isGlobal: boolean
  }
  isUsingGlobal: boolean
}>(() => `/api/whatsapp/settings?companyId=${companyId.value}`)

const waSettings = computed(() => waData.value?.settings ?? null)
const isUsingGlobal = computed(() => waData.value?.isUsingGlobal ?? false)

const REPORT_SCHEDULE_OPTS = [
  { label: 'Diário', value: 'daily' },
  { label: 'Semanal', value: 'weekly' },
  { label: 'Mensal', value: 'monthly' }
]

const waForm = reactive({
  apiUrl: 'http://localhost:3025',
  apiKey: '',
  phoneNumber: '',
  alertsEnabled: false,
  reportsEnabled: false,
  quotePdfToSeller: false,
  quotePdfToCustomer: false,
  schedulesReminderEnabled: false,
  schedulesReminderLeadTimeHours: 24,
  schedulesReminderRecipients: [] as string[],
  alertRecipients: [] as string[],
  reportRecipients: [] as string[],
  reportSchedule: 'daily',
  isGlobal: false
})

watch(
  waSettings,
  (s) => {
    if (!s) return
    waForm.apiUrl = s.apiUrl ?? 'http://localhost:3025'
    waForm.apiKey = s.apiKey ?? ''
    waForm.phoneNumber = s.phoneNumber ?? ''
    waForm.alertsEnabled = s.alertsEnabled ?? false
    waForm.reportsEnabled = s.reportsEnabled ?? false
    waForm.quotePdfToSeller = s.quotePdfToSeller ?? false
    waForm.quotePdfToCustomer = s.quotePdfToCustomer ?? false
    waForm.schedulesReminderEnabled = s.schedulesReminderEnabled ?? false
    waForm.schedulesReminderLeadTimeHours
      = s.schedulesReminderLeadTimeHours ?? 24
    waForm.schedulesReminderRecipients = [
      ...(s.schedulesReminderRecipients ?? [])
    ]
    waForm.alertRecipients = [...(s.alertRecipients ?? [])]
    waForm.reportRecipients = [...(s.reportRecipients ?? [])]
    waForm.reportSchedule = s.reportSchedule ?? 'daily'
    waForm.isGlobal = s.isGlobal ?? false
  },
  { immediate: true }
)

const showApiKey = ref(false)
const waTestNum = ref('')
const loadingSaveWA = ref(false)
const loadingConnect = ref(false)
const loadingDisconnect = ref(false)
const loadingTestPing = ref(false)
const loadingTestMsg = ref(false)
const loadingReport = ref(false)

const handleSaveWA = async () => {
  loadingSaveWA.value = true
  try {
    await $fetch(`/api/whatsapp/settings?companyId=${companyId.value}`, {
      method: 'PUT',
      body: {
        apiUrl: waForm.apiUrl,
        apiKey: waForm.apiKey,
        phoneNumber: waForm.phoneNumber || undefined,
        alertsEnabled: waForm.alertsEnabled,
        reportsEnabled: waForm.reportsEnabled,
        quotePdfToSeller: waForm.quotePdfToSeller,
        quotePdfToCustomer: waForm.quotePdfToCustomer,
        schedulesReminderEnabled: waForm.schedulesReminderEnabled,
        schedulesReminderLeadTimeHours: Number(
          waForm.schedulesReminderLeadTimeHours
        ),
        schedulesReminderRecipients:
          waForm.schedulesReminderRecipients.filter(Boolean),
        isGlobal: waForm.isGlobal,
        alertRecipients: waForm.alertRecipients.filter(Boolean),
        reportRecipients: waForm.reportRecipients.filter(Boolean),
        reportSchedule: waForm.reportSchedule
      }
    })
    toast.add({
      title: 'WhatsApp salvo',
      description: 'Configurações de WhatsApp atualizadas.',
      color: 'success',
      icon: 'i-heroicons-check-circle'
    })
    await refreshWA()
  } catch (e: unknown) {
    const err = e as { data?: { statusMessage?: string }, message?: string }
    toast.add({
      title: 'Erro ao salvar',
      description:
        err?.data?.statusMessage ?? err?.message ?? 'Tente novamente.',
      color: 'error',
      icon: 'i-heroicons-exclamation-circle'
    })
  } finally {
    loadingSaveWA.value = false
  }
}

const handleConnect = async () => {
  loadingConnect.value = true
  try {
    const res = await $fetch<{ ok: boolean, message: string }>(
      `/api/whatsapp/connect?companyId=${companyId.value}`,
      { method: 'POST' }
    )
    toast.add({
      title: res.ok ? 'Conectado' : 'Atenção',
      description: res.message,
      color: res.ok ? 'success' : 'warning',
      icon: res.ok
        ? 'i-heroicons-check-circle'
        : 'i-heroicons-exclamation-triangle'
    })
    await refreshWA()
  } catch (e: unknown) {
    const err = e as { data?: { statusMessage?: string }, message?: string }
    toast.add({
      title: 'Erro',
      description:
        err?.data?.statusMessage ?? err?.message ?? 'Falha ao conectar.',
      color: 'error',
      icon: 'i-heroicons-exclamation-circle'
    })
  } finally {
    loadingConnect.value = false
  }
}

const handleDisconnect = async () => {
  loadingDisconnect.value = true
  try {
    await $fetch(`/api/whatsapp/disconnect?companyId=${companyId.value}`, {
      method: 'POST'
    })
    toast.add({
      title: 'Desconectado',
      description: 'WhatsApp desconectado com sucesso.',
      color: 'info',
      icon: 'i-heroicons-information-circle'
    })
    await refreshWA()
  } catch (e: unknown) {
    const err = e as { data?: { statusMessage?: string }, message?: string }
    toast.add({
      title: 'Erro',
      description:
        err?.data?.statusMessage ?? err?.message ?? 'Falha ao desconectar.',
      color: 'error',
      icon: 'i-heroicons-exclamation-circle'
    })
  } finally {
    loadingDisconnect.value = false
  }
}

const handleTestPing = async () => {
  loadingTestPing.value = true
  try {
    const res = await $fetch<{ ok: boolean, message: string }>(
      `/api/whatsapp/test?companyId=${companyId.value}`,
      { method: 'POST', body: { mode: 'ping' } }
    )
    toast.add({
      title: res.ok ? 'API acessível' : 'Falha',
      description: res.message,
      color: res.ok ? 'success' : 'error',
      icon: res.ok
        ? 'i-heroicons-check-circle'
        : 'i-heroicons-exclamation-circle'
    })
  } catch (e: unknown) {
    const err = e as { data?: { statusMessage?: string }, message?: string }
    toast.add({
      title: 'Erro',
      description:
        err?.data?.statusMessage ?? err?.message ?? 'Falha ao testar.',
      color: 'error',
      icon: 'i-heroicons-exclamation-circle'
    })
  } finally {
    loadingTestPing.value = false
  }
}

const handleTestMessage = async () => {
  if (!waTestNum.value || !/^\+\d{5,15}$/.test(waTestNum.value)) {
    toast.add({
      title: 'Número inválido',
      description: 'Use o formato +5511999999999',
      color: 'warning',
      icon: 'i-heroicons-exclamation-triangle'
    })
    return
  }
  loadingTestMsg.value = true
  try {
    const res = await $fetch<{ ok: boolean, message: string }>(
      `/api/whatsapp/test?companyId=${companyId.value}`,
      {
        method: 'POST',
        body: { mode: 'message', toNumber: waTestNum.value }
      }
    )
    toast.add({
      title: res.ok ? 'Mensagem enviada' : 'Falha',
      description: res.message,
      color: res.ok ? 'success' : 'error',
      icon: res.ok
        ? 'i-heroicons-check-circle'
        : 'i-heroicons-exclamation-circle'
    })
  } catch (e: unknown) {
    const err = e as { data?: { statusMessage?: string }, message?: string }
    toast.add({
      title: 'Erro',
      description:
        err?.data?.statusMessage ?? err?.message ?? 'Falha ao enviar.',
      color: 'error',
      icon: 'i-heroicons-exclamation-circle'
    })
  } finally {
    loadingTestMsg.value = false
  }
}

const handleSendReport = async () => {
  loadingReport.value = true
  try {
    const res = await $fetch<{ ok: boolean, message: string }>(
      `/api/whatsapp/report?companyId=${companyId.value}`,
      {
        method: 'POST',
        body: { companyName: companyRaw.value?.name ?? 'Meu Concreto' }
      }
    )
    toast.add({
      title: res.ok ? 'Relatório enviado' : 'Falha',
      description: res.message,
      color: res.ok ? 'success' : 'error',
      icon: res.ok
        ? 'i-heroicons-check-circle'
        : 'i-heroicons-exclamation-circle'
    })
  } catch (e: unknown) {
    const err = e as { data?: { statusMessage?: string }, message?: string }
    toast.add({
      title: 'Erro',
      description:
        err?.data?.statusMessage
        ?? err?.message
        ?? 'Falha ao enviar relatório.',
      color: 'error',
      icon: 'i-heroicons-exclamation-circle'
    })
  } finally {
    loadingReport.value = false
  }
}

// ─────────────────────────────────────────────
// Appearance
// ─────────────────────────────────────────────
const themeOptions = [
  { label: 'Sistema', value: 'system', icon: 'i-heroicons-computer-desktop' },
  { label: 'Claro', value: 'light', icon: 'i-heroicons-sun' },
  { label: 'Escuro', value: 'dark', icon: 'i-heroicons-moon' }
]

// User initials for avatar
const userInitials = computed(() => {
  const n = user.value?.name ?? ''
  const parts = n.trim().split(' ').filter(Boolean)
  if (parts.length >= 2) {
    const first = parts[0] ?? ''
    const last = parts[parts.length - 1] ?? ''
    return (first.charAt(0) + last.charAt(0)).toUpperCase()
  }
  return n.slice(0, 2).toUpperCase()
})

// Role label
const roleLabel = computed(() => {
  const map: Record<string, string> = {
    admin: 'Administrador',
    manager: 'Gerente',
    user: 'Usuário'
  }
  return map[user.value?.role ?? 'user'] ?? 'Usuário'
})
</script>

<template>
  <div class="p-6 lg:p-8 space-y-6">
    <!-- ── Page Header ── -->
    <div class="flex items-start justify-between gap-4">
      <div>
        <h1 class="text-2xl font-black text-zinc-900 dark:text-white">
          Configurações
        </h1>
        <p class="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
          Gerencie os dados da empresa, seu perfil e preferências do sistema.
        </p>
      </div>
    </div>

    <!-- ── Layout: 2 columns on lg+ ── -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <!-- ══ LEFT COLUMN ══════════════════════════════════════════════════ -->
      <div class="lg:col-span-2 space-y-6">
        <!-- ── 1. Empresa ── -->
        <UCard>
          <template #header>
            <div class="flex items-center gap-3">
              <div
                class="w-9 h-9 rounded-xl bg-primary-50 dark:bg-primary-500/10 flex items-center justify-center shrink-0"
              >
                <UIcon
                  name="i-heroicons-building-office-2"
                  class="w-5 h-5 text-primary-500"
                />
              </div>
              <div>
                <h2
                  class="text-sm font-black uppercase tracking-widest text-zinc-400"
                >
                  Dados da Empresa
                </h2>
                <p class="text-xs text-zinc-400 mt-0.5">
                  Informações cadastrais e de contato
                </p>
              </div>
            </div>
          </template>

          <div
            v-if="loadingCompany"
            class="space-y-4 p-1"
          >
            <USkeleton
              v-for="i in 4"
              :key="i"
              class="h-10 rounded-xl"
            />
          </div>

          <div
            v-else
            class="space-y-4"
          >
            <!-- Nome -->
            <UFormField label="Razão Social *">
              <UInput
                v-model="companyForm.name"
                placeholder="Nome da empresa"
                icon="i-heroicons-building-office-2"
                class="w-full"
              />
            </UFormField>

            <!-- Email + Phone -->
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <UFormField label="E-mail">
                <UInput
                  v-model="companyForm.email"
                  type="email"
                  placeholder="contato@empresa.com.br"
                  icon="i-heroicons-envelope"
                  class="w-full"
                />
              </UFormField>
              <UFormField label="Telefone">
                <UInput
                  v-model="companyForm.phone"
                  placeholder="(00) 00000-0000"
                  icon="i-heroicons-phone"
                  class="w-full"
                />
              </UFormField>
            </div>

            <!-- CEP + State + City -->
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <UFormField label="CEP">
                <div class="relative">
                  <UInput
                    v-model="companyForm.zip"
                    placeholder="00000-000"
                    icon="i-heroicons-map-pin"
                    class="w-full"
                  />
                  <div
                    v-if="cepStatus === 'loading'"
                    class="absolute right-3 top-1/2 -translate-y-1/2"
                  >
                    <UIcon
                      name="i-heroicons-arrow-path"
                      class="w-4 h-4 text-zinc-400 animate-spin"
                    />
                  </div>
                </div>
                <p
                  v-if="cepMessage"
                  :class="
                    cepStatus === 'ok'
                      ? 'text-green-600 dark:text-green-400'
                      : 'text-red-500'
                  "
                  class="text-xs mt-1"
                >
                  {{ cepMessage }}
                </p>
              </UFormField>
              <UFormField label="Cidade">
                <UInput
                  v-model="companyForm.city"
                  placeholder="São Paulo"
                  class="w-full"
                />
              </UFormField>
              <UFormField label="Estado">
                <USelect
                  v-model="companyForm.state"
                  :items="BR_STATES"
                  value-key="value"
                  label-key="label"
                  placeholder="UF"
                  class="w-full"
                />
              </UFormField>
            </div>

            <!-- Endereço -->
            <UFormField label="Endereço">
              <UInput
                v-model="companyForm.address"
                placeholder="Rua, número, bairro"
                icon="i-heroicons-map"
                class="w-full"
              />
            </UFormField>

            <!-- Save -->
            <div class="flex justify-end pt-2">
              <UButton
                color="primary"
                icon="i-heroicons-check"
                :loading="loadingSaveCompany"
                @click="handleSaveCompany"
              >
                Salvar Empresa
              </UButton>
            </div>
          </div>
        </UCard>

        <!-- ── 2. Meu Perfil ── -->
        <UCard>
          <template #header>
            <div class="flex items-center gap-3">
              <div
                class="w-9 h-9 rounded-xl bg-primary-50 dark:bg-primary-500/10 flex items-center justify-center shrink-0"
              >
                <UIcon
                  name="i-heroicons-user-circle"
                  class="w-5 h-5 text-primary-500"
                />
              </div>
              <div>
                <h2
                  class="text-sm font-black uppercase tracking-widest text-zinc-400"
                >
                  Meu Perfil
                </h2>
                <p class="text-xs text-zinc-400 mt-0.5">
                  Dados pessoais do seu usuário
                </p>
              </div>
            </div>
          </template>

          <div class="space-y-4">
            <!-- Name + Phone -->
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <UFormField label="Nome *">
                <UInput
                  v-model="profileForm.name"
                  placeholder="Seu nome completo"
                  icon="i-heroicons-user"
                  class="w-full"
                />
              </UFormField>
              <UFormField label="Telefone">
                <UInput
                  v-model="profileForm.phone"
                  placeholder="(00) 00000-0000"
                  icon="i-heroicons-phone"
                  class="w-full"
                />
              </UFormField>
            </div>

            <!-- Read-only fields -->
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <UFormField label="E-mail">
                <UInput
                  :model-value="user?.email ?? ''"
                  disabled
                  icon="i-heroicons-envelope"
                  class="w-full opacity-60"
                />
              </UFormField>
              <UFormField label="Perfil de acesso">
                <UInput
                  :model-value="roleLabel"
                  disabled
                  icon="i-heroicons-shield-check"
                  class="w-full opacity-60"
                />
              </UFormField>
            </div>

            <p class="text-xs text-zinc-400">
              E-mail e perfil de acesso só podem ser alterados por um
              administrador.
            </p>

            <!-- Save -->
            <div class="flex justify-end pt-2">
              <UButton
                color="primary"
                icon="i-heroicons-check"
                :loading="loadingSaveProfile"
                @click="handleSaveProfile"
              >
                Salvar Perfil
              </UButton>
            </div>
          </div>
        </UCard>

        <!-- ── 3. WhatsApp ── -->
        <UCard>
          <template #header>
            <div class="flex items-center gap-3">
              <div
                class="w-9 h-9 rounded-xl bg-green-50 dark:bg-green-500/10 flex items-center justify-center shrink-0"
              >
                <UIcon
                  name="i-simple-icons-whatsapp"
                  class="w-5 h-5 text-green-500"
                />
              </div>
              <div>
                <h2
                  class="text-sm font-black uppercase tracking-widest text-zinc-400"
                >
                  WhatsApp
                </h2>
                <div class="flex items-center gap-2 mt-0.5">
                  <p class="text-xs text-zinc-400">
                    Alertas automáticos e relatórios
                  </p>
                  <UBadge
                    v-if="isUsingGlobal"
                    color="primary"
                    variant="soft"
                    size="sm"
                    class="text-[9px] px-1.5 py-0"
                  >
                    Global
                  </UBadge>
                </div>
              </div>
              <UBadge
                :color="waSettings?.isConnected ? 'success' : 'neutral'"
                variant="soft"
                size="sm"
                class="ml-auto shrink-0"
              >
                {{ waSettings?.isConnected ? "Conectado" : "Desconectado" }}
              </UBadge>
            </div>
          </template>

          <div class="space-y-6">
            <!-- API Configuration -->
            <div class="space-y-4">
              <div class="flex items-center justify-between">
                <p
                  class="text-xs font-black uppercase tracking-widest text-zinc-400"
                >
                  Configuração da API Baileys
                </p>
                <div
                  v-if="user?.role === 'admin'"
                  class="flex items-center gap-2"
                >
                  <p class="text-[10px] font-bold text-zinc-400 uppercase">
                    Instância Global
                  </p>
                  <USwitch
                    v-model="waForm.isGlobal"
                    color="primary"
                    size="sm"
                  />
                </div>
              </div>

              <!-- Info if using Global settings -->
              <div
                v-if="isUsingGlobal && !waForm.isGlobal"
                class="p-3 rounded-xl bg-primary-50 dark:bg-primary-500/10 border border-primary-100 dark:border-primary-500/20 flex gap-3"
              >
                <UIcon
                  name="i-heroicons-information-circle"
                  class="w-5 h-5 text-primary-500 shrink-0 mt-0.5"
                />
                <p class="text-xs text-primary-700 dark:text-primary-300">
                  Esta empresa está utilizando uma
                  <b>instância global</b> configurada pelo administrador.
                  Preencher os campos abaixo irá sobrescrever a conexão para
                  esta empresa específica.
                </p>
              </div>

              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <UFormField
                  label="URL da API"
                  class="md:col-span-2"
                >
                  <UInput
                    v-model="waForm.apiUrl"
                    placeholder="http://localhost:3025"
                    icon="i-heroicons-globe-alt"
                    class="w-full"
                    :disabled="user?.role !== 'admin'"
                  />
                </UFormField>

                <UFormField label="API Key">
                  <div class="flex gap-2">
                    <UInput
                      v-model="waForm.apiKey"
                      :type="showApiKey ? 'text' : 'password'"
                      placeholder="Sua chave de API"
                      icon="i-heroicons-key"
                      class="w-full"
                      :disabled="user?.role !== 'admin'"
                    />
                    <UButton
                      color="neutral"
                      variant="ghost"
                      :disabled="user?.role !== 'admin'"
                      :icon="
                        showApiKey ? 'i-heroicons-eye-slash' : 'i-heroicons-eye'
                      "
                      @click="showApiKey = !showApiKey"
                    />
                  </div>
                </UFormField>

                <UFormField label="Número Remetente (WhatsApp)">
                  <UInput
                    v-model="waForm.phoneNumber"
                    placeholder="+5511999999999"
                    icon="i-heroicons-phone"
                    class="w-full"
                    :disabled="user?.role !== 'admin'"
                  />
                </UFormField>
              </div>

              <!-- Connection controls -->
              <div
                v-if="user?.role === 'admin'"
                class="flex flex-wrap gap-2 pt-1"
              >
                <UButton
                  color="success"
                  variant="soft"
                  icon="i-simple-icons-whatsapp"
                  :loading="loadingConnect"
                  @click="handleConnect"
                >
                  Conectar
                </UButton>
                <UButton
                  color="error"
                  variant="soft"
                  icon="i-heroicons-power"
                  :loading="loadingDisconnect"
                  :disabled="!waSettings?.isConnected"
                  @click="handleDisconnect"
                >
                  Desconectar
                </UButton>
                <UButton
                  color="neutral"
                  variant="ghost"
                  icon="i-heroicons-wifi"
                  :loading="loadingTestPing"
                  @click="handleTestPing"
                >
                  Testar API
                </UButton>
              </div>
            </div>

            <div class="border-t border-zinc-100 dark:border-zinc-800" />

            <!-- Alerts -->
            <div class="space-y-4">
              <div>
                <p class="text-sm font-bold text-zinc-900 dark:text-white">
                  Alertas em Tempo Real
                </p>
                <p class="text-xs text-zinc-400 mt-0.5">
                  Notificar ao registrar nova venda ou orçamento
                </p>
              </div>

              <div class="space-y-3">
                <div
                  class="flex items-center justify-between gap-4 p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/50"
                >
                  <div class="flex items-center gap-3">
                    <div
                      class="w-8 h-8 rounded-lg bg-primary-100 dark:bg-primary-500/10 flex items-center justify-center"
                    >
                      <UIcon
                        name="i-heroicons-bell"
                        class="w-4 h-4 text-primary-500"
                      />
                    </div>
                    <div>
                      <p
                        class="text-sm font-medium text-zinc-700 dark:text-zinc-300"
                      >
                        Ativar Alertas
                      </p>
                      <p class="text-[10px] text-zinc-400">
                        Envio imediato para os números configurados
                      </p>
                    </div>
                  </div>
                  <USwitch
                    v-model="waForm.alertsEnabled"
                    color="success"
                  />
                </div>

                <!-- Alert Recipients -->
                <Transition
                  enter-active-class="transition-all duration-300 ease-out"
                  enter-from-class="opacity-0 -translate-y-2 max-h-0"
                  enter-to-class="opacity-100 translate-y-0 max-h-[800px]"
                  leave-active-class="transition-all duration-200 ease-in"
                  leave-from-class="opacity-100 translate-y-0 max-h-[800px]"
                  leave-to-class="opacity-0 -translate-y-2 max-h-0"
                >
                  <div
                    v-if="waForm.alertsEnabled"
                    class="space-y-3 overflow-hidden"
                  >
                    <div class="px-3 pt-2">
                      <p
                        class="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-2"
                      >
                        Destinatários dos Alertas
                      </p>
                      <div class="space-y-2">
                        <div
                          v-for="(_, i) in waForm.alertRecipients"
                          :key="i"
                          class="flex items-center gap-2"
                        >
                          <UInput
                            v-model="waForm.alertRecipients[i]"
                            icon="i-heroicons-phone"
                            placeholder="+55 (00) 00000-0000"
                            class="flex-1"
                            size="sm"
                          />
                          <UButton
                            color="error"
                            variant="ghost"
                            size="sm"
                            icon="i-heroicons-trash"
                            @click="waForm.alertRecipients.splice(i, 1)"
                          />
                        </div>
                        <UButton
                          color="neutral"
                          variant="ghost"
                          size="sm"
                          icon="i-heroicons-plus"
                          class="w-full justify-center border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl py-2"
                          @click="waForm.alertRecipients.push('')"
                        >
                          Adicionar número
                        </UButton>
                      </div>
                    </div>
                  </div>
                </Transition>
              </div>
            </div>

            <div class="border-t border-zinc-100 dark:border-zinc-800" />

            <!-- Reports -->
            <div class="space-y-4">
              <div>
                <p class="text-sm font-bold text-zinc-900 dark:text-white">
                  Relatórios Automáticos
                </p>
                <p class="text-xs text-zinc-400 mt-0.5">
                  Envio periódico de resumo financeiro do período
                </p>
              </div>

              <div class="space-y-3">
                <div
                  class="flex items-center justify-between gap-4 p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/50"
                >
                  <div class="flex items-center gap-3">
                    <div
                      class="w-8 h-8 rounded-lg bg-primary-100 dark:bg-primary-500/10 flex items-center justify-center"
                    >
                      <UIcon
                        name="i-heroicons-chart-bar"
                        class="w-4 h-4 text-primary-500"
                      />
                    </div>
                    <div>
                      <p
                        class="text-sm font-medium text-zinc-700 dark:text-zinc-300"
                      >
                        Ativar Relatórios
                      </p>
                      <p class="text-[10px] text-zinc-400">
                        Resumo de caixa e faturamento agendado
                      </p>
                    </div>
                  </div>
                  <USwitch
                    v-model="waForm.reportsEnabled"
                    color="success"
                  />
                </div>

                <!-- Report Details -->
                <Transition
                  enter-active-class="transition-all duration-300 ease-out"
                  enter-from-class="opacity-0 -translate-y-2 max-h-0"
                  enter-to-class="opacity-100 translate-y-0 max-h-[800px]"
                  leave-active-class="transition-all duration-200 ease-in"
                  leave-from-class="opacity-100 translate-y-0 max-h-[800px]"
                  leave-to-class="opacity-0 -translate-y-2 max-h-0"
                >
                  <div
                    v-if="waForm.reportsEnabled"
                    class="space-y-4 overflow-hidden"
                  >
                    <div class="px-3 pt-2 space-y-4">
                      <UFormField label="Frequência do Envio">
                        <USelect
                          v-model="waForm.reportSchedule"
                          :items="REPORT_SCHEDULE_OPTS"
                          value-key="value"
                          label-key="label"
                          class="w-full"
                          size="sm"
                        />
                      </UFormField>

                      <div class="space-y-2">
                        <p
                          class="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-2"
                        >
                          Destinatários dos Relatórios
                        </p>
                        <div
                          v-for="(_, i) in waForm.reportRecipients"
                          :key="i"
                          class="flex items-center gap-2"
                        >
                          <UInput
                            v-model="waForm.reportRecipients[i]"
                            icon="i-heroicons-phone"
                            placeholder="+55 (00) 00000-0000"
                            class="flex-1"
                            size="sm"
                          />
                          <UButton
                            color="error"
                            variant="ghost"
                            size="sm"
                            icon="i-heroicons-trash"
                            @click="waForm.reportRecipients.splice(i, 1)"
                          />
                        </div>
                        <UButton
                          color="neutral"
                          variant="ghost"
                          icon="i-heroicons-plus"
                          size="sm"
                          class="w-full justify-center border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl py-2"
                          @click="waForm.reportRecipients.push('')"
                        >
                          Adicionar número
                        </UButton>
                      </div>

                      <UButton
                        color="success"
                        variant="soft"
                        icon="i-heroicons-paper-airplane"
                        :loading="loadingReport"
                        class="w-full"
                        @click="handleSendReport"
                      >
                        Enviar Relatório Agora
                      </UButton>
                    </div>
                  </div>
                </Transition>
              </div>
            </div>

            <div class="border-t border-zinc-100 dark:border-zinc-800" />

            <!-- Quote PDF Automation -->
            <div class="space-y-4">
              <div>
                <p class="text-sm font-bold text-zinc-900 dark:text-white">
                  Envio de Orçamentos (PDF)
                </p>
                <p class="text-xs text-zinc-400 mt-0.5">
                  Enviar arquivo PDF profissional automaticamente via WhatsApp
                </p>
              </div>

              <div class="space-y-3">
                <div
                  class="flex items-center justify-between gap-4 p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/50"
                >
                  <div class="flex items-center gap-3">
                    <div
                      class="w-8 h-8 rounded-lg bg-primary-100 dark:bg-primary-500/10 flex items-center justify-center"
                    >
                      <UIcon
                        name="i-heroicons-user"
                        class="w-4 h-4 text-primary-500"
                      />
                    </div>
                    <div>
                      <p
                        class="text-sm font-medium text-zinc-700 dark:text-zinc-300"
                      >
                        Enviar para o Vendedor
                      </p>
                      <p class="text-[10px] text-zinc-400">
                        PDF contendo logo e marca d'água
                      </p>
                    </div>
                  </div>
                  <USwitch
                    v-model="waForm.quotePdfToSeller"
                    color="success"
                  />
                </div>

                <div
                  class="flex items-center justify-between gap-4 p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/50"
                >
                  <div class="flex items-center gap-3">
                    <div
                      class="w-8 h-8 rounded-lg bg-primary-100 dark:bg-primary-500/10 flex items-center justify-center"
                    >
                      <UIcon
                        name="i-heroicons-users"
                        class="w-4 h-4 text-primary-500"
                      />
                    </div>
                    <div>
                      <p
                        class="text-sm font-medium text-zinc-700 dark:text-zinc-300"
                      >
                        Enviar para o Cliente
                      </p>
                      <p class="text-[10px] text-zinc-400">
                        Automatiza entrega profissional ao concluir
                      </p>
                    </div>
                  </div>
                  <USwitch
                    v-model="waForm.quotePdfToCustomer"
                    color="success"
                  />
                </div>
              </div>
            </div>

            <div class="border-t border-zinc-100 dark:border-zinc-800" />

            <!-- Scheduling Reminders -->
            <div class="space-y-4">
              <div>
                <p class="text-sm font-bold text-zinc-900 dark:text-white">
                  Lembretes de Agendamento
                </p>
                <p class="text-xs text-zinc-400 mt-0.5">
                  Enviar alertas automáticos para as datas programadas
                </p>
              </div>

              <div class="space-y-3">
                <div
                  class="flex items-center justify-between gap-4 p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/50"
                >
                  <div class="flex items-center gap-3">
                    <div
                      class="w-8 h-8 rounded-lg bg-primary-100 dark:bg-primary-500/10 flex items-center justify-center"
                    >
                      <UIcon
                        name="i-heroicons-calendar-days"
                        class="w-4 h-4 text-primary-500"
                      />
                    </div>
                    <div>
                      <p
                        class="text-sm font-medium text-zinc-700 dark:text-zinc-300"
                      >
                        Ativar Lembretes
                      </p>
                      <p class="text-[10px] text-zinc-400">
                        Envia lembrete aos números configurados
                      </p>
                    </div>
                  </div>
                  <USwitch
                    v-model="waForm.schedulesReminderEnabled"
                    color="success"
                  />
                </div>

                <!-- Scheduling Reminder Recipients -->
                <Transition
                  enter-active-class="transition-all duration-300 ease-out"
                  enter-from-class="opacity-0 -translate-y-2 max-h-0"
                  enter-to-class="opacity-100 translate-y-0 max-h-[800px]"
                  leave-active-class="transition-all duration-200 ease-in"
                  leave-from-class="opacity-100 translate-y-0 max-h-[800px]"
                  leave-to-class="opacity-0 -translate-y-2 max-h-0"
                >
                  <div
                    v-if="waForm.schedulesReminderEnabled"
                    class="space-y-3 overflow-hidden"
                  >
                    <div class="px-3 pt-2">
                      <div class="flex items-center justify-between gap-4 mb-4">
                        <div>
                          <p
                            class="text-[10px] font-black uppercase tracking-widest text-zinc-400"
                          >
                            Tempo de Antecedência
                          </p>
                          <p class="text-[10px] text-zinc-400">
                            Ex: 24 horas antes da entrega
                          </p>
                        </div>
                        <UInput
                          v-model="waForm.schedulesReminderLeadTimeHours"
                          type="number"
                          size="sm"
                          class="w-24"
                          suffix="horas"
                        />
                      </div>

                      <p
                        class="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-2"
                      >
                        Destinatários dos Agendamentos
                      </p>
                      <div class="space-y-2">
                        <div
                          v-for="(_, i) in waForm.schedulesReminderRecipients"
                          :key="i"
                          class="flex items-center gap-2"
                        >
                          <UInput
                            v-model="waForm.schedulesReminderRecipients[i]"
                            icon="i-heroicons-phone"
                            placeholder="+55 (00) 00000-0000"
                            class="flex-1"
                            size="sm"
                          />
                          <UButton
                            color="error"
                            variant="ghost"
                            icon="i-heroicons-trash"
                            size="sm"
                            @click="
                              waForm.schedulesReminderRecipients.splice(i, 1)
                            "
                          />
                        </div>
                        <UButton
                          color="neutral"
                          variant="ghost"
                          icon="i-heroicons-plus"
                          size="sm"
                          class="w-full justify-center border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl py-2"
                          @click="waForm.schedulesReminderRecipients.push('')"
                        >
                          Adicionar número
                        </UButton>
                      </div>
                    </div>
                  </div>
                </Transition>
              </div>
            </div>

            <div class="border-t border-zinc-100 dark:border-zinc-800" />

            <!-- Test message -->
            <div class="space-y-4">
              <div>
                <p class="text-sm font-bold text-zinc-900 dark:text-white">
                  Mensagem de Teste
                </p>
                <p class="text-xs text-zinc-400 mt-0.5">
                  Valide sua conexão enviando uma mensagem manual para um número
                </p>
              </div>
              <div class="flex gap-2">
                <UInput
                  v-model="waTestNum"
                  placeholder="+55 (00) 00000-0000"
                  icon="i-heroicons-chat-bubble-left-right"
                  size="sm"
                  class="flex-1"
                />
                <UButton
                  color="success"
                  size="sm"
                  icon="i-heroicons-paper-airplane"
                  :loading="loadingTestMsg"
                  @click="handleTestMessage"
                >
                  Enviar
                </UButton>
              </div>
            </div>

            <!-- Save -->
            <div
              class="flex justify-end pt-4 border-t border-zinc-100 dark:border-zinc-800"
            >
              <UButton
                color="primary"
                icon="i-heroicons-check"
                size="md"
                class="px-6 shadow-lg shadow-primary-500/20"
                :loading="loadingSaveWA"
                @click="handleSaveWA"
              >
                Salvar Configurações
              </UButton>
            </div>
          </div>
        </UCard>
      </div>

      <!-- ══ RIGHT COLUMN ═════════════════════════════════════════════════ -->
      <div class="space-y-6">
        <!-- ── 3. User card ── -->
        <UCard>
          <template #header>
            <h2
              class="text-sm font-black uppercase tracking-widest text-zinc-400"
            >
              Conta
            </h2>
          </template>

          <div class="flex flex-col items-center gap-4 py-2">
            <!-- Avatar -->
            <div
              class="w-16 h-16 rounded-full bg-primary-500 flex items-center justify-center shadow-lg shadow-primary-500/20"
            >
              <span class="text-xl font-black text-white tracking-tight">{{
                userInitials
              }}</span>
            </div>
            <div class="text-center">
              <p class="text-sm font-bold text-zinc-900 dark:text-white">
                {{ user?.name }}
              </p>
              <p class="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                {{ user?.email }}
              </p>
              <UBadge
                color="success"
                variant="soft"
                size="sm"
                class="mt-2"
              >
                {{ roleLabel }}
              </UBadge>
            </div>

            <!-- Company info -->
            <div
              v-if="companyRaw"
              class="w-full rounded-xl bg-zinc-50 dark:bg-zinc-800/50 ring-1 ring-zinc-200 dark:ring-zinc-700 px-4 py-3"
            >
              <p
                class="text-xs font-black uppercase tracking-widest text-zinc-400 mb-1"
              >
                Empresa Ativa
              </p>
              <p
                class="text-sm font-bold text-zinc-900 dark:text-white truncate"
              >
                {{ companyRaw.name }}
              </p>
              <p
                v-if="companyRaw.city"
                class="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5"
              >
                {{ companyRaw.city
                }}{{ companyRaw.state ? `, ${companyRaw.state}` : "" }}
              </p>
            </div>
          </div>
        </UCard>

        <!-- ── 4. Aparência ── -->
        <UCard>
          <template #header>
            <div class="flex items-center gap-3">
              <div
                class="w-9 h-9 rounded-xl bg-primary-50 dark:bg-primary-500/10 flex items-center justify-center shrink-0"
              >
                <UIcon
                  name="i-heroicons-swatch"
                  class="w-5 h-5 text-primary-500"
                />
              </div>
              <div>
                <h2
                  class="text-sm font-black uppercase tracking-widest text-zinc-400"
                >
                  Aparência
                </h2>
                <p class="text-xs text-zinc-400 mt-0.5">
                  Tema da interface
                </p>
              </div>
            </div>
          </template>

          <div class="space-y-2">
            <button
              v-for="opt in themeOptions"
              :key="opt.value"
              class="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 text-sm font-bold text-left"
              :class="
                colorMode.preference === opt.value
                  ? 'bg-primary-500 text-white shadow-lg shadow-primary-500/20'
                  : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-white'
              "
              @click="colorMode.preference = opt.value"
            >
              <UIcon
                :name="opt.icon"
                class="w-4 h-4 shrink-0"
              />
              {{ opt.label }}
              <UIcon
                v-if="colorMode.preference === opt.value"
                name="i-heroicons-check"
                class="w-4 h-4 ml-auto shrink-0"
              />
            </button>
          </div>
        </UCard>

        <!-- ── 5. Info do Sistema ── -->
        <UCard>
          <template #header>
            <h2
              class="text-sm font-black uppercase tracking-widest text-zinc-400"
            >
              Sistema
            </h2>
          </template>

          <div class="space-y-3">
            <div class="flex items-center justify-between">
              <span class="text-xs text-zinc-500 dark:text-zinc-400">Aplicação</span>
              <span class="text-xs font-bold text-zinc-900 dark:text-white">Meu Concreto</span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-xs text-zinc-500 dark:text-zinc-400">Versão</span>
              <UBadge
                color="neutral"
                variant="soft"
                size="sm"
              >
                v1.0.0
              </UBadge>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-xs text-zinc-500 dark:text-zinc-400">Ambiente</span>
              <UBadge
                color="info"
                variant="soft"
                size="sm"
              >
                Produção
              </UBadge>
            </div>
            <div
              class="border-t border-zinc-100 dark:border-zinc-800 pt-3 mt-3 flex items-center justify-between"
            >
              <span class="text-xs text-zinc-500 dark:text-zinc-400">Empresa ID</span>
              <span
                class="text-xs font-mono font-bold text-zinc-900 dark:text-white"
              >#{{ companyId }}</span>
            </div>
          </div>
        </UCard>
      </div>
    </div>
  </div>
</template>
