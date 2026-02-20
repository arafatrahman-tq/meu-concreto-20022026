<script setup lang="ts">
definePageMeta({ layout: 'default' })
useSeoMeta({ title: 'Formas de Pagamento | Meu Concreto' })

const { companyId } = useAuth()
const toast = useToast()

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
type MethodType
  = | 'cash'
    | 'credit_card'
    | 'debit_card'
    | 'pix'
    | 'boleto'
    | 'transfer'
    | 'check'
    | 'other'

interface PaymentMethodDetails {
  maxInstallments?: number
  interestRate?: number
  pixKey?: string
  pixKeyType?: string
  bankName?: string
  accountInfo?: string
  instructions?: string
}

interface PaymentMethod {
  id: number
  companyId: number
  name: string
  type: MethodType
  details?: PaymentMethodDetails | null
  active: boolean
  createdAt: string | number
  updatedAt: string | number
}

// ─────────────────────────────────────────────
// Data
// ─────────────────────────────────────────────
const {
  data: pmData,
  refresh,
  pending: loadingList
} = await useFetch<{ paymentMethods: PaymentMethod[] }>('/api/payment-methods', {
  query: { companyId }
})

const methodsList = computed<PaymentMethod[]>(() => pmData.value?.paymentMethods ?? [])

// ─────────────────────────────────────────────
// KPIs
// ─────────────────────────────────────────────
const stats = computed(() => {
  const list = methodsList.value
  const uniqueTypes = new Set(list.map(m => m.type)).size
  return {
    total: list.length,
    active: list.filter(m => m.active).length,
    inactive: list.filter(m => !m.active).length,
    uniqueTypes
  }
})

// ─────────────────────────────────────────────
// Type config
// ─────────────────────────────────────────────
const TYPE_CONFIG: Record<MethodType, { label: string, icon: string, color: string, bg: string }> = {
  cash: { label: 'Dinheiro', icon: 'i-heroicons-banknotes', color: 'text-green-600 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-500/10' },
  credit_card: { label: 'Cartão de Crédito', icon: 'i-heroicons-credit-card', color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-500/10' },
  debit_card: { label: 'Cartão de Débito', icon: 'i-heroicons-credit-card', color: 'text-indigo-600 dark:text-indigo-400', bg: 'bg-indigo-50 dark:bg-indigo-500/10' },
  pix: { label: 'Pix', icon: 'i-simple-icons-pix', color: 'text-teal-600 dark:text-teal-400', bg: 'bg-teal-50 dark:bg-teal-500/10' },
  boleto: { label: 'Boleto', icon: 'i-heroicons-document-text', color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-500/10' },
  transfer: { label: 'Transferência', icon: 'i-heroicons-arrows-right-left', color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-50 dark:bg-purple-500/10' },
  check: { label: 'Cheque', icon: 'i-heroicons-document-check', color: 'text-zinc-600 dark:text-zinc-400', bg: 'bg-zinc-100 dark:bg-zinc-800' },
  other: { label: 'Outro', icon: 'i-heroicons-ellipsis-horizontal-circle', color: 'text-zinc-500 dark:text-zinc-400', bg: 'bg-zinc-100 dark:bg-zinc-800' }
}

const TYPE_OPTS = Object.entries(TYPE_CONFIG).map(([value, cfg]) => ({
  value: value as MethodType,
  label: cfg.label
}))

const PIX_KEY_TYPES = [
  { value: 'cpf', label: 'CPF' },
  { value: 'cnpj', label: 'CNPJ' },
  { value: 'phone', label: 'Telefone' },
  { value: 'email', label: 'E-mail' },
  { value: 'random', label: 'Chave Aleatória' }
]

// ─────────────────────────────────────────────
// Filter & Search
// ─────────────────────────────────────────────
const search = ref('')
const typeFilter = ref<MethodType | 'all'>('all')
const activeFilter = ref<'all' | 'active' | 'inactive'>('all')

const filteredMethods = computed(() => {
  return methodsList.value.filter((m) => {
    const matchType = typeFilter.value === 'all' || m.type === typeFilter.value
    const matchActive
      = activeFilter.value === 'all'
        || (activeFilter.value === 'active' && m.active)
        || (activeFilter.value === 'inactive' && !m.active)
    const q = search.value.toLowerCase()
    const matchSearch = !q || m.name.toLowerCase().includes(q) || TYPE_CONFIG[m.type].label.toLowerCase().includes(q)
    return matchType && matchActive && matchSearch
  })
})

watch([search, typeFilter, activeFilter], () => {})

// ─────────────────────────────────────────────
// Drawer state
// ─────────────────────────────────────────────
const isDrawerOpen = ref(false)
const isEditing = ref(false)
const editingId = ref<number | null>(null)
const loadingSave = ref(false)

// ─────────────────────────────────────────────
// Form state
// ─────────────────────────────────────────────
const form = reactive({
  name: '',
  type: 'other' as MethodType,
  active: true,
  // Credit / Debit card extras
  maxInstallments: null as number | null,
  interestRate: null as number | null,
  // Pix extras
  pixKey: '',
  pixKeyType: 'cpf',
  // Boleto / Transfer extras
  bankName: '',
  accountInfo: '',
  instructions: ''
})

const showCardDetails = computed(() => form.type === 'credit_card' || form.type === 'debit_card')
const showPixDetails = computed(() => form.type === 'pix')
const showBankDetails = computed(() => form.type === 'boleto' || form.type === 'transfer')

function buildDetails(): PaymentMethodDetails | undefined {
  if (showCardDetails.value) {
    const d: PaymentMethodDetails = {}
    if (form.maxInstallments) d.maxInstallments = form.maxInstallments
    if (form.interestRate !== null) d.interestRate = form.interestRate
    return Object.keys(d).length ? d : undefined
  }
  if (showPixDetails.value) {
    const d: PaymentMethodDetails = {}
    if (form.pixKey) d.pixKey = form.pixKey
    if (form.pixKeyType) d.pixKeyType = form.pixKeyType
    return Object.keys(d).length ? d : undefined
  }
  if (showBankDetails.value) {
    const d: PaymentMethodDetails = {}
    if (form.bankName) d.bankName = form.bankName
    if (form.accountInfo) d.accountInfo = form.accountInfo
    if (form.instructions) d.instructions = form.instructions
    return Object.keys(d).length ? d : undefined
  }
  return undefined
}

function resetForm() {
  editingId.value = null
  isEditing.value = false
  form.name = ''
  form.type = 'other'
  form.active = true
  form.maxInstallments = null
  form.interestRate = null
  form.pixKey = ''
  form.pixKeyType = 'cpf'
  form.bankName = ''
  form.accountInfo = ''
  form.instructions = ''
}

function openCreate() {
  resetForm()
  isDrawerOpen.value = true
}

function openEdit(m: PaymentMethod) {
  resetForm()
  isEditing.value = true
  editingId.value = m.id
  form.name = m.name
  form.type = m.type
  form.active = m.active
  const d = m.details ?? {}
  form.maxInstallments = d.maxInstallments ?? null
  form.interestRate = d.interestRate ?? null
  form.pixKey = d.pixKey ?? ''
  form.pixKeyType = d.pixKeyType ?? 'cpf'
  form.bankName = d.bankName ?? ''
  form.accountInfo = d.accountInfo ?? ''
  form.instructions = d.instructions ?? ''
  isDrawerOpen.value = true
}

// ─────────────────────────────────────────────
// Save
// ─────────────────────────────────────────────
async function handleSave() {
  if (form.name.trim().length < 3) {
    toast.add({ title: 'Campos inválidos', description: 'O nome deve ter pelo menos 3 caracteres.', color: 'warning', icon: 'i-heroicons-exclamation-triangle' })
    return
  }

  loadingSave.value = true
  try {
    const payload = {
      name: form.name.trim(),
      type: form.type,
      active: form.active,
      details: buildDetails()
    }

    if (isEditing.value && editingId.value) {
      await $fetch(`/api/payment-methods/${editingId.value}`, { method: 'PUT', body: payload })
      toast.add({ title: 'Forma de pagamento atualizada', description: `"${form.name}" foi atualizada.`, color: 'success', icon: 'i-heroicons-check-circle' })
    } else {
      await $fetch('/api/payment-methods', { method: 'POST', body: { companyId: companyId.value, ...payload } })
      toast.add({ title: 'Forma de pagamento cadastrada', description: `"${form.name}" foi adicionada.`, color: 'success', icon: 'i-heroicons-check-circle' })
    }
    isDrawerOpen.value = false
    await refresh()
  } catch (e: unknown) {
    const err = e as { data?: { statusMessage?: string }, message?: string }
    toast.add({ title: 'Erro ao salvar', description: err?.data?.statusMessage ?? err?.message ?? 'Erro ao salvar.', color: 'error', icon: 'i-heroicons-exclamation-circle' })
  } finally {
    loadingSave.value = false
  }
}

// ─────────────────────────────────────────────
// Toggle active
// ─────────────────────────────────────────────
async function toggleActive(m: PaymentMethod) {
  try {
    await $fetch(`/api/payment-methods/${m.id}`, { method: 'PUT', body: { active: !m.active } })
    toast.add({
      title: m.active ? 'Desativada' : 'Ativada',
      description: `"${m.name}" foi ${m.active ? 'desativada' : 'ativada'}.`,
      color: m.active ? 'neutral' : 'success',
      icon: m.active ? 'i-heroicons-eye-slash' : 'i-heroicons-check-circle'
    })
    await refresh()
  } catch (e: unknown) {
    const err = e as { data?: { statusMessage?: string } }
    toast.add({ title: 'Erro', description: err?.data?.statusMessage ?? 'Tente novamente.', color: 'error' })
  }
}

// ─────────────────────────────────────────────
// Delete
// ─────────────────────────────────────────────
const deleteTarget = ref<PaymentMethod | null>(null)
const loadingDelete = ref(false)
const isDeleteModalOpen = ref(false)

function confirmDelete(m: PaymentMethod) {
  deleteTarget.value = m
  isDeleteModalOpen.value = true
}

async function handleDelete() {
  if (!deleteTarget.value) return
  loadingDelete.value = true
  const name = deleteTarget.value.name
  try {
    await $fetch(`/api/payment-methods/${deleteTarget.value.id}`, { method: 'DELETE' })
    isDeleteModalOpen.value = false
    toast.add({ title: 'Forma de pagamento excluída', description: `"${name}" foi removida.`, color: 'neutral', icon: 'i-heroicons-trash' })
    await refresh()
  } catch (e: unknown) {
    const err = e as { data?: { statusMessage?: string }, message?: string }
    toast.add({ title: 'Erro ao excluir', description: err?.data?.statusMessage ?? err?.message ?? 'Tente novamente.', color: 'error' })
  } finally {
    loadingDelete.value = false
    deleteTarget.value = null
  }
}

// ─────────────────────────────────────────────
// Row actions
// ─────────────────────────────────────────────
const rowActions = (m: PaymentMethod) => [
  [
    { label: 'Editar', icon: 'i-heroicons-pencil-square', onSelect: () => openEdit(m) },
    { label: m.active ? 'Desativar' : 'Ativar', icon: m.active ? 'i-heroicons-eye-slash' : 'i-heroicons-eye', onSelect: () => toggleActive(m) }
  ],
  [
    { label: 'Excluir', icon: 'i-heroicons-trash', color: 'error' as const, onSelect: () => confirmDelete(m) }
  ]
]

const STATUS_FILTER_OPTS = [
  { label: 'Todos', value: 'all' },
  { label: 'Ativos', value: 'active' },
  { label: 'Inativos', value: 'inactive' }
]

const ALL_TYPES_OPT = [{ value: 'all', label: 'Todos os tipos' }, ...TYPE_OPTS]
</script>

<template>
  <div class="p-6 lg:p-8 space-y-6">
    <!-- ── Page Header ── -->
    <div class="flex items-start justify-between gap-4">
      <div>
        <h1 class="text-2xl font-black text-zinc-900 dark:text-white">
          Formas de Pagamento
        </h1>
        <p class="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
          Gerencie os métodos de pagamento aceitos pela empresa
        </p>
      </div>
      <UButton
        color="primary"
        icon="i-heroicons-plus"
        size="md"
        class="shrink-0"
        @click="openCreate"
      >
        Nova Forma
      </UButton>
    </div>

    <!-- ── KPI Strip ── -->
    <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
      <div
        v-for="(kpi, i) in [
          {
            label: 'Total de Métodos',
            value: stats.total,
            icon: 'i-heroicons-credit-card',
            color: 'text-primary-500',
            bg: 'bg-primary-50 dark:bg-primary-500/10',
            sub: 'cadastrados'
          },
          {
            label: 'Métodos Ativos',
            value: stats.active,
            icon: 'i-heroicons-check-circle',
            color: 'text-green-500',
            bg: 'bg-green-50 dark:bg-green-500/10',
            sub: 'disponíveis'
          },
          {
            label: 'Métodos Inativos',
            value: stats.inactive,
            icon: 'i-heroicons-eye-slash',
            color: 'text-zinc-400',
            bg: 'bg-zinc-100 dark:bg-zinc-800',
            sub: 'desativados'
          },
          {
            label: 'Tipos em Uso',
            value: stats.uniqueTypes,
            icon: 'i-heroicons-squares-2x2',
            color: 'text-blue-500',
            bg: 'bg-blue-50 dark:bg-blue-500/10',
            sub: 'categorias'
          }
        ]"
        :key="i"
        class="rounded-2xl bg-white dark:bg-zinc-900 ring-1 ring-zinc-200 dark:ring-zinc-800 p-6 flex flex-col gap-4"
      >
        <div class="flex items-center justify-between">
          <span class="text-xs font-black uppercase tracking-widest text-zinc-400 leading-tight">
            {{ kpi.label }}
          </span>
          <div :class="['w-9 h-9 rounded-xl flex items-center justify-center', kpi.bg]">
            <UIcon
              :name="kpi.icon"
              :class="['w-5 h-5', kpi.color]"
            />
          </div>
        </div>
        <div>
          <span class="text-3xl font-black text-zinc-900 dark:text-white">{{ kpi.value }}</span>
        </div>
        <p class="text-xs text-zinc-500 font-bold">
          {{ kpi.sub }}
        </p>
      </div>
    </div>

    <!-- ── Table Card ── -->
    <UCard>
      <template #header>
        <div class="flex items-center justify-between gap-4">
          <h3 class="text-sm font-black uppercase tracking-widest text-zinc-400 shrink-0">
            Formas de Pagamento
          </h3>
          <div class="flex items-center gap-2 flex-wrap justify-end">
            <UInput
              v-model="search"
              size="sm"
              placeholder="Buscar..."
              icon="i-heroicons-magnifying-glass"
              class="w-40 lg:w-52"
            />
            <USelect
              v-model="typeFilter"
              :items="ALL_TYPES_OPT"
              value-key="value"
              label-key="label"
              size="sm"
              class="w-44"
            />
            <USelect
              v-model="activeFilter"
              :items="STATUS_FILTER_OPTS"
              value-key="value"
              label-key="label"
              size="sm"
              class="w-32"
            />
          </div>
        </div>
      </template>

      <!-- Loading -->
      <div
        v-if="loadingList"
        class="space-y-3 p-4"
      >
        <USkeleton
          v-for="i in 4"
          :key="i"
          class="h-14 rounded-xl"
        />
      </div>

      <!-- Empty state -->
      <div
        v-else-if="filteredMethods.length === 0"
        class="flex flex-col items-center justify-center py-16 text-zinc-400"
      >
        <UIcon
          name="i-heroicons-credit-card"
          class="w-12 h-12 mb-3"
        />
        <p class="text-sm font-bold">
          Nenhuma forma de pagamento encontrada
        </p>
        <p
          v-if="search || typeFilter !== 'all' || activeFilter !== 'all'"
          class="text-xs mt-1"
        >
          Tente ajustar os filtros
        </p>
        <UButton
          v-else
          color="primary"
          variant="soft"
          size="sm"
          class="mt-4"
          icon="i-heroicons-plus"
          @click="openCreate"
        >
          Criar primeira forma de pagamento
        </UButton>
      </div>

      <!-- Card Grid (payment methods are typically few — card layout is more readable) -->
      <div
        v-else
        class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 p-4"
      >
        <div
          v-for="m in filteredMethods"
          :key="m.id"
          :class="[
            'relative flex flex-col gap-4 rounded-2xl ring-1 p-5 transition-all group',
            m.active
              ? 'bg-white dark:bg-zinc-900 ring-zinc-200 dark:ring-zinc-800 hover:ring-primary-300 dark:hover:ring-primary-700'
              : 'bg-zinc-50/60 dark:bg-zinc-900/40 ring-zinc-100 dark:ring-zinc-800/50 opacity-70'
          ]"
        >
          <!-- Type icon + Name row -->
          <div class="flex items-start gap-3">
            <div :class="['w-10 h-10 rounded-xl flex items-center justify-center shrink-0', TYPE_CONFIG[m.type].bg]">
              <UIcon
                :name="TYPE_CONFIG[m.type].icon"
                :class="['w-5 h-5', TYPE_CONFIG[m.type].color]"
              />
            </div>
            <div class="flex-1 min-w-0">
              <p class="font-black text-zinc-900 dark:text-white leading-tight truncate">
                {{ m.name }}
              </p>
              <p class="text-xs text-zinc-400 font-bold mt-0.5">
                {{ TYPE_CONFIG[m.type].label }}
              </p>
            </div>
            <!-- Actions -->
            <UDropdownMenu
              :items="rowActions(m)"
              :content="{ align: 'end' }"
            >
              <UButton
                color="neutral"
                variant="ghost"
                icon="i-heroicons-ellipsis-vertical"
                size="xs"
                class="opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
              />
            </UDropdownMenu>
          </div>

          <!-- Details preview -->
          <div
            v-if="m.details && Object.keys(m.details).length > 0"
            class="flex flex-wrap gap-2"
          >
            <span
              v-if="m.details.maxInstallments"
              class="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-500"
            >
              <UIcon
                name="i-heroicons-queue-list"
                class="w-3 h-3"
              />
              Até {{ m.details.maxInstallments }}x
            </span>
            <span
              v-if="m.details.interestRate !== undefined && m.details.interestRate !== null"
              class="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-500"
            >
              <UIcon
                name="i-heroicons-percent-badge"
                class="w-3 h-3"
              />
              {{ m.details.interestRate }}% a.m.
            </span>
            <span
              v-if="m.details.pixKey"
              class="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded-lg bg-teal-50 dark:bg-teal-500/10 text-teal-600 dark:text-teal-400 max-w-full truncate"
            >
              <UIcon
                name="i-heroicons-key"
                class="w-3 h-3 shrink-0"
              />
              <span class="truncate">{{ m.details.pixKey }}</span>
            </span>
            <span
              v-if="m.details.bankName"
              class="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-500 truncate max-w-full"
            >
              <UIcon
                name="i-heroicons-building-library"
                class="w-3 h-3 shrink-0"
              />
              <span class="truncate">{{ m.details.bankName }}</span>
            </span>
          </div>

          <!-- Status footer -->
          <div class="flex items-center justify-between pt-1 border-t border-zinc-100 dark:border-zinc-800">
            <button
              class="group/toggle"
              @click="toggleActive(m)"
            >
              <UBadge
                :color="m.active ? 'success' : 'neutral'"
                variant="soft"
                size="sm"
                :icon="m.active ? 'i-heroicons-check-circle' : 'i-heroicons-eye-slash'"
                class="cursor-pointer transition-opacity group-hover/toggle:opacity-70"
              >
                {{ m.active ? 'Ativo' : 'Inativo' }}
              </UBadge>
            </button>
            <div class="flex items-center gap-1">
              <UButton
                color="neutral"
                variant="ghost"
                icon="i-heroicons-pencil-square"
                size="xs"
                class="opacity-0 group-hover:opacity-100 transition-opacity"
                @click="openEdit(m)"
              />
              <UButton
                color="error"
                variant="ghost"
                icon="i-heroicons-trash"
                size="xs"
                class="opacity-0 group-hover:opacity-100 transition-opacity"
                @click="confirmDelete(m)"
              />
            </div>
          </div>
        </div>
      </div>
    </UCard>

    <!-- ══════════════════════════════════════════
         DRAWER — Create / Edit
    ══════════════════════════════════════════ -->
    <USlideover
      v-model:open="isDrawerOpen"
      :title="isEditing ? 'Editar Forma de Pagamento' : 'Nova Forma de Pagamento'"
      side="right"
      :ui="{ content: 'w-full', footer: 'p-0 block' }"
    >
      <template #body>
        <div class="flex flex-col gap-6 p-6 overflow-y-auto h-full pb-24">
          <!-- ── Identificação ── -->
          <div class="space-y-4">
            <h4 class="text-xs font-black uppercase tracking-widest text-zinc-400 flex items-center gap-2">
              <UIcon
                name="i-heroicons-credit-card"
                class="w-4 h-4"
              />
              Identificação
            </h4>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <UFormField
                label="Nome *"
                class="col-span-full"
              >
                <UInput
                  v-model="form.name"
                  placeholder="ex: Cartão Visa, Pix Empresa, Boleto 30d"
                  icon="i-heroicons-tag"
                  class="w-full"
                />
              </UFormField>

              <UFormField
                label="Tipo *"
                class="col-span-full"
              >
                <USelect
                  v-model="form.type"
                  :items="TYPE_OPTS"
                  value-key="value"
                  label-key="label"
                  class="w-full"
                />
              </UFormField>
            </div>
          </div>

          <USeparator />

          <!-- ── Detalhes condicionais ── -->
          <Transition name="fade">
            <div
              v-if="showCardDetails"
              class="space-y-4"
            >
              <h4 class="text-xs font-black uppercase tracking-widest text-zinc-400 flex items-center gap-2">
                <UIcon
                  name="i-heroicons-credit-card"
                  class="w-4 h-4"
                />
                Configurações do Cartão
              </h4>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <UFormField label="Máx. Parcelas">
                  <UInput
                    v-model.number="form.maxInstallments"
                    type="number"
                    min="1"
                    max="48"
                    placeholder="ex: 12"
                    icon="i-heroicons-queue-list"
                    class="w-full"
                  />
                </UFormField>
                <UFormField label="Taxa de Juros (% a.m.)">
                  <UInput
                    v-model.number="form.interestRate"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="ex: 1.99"
                    icon="i-heroicons-percent-badge"
                    class="w-full"
                  />
                </UFormField>
              </div>
              <USeparator />
            </div>
          </Transition>

          <Transition name="fade">
            <div
              v-if="showPixDetails"
              class="space-y-4"
            >
              <h4 class="text-xs font-black uppercase tracking-widest text-zinc-400 flex items-center gap-2">
                <UIcon
                  name="i-simple-icons-pix"
                  class="w-4 h-4"
                />
                Dados do Pix
              </h4>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <UFormField label="Tipo de Chave">
                  <USelect
                    v-model="form.pixKeyType"
                    :items="PIX_KEY_TYPES"
                    value-key="value"
                    label-key="label"
                    class="w-full"
                  />
                </UFormField>
                <UFormField label="Chave Pix">
                  <UInput
                    v-model="form.pixKey"
                    placeholder="Informe a chave"
                    icon="i-heroicons-key"
                    class="w-full"
                  />
                </UFormField>
              </div>
              <USeparator />
            </div>
          </Transition>

          <Transition name="fade">
            <div
              v-if="showBankDetails"
              class="space-y-4"
            >
              <h4 class="text-xs font-black uppercase tracking-widest text-zinc-400 flex items-center gap-2">
                <UIcon
                  name="i-heroicons-building-library"
                  class="w-4 h-4"
                />
                {{ form.type === 'boleto' ? 'Dados do Boleto' : 'Dados Bancários' }}
              </h4>
              <div class="grid grid-cols-1 gap-4">
                <UFormField label="Banco">
                  <UInput
                    v-model="form.bankName"
                    placeholder="ex: Banco do Brasil, Bradesco"
                    icon="i-heroicons-building-library"
                    class="w-full"
                  />
                </UFormField>
                <UFormField :label="form.type === 'transfer' ? 'Dados da Conta' : 'Instruções'">
                  <UTextarea
                    v-if="form.type === 'transfer'"
                    v-model="form.accountInfo"
                    placeholder="Agência, conta, tipo..."
                    :rows="3"
                    class="w-full"
                  />
                  <UTextarea
                    v-else
                    v-model="form.instructions"
                    placeholder="Instruções para o pagador..."
                    :rows="3"
                    class="w-full"
                  />
                </UFormField>
              </div>
              <USeparator />
            </div>
          </Transition>

          <!-- ── Status ── -->
          <div class="space-y-4">
            <h4 class="text-xs font-black uppercase tracking-widest text-zinc-400 flex items-center gap-2">
              <UIcon
                name="i-heroicons-cog-6-tooth"
                class="w-4 h-4"
              />
              Configurações
            </h4>
            <div class="flex items-center justify-between p-4 rounded-xl ring-1 ring-zinc-200 dark:ring-zinc-700 bg-zinc-50 dark:bg-zinc-800/50">
              <div>
                <p class="text-sm font-bold text-zinc-900 dark:text-white">
                  Método Ativo
                </p>
                <p class="text-xs text-zinc-400 mt-0.5">
                  Métodos inativos não aparecem nas opções de pagamento de transações e vendas
                </p>
              </div>
              <button
                type="button"
                :class="[
                  'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none',
                  form.active ? 'bg-primary-500' : 'bg-zinc-300 dark:bg-zinc-600'
                ]"
                @click="form.active = !form.active"
              >
                <span
                  :class="[
                    'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out',
                    form.active ? 'translate-x-5' : 'translate-x-0'
                  ]"
                />
              </button>
            </div>
          </div>
        </div>
      </template>

      <template #footer>
        <div class="flex items-center gap-3 p-6 border-t border-zinc-200 dark:border-zinc-800">
          <div class="flex-1 min-w-0">
            <UButton
              color="neutral"
              variant="outline"
              class="w-full"
              @click="isDrawerOpen = false"
            >
              Cancelar
            </UButton>
          </div>
          <div class="flex-1 min-w-0">
            <UButton
              color="primary"
              class="w-full"
              :loading="loadingSave"
              icon="i-heroicons-check"
              @click="handleSave"
            >
              {{ isEditing ? 'Salvar Alterações' : 'Cadastrar' }}
            </UButton>
          </div>
        </div>
      </template>
    </USlideover>

    <!-- ══════════════════════════════════════════
         MODAL — Delete Confirm
    ══════════════════════════════════════════ -->
    <UModal
      v-model:open="isDeleteModalOpen"
      title="Excluir Forma de Pagamento"
    >
      <template #body>
        <div class="p-6 space-y-4">
          <div class="flex items-start gap-4">
            <div class="w-12 h-12 rounded-full bg-red-50 dark:bg-red-500/10 flex items-center justify-center shrink-0">
              <UIcon
                name="i-heroicons-trash"
                class="w-6 h-6 text-red-500"
              />
            </div>
            <div class="flex-1 min-w-0">
              <p class="font-bold text-zinc-900 dark:text-white">
                Confirmar exclusão
              </p>
              <p class="text-sm text-zinc-500 mt-1">
                Tem certeza que deseja excluir
                <strong class="text-zinc-700 dark:text-zinc-300">"{{ deleteTarget?.name }}"</strong>?
                Esta ação não pode ser desfeita.
              </p>
            </div>
          </div>
          <div class="flex items-center justify-end gap-3 pt-2">
            <UButton
              color="neutral"
              variant="ghost"
              @click="isDeleteModalOpen = false"
            >
              Cancelar
            </UButton>
            <UButton
              color="error"
              :loading="loadingDelete"
              icon="i-heroicons-trash"
              @click="handleDelete"
            >
              Excluir
            </UButton>
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
