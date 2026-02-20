<script setup lang="ts">
definePageMeta({ layout: 'default' })
useSeoMeta({ title: 'Transações | Meu Concreto' })

const { user, companyId } = useAuth()
const toast = useToast()

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
type TransactionType = 'income' | 'expense'
type TransactionStatus = 'pending' | 'paid' | 'cancelled'

interface Transaction {
  id: number
  companyId: number
  userId?: number | null
  saleId?: number | null
  description: string
  amount: number // cents
  type: TransactionType
  category?: string | null
  status: TransactionStatus
  date: string | number
  dueDate?: string | number | null
  paymentMethod?: string | null
  createdAt: string | number
  updatedAt: string | number
  sale?: { id: number, customerName: string } | null
  user?: { id: number, name: string } | null
}

// ─────────────────────────────────────────────
// Data
// ─────────────────────────────────────────────
const {
  data: txData,
  refresh: refreshTransactions,
  pending: loadingTx
} = await useFetch('/api/transactions', {
  query: { companyId }
})

const transactions = computed<Transaction[]>(
  () => (txData.value as { transactions: Transaction[] } | null)?.transactions ?? []
)

// ─────────────────────────────────────────────
// Formatters
// ─────────────────────────────────────────────
const formatCurrency = (cents: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
    cents / 100
  )

const formatDate = (v: string | number | null | undefined) => {
  if (!v) return '—'
  return new Intl.DateTimeFormat('pt-BR').format(new Date(v as string | number))
}

// ─────────────────────────────────────────────
// Filters & Search
// ─────────────────────────────────────────────
const search = ref('')
const typeFilter = ref<TransactionType | 'all'>('all')
const statusFilter = ref<TransactionStatus | 'all'>('all')

const TYPE_OPTS = [
  { label: 'Todos os tipos', value: 'all' },
  { label: 'Receita', value: 'income' },
  { label: 'Despesa', value: 'expense' }
]

const STATUS_OPTS = [
  { label: 'Todos os status', value: 'all' },
  { label: 'Pendente', value: 'pending' },
  { label: 'Pago', value: 'paid' },
  { label: 'Cancelado', value: 'cancelled' }
]

const filteredTransactions = computed(() => {
  return transactions.value
    .filter((t) => {
      const matchType = typeFilter.value === 'all' || t.type === typeFilter.value
      const matchStatus
        = statusFilter.value === 'all' || t.status === statusFilter.value
      const q = search.value.toLowerCase()
      const matchSearch
        = !q
          || t.description.toLowerCase().includes(q)
          || (t.category ?? '').toLowerCase().includes(q)
          || (t.paymentMethod ?? '').toLowerCase().includes(q)
          || (t.sale?.customerName ?? '').toLowerCase().includes(q)
      return matchType && matchStatus && matchSearch
    })
    .sort(
      (a, b) =>
        new Date(b.date as string | number).getTime() - new Date(a.date as string | number).getTime()
    )
})

// ─────────────────────────────────────────────
// Pagination
// ─────────────────────────────────────────────
const page = ref(1)
const pageSize = ref(12)

const paginatedTransactions = computed(() => {
  const start = (page.value - 1) * pageSize.value
  return filteredTransactions.value.slice(start, start + pageSize.value)
})

const totalPages = computed(() =>
  Math.ceil(filteredTransactions.value.length / pageSize.value)
)

watch([search, typeFilter, statusFilter], () => {
  page.value = 1
})

// ─────────────────────────────────────────────
// Status / Type config
// ─────────────────────────────────────────────
const statusConfig: Record<
  TransactionStatus,
  { label: string, color: string, icon: string }
> = {
  pending: {
    label: 'Pendente',
    color: 'warning',
    icon: 'i-heroicons-clock'
  },
  paid: {
    label: 'Pago',
    color: 'success',
    icon: 'i-heroicons-check-circle'
  },
  cancelled: {
    label: 'Cancelado',
    color: 'error',
    icon: 'i-heroicons-x-circle'
  }
}

const typeConfig: Record<
  TransactionType,
  { label: string, color: string, icon: string, sign: string }
> = {
  income: {
    label: 'Receita',
    color: 'success',
    icon: 'i-heroicons-arrow-trending-up',
    sign: '+'
  },
  expense: {
    label: 'Despesa',
    color: 'error',
    icon: 'i-heroicons-arrow-trending-down',
    sign: '-'
  }
}

// ─────────────────────────────────────────────
// KPI Summaries
// ─────────────────────────────────────────────
const kpis = computed(() => {
  const all = transactions.value
  const paid = all.filter(t => t.status === 'paid')
  const income = paid.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  const expense = paid.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
  const balance = income - expense
  const pending = all.filter(t => t.status === 'pending').reduce((s, t) => s + t.amount, 0)
  const pendingCount = all.filter(t => t.status === 'pending').length
  const totalCount = all.length
  return { income, expense, balance, pending, pendingCount, totalCount }
})

// ─────────────────────────────────────────────
// Drawer & Form State
// ─────────────────────────────────────────────
const isDrawerOpen = ref(false)
const isEditing = ref(false)
const loadingSave = ref(false)
const editingId = ref<number | null>(null)

const CATEGORY_SUGGESTIONS = [
  'Vendas', 'Serviços', 'Aluguel', 'Salário', 'Impostos',
  'Combustível', 'Manutenção', 'Equipamentos', 'Fornecedores',
  'Marketing', 'Administrativo', 'Outros'
]

const form = reactive({
  description: '',
  amount: 0 as number, // display value in BRL (float)
  type: 'income' as TransactionType,
  category: '',
  status: 'pending' as TransactionStatus,
  date: new Date().toISOString().slice(0, 10),
  dueDate: '',
  paymentMethod: ''
})

const resetForm = () => {
  editingId.value = null
  isEditing.value = false
  form.description = ''
  form.amount = 0
  form.type = 'income'
  form.category = ''
  form.status = 'pending'
  form.date = new Date().toISOString().slice(0, 10)
  form.dueDate = ''
  form.paymentMethod = ''
}

const openCreate = () => {
  resetForm()
  isDrawerOpen.value = true
}

const openEdit = (t: Transaction) => {
  resetForm()
  isEditing.value = true
  editingId.value = t.id
  form.description = t.description
  form.amount = t.amount / 100
  form.type = t.type
  form.category = t.category ?? ''
  form.status = t.status
  form.date = t.date ? new Date(t.date as string | number).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10)
  form.dueDate = t.dueDate ? new Date(t.dueDate as string | number).toISOString().slice(0, 10) : ''
  form.paymentMethod = t.paymentMethod ?? ''
  isDrawerOpen.value = true
}

// ─────────────────────────────────────────────
// Save
// ─────────────────────────────────────────────
const handleSave = async () => {
  if (form.description.trim().length < 3) {
    toast.add({ title: 'Campos inválidos', description: 'A descrição deve ter pelo menos 3 caracteres.', color: 'warning', icon: 'i-heroicons-exclamation-triangle' })
    return
  }
  if (form.amount <= 0) {
    toast.add({ title: 'Campos inválidos', description: 'O valor deve ser maior que zero.', color: 'warning', icon: 'i-heroicons-exclamation-triangle' })
    return
  }

  loadingSave.value = true
  try {
    const payload = {
      companyId: companyId.value,
      userId: user.value?.id ?? undefined,
      description: form.description.trim(),
      amount: Math.round(form.amount * 100),
      type: form.type,
      category: form.category || undefined,
      status: form.status,
      date: form.date ? new Date(form.date).toISOString() : undefined,
      dueDate: form.dueDate ? new Date(form.dueDate).toISOString() : undefined,
      paymentMethod: form.paymentMethod || undefined
    }

    if (isEditing.value && editingId.value) {
      await $fetch(`/api/transactions/${editingId.value}`, {
        method: 'PUT',
        body: payload
      })
      toast.add({
        title: 'Transação atualizada',
        description: `"${form.description}" foi atualizada com sucesso.`,
        color: 'success',
        icon: 'i-heroicons-check-circle'
      })
    } else {
      await $fetch('/api/transactions', { method: 'POST', body: payload })
      toast.add({
        title: 'Transação criada',
        description: `"${form.description}" foi registrada com sucesso.`,
        color: 'success',
        icon: 'i-heroicons-check-circle'
      })
    }

    isDrawerOpen.value = false
    await refreshTransactions()
  } catch (e: unknown) {
    const err = e as { data?: { statusMessage?: string }, message?: string }
    toast.add({
      title: 'Erro ao salvar',
      description: err?.data?.statusMessage ?? err?.message ?? 'Erro ao salvar transação.',
      color: 'error',
      icon: 'i-heroicons-exclamation-circle'
    })
  } finally {
    loadingSave.value = false
  }
}

// ─────────────────────────────────────────────
// Delete
// ─────────────────────────────────────────────
const deleteTarget = ref<Transaction | null>(null)
const loadingDelete = ref(false)
const isDeleteModalOpen = ref(false)

const confirmDelete = (t: Transaction) => {
  deleteTarget.value = t
  isDeleteModalOpen.value = true
}

const handleDelete = async () => {
  if (!deleteTarget.value) return
  loadingDelete.value = true
  const desc = deleteTarget.value.description
  try {
    await $fetch(`/api/transactions/${deleteTarget.value.id}`, {
      method: 'DELETE'
    })
    isDeleteModalOpen.value = false
    toast.add({
      title: 'Transação excluída',
      description: `"${desc}" foi excluída.`,
      color: 'neutral',
      icon: 'i-heroicons-trash'
    })
    await refreshTransactions()
  } catch (e: unknown) {
    const err = e as { data?: { statusMessage?: string }, message?: string }
    toast.add({
      title: 'Erro ao excluir',
      description: err?.data?.statusMessage ?? err?.message ?? 'Tente novamente.',
      color: 'error',
      icon: 'i-heroicons-exclamation-circle'
    })
  } finally {
    loadingDelete.value = false
    deleteTarget.value = null
  }
}

// ─────────────────────────────────────────────
// Quick status update
// ─────────────────────────────────────────────
const updateStatus = async (t: Transaction, status: TransactionStatus) => {
  try {
    await $fetch(`/api/transactions/${t.id}`, {
      method: 'PUT',
      body: { status }
    })
    toast.add({
      title: 'Status atualizado',
      description: `Transação agora está como "${statusConfig[status].label}".`,
      color: 'success',
      icon: statusConfig[status].icon
    })
    await refreshTransactions()
  } catch (e) {
    console.error(e)
  }
}

const STATUS_ACTIONS: Record<
  TransactionStatus,
  { next: TransactionStatus, label: string }[]
> = {
  pending: [
    { next: 'paid', label: 'Marcar como Pago' },
    { next: 'cancelled', label: 'Cancelar' }
  ],
  paid: [],
  cancelled: [{ next: 'pending', label: 'Reabrir como Pendente' }]
}

// ─────────────────────────────────────────────
// Row actions (context-aware)
// ─────────────────────────────────────────────
const rowActions = (t: Transaction) => [
  [
    {
      label: 'Editar',
      icon: 'i-heroicons-pencil-square',
      onSelect: () => openEdit(t)
    },
    ...STATUS_ACTIONS[t.status].map(a => ({
      label: a.label,
      icon: statusConfig[a.next].icon,
      onSelect: () => updateStatus(t, a.next)
    }))
  ],
  [
    {
      label: 'Excluir',
      icon: 'i-heroicons-trash',
      color: 'error' as const,
      onSelect: () => confirmDelete(t)
    }
  ]
]
</script>

<template>
  <div class="p-6 lg:p-8 space-y-6">
    <!-- ── Page Header ── -->
    <div class="flex items-start justify-between gap-4">
      <div>
        <h1 class="text-2xl font-black text-zinc-900 dark:text-white">
          Transações
        </h1>
        <p class="text-sm text-zinc-500 mt-1">
          Controle de receitas e despesas da empresa
        </p>
      </div>
      <UButton
        color="primary"
        icon="i-heroicons-plus"
        @click="openCreate"
      >
        Nova Transação
      </UButton>
    </div>

    <!-- ── KPI Strip ── -->
    <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
      <!-- Receitas Recebidas -->
      <div
        class="rounded-2xl bg-white dark:bg-zinc-900 ring-1 ring-zinc-200 dark:ring-zinc-800 p-6 flex flex-col gap-4"
      >
        <div class="flex items-center justify-between">
          <span class="text-xs font-black uppercase tracking-widest text-zinc-400">Receitas</span>
          <div class="w-9 h-9 rounded-xl bg-green-50 dark:bg-green-500/10 flex items-center justify-center">
            <UIcon
              name="i-heroicons-arrow-trending-up"
              class="w-5 h-5 text-green-500"
            />
          </div>
        </div>
        <span class="text-3xl font-black text-zinc-900 dark:text-white">
          {{ formatCurrency(kpis.income) }}
        </span>
        <div class="flex items-center gap-1.5 text-xs font-bold text-zinc-400">
          <UIcon
            name="i-heroicons-check-circle"
            class="w-4 h-4"
          />
          <span>Somente pagas</span>
        </div>
      </div>

      <!-- Despesas -->
      <div
        class="rounded-2xl bg-white dark:bg-zinc-900 ring-1 ring-zinc-200 dark:ring-zinc-800 p-6 flex flex-col gap-4"
      >
        <div class="flex items-center justify-between">
          <span class="text-xs font-black uppercase tracking-widest text-zinc-400">Despesas</span>
          <div class="w-9 h-9 rounded-xl bg-red-50 dark:bg-red-500/10 flex items-center justify-center">
            <UIcon
              name="i-heroicons-arrow-trending-down"
              class="w-5 h-5 text-red-500"
            />
          </div>
        </div>
        <span class="text-3xl font-black text-zinc-900 dark:text-white">
          {{ formatCurrency(kpis.expense) }}
        </span>
        <div class="flex items-center gap-1.5 text-xs font-bold text-zinc-400">
          <UIcon
            name="i-heroicons-check-circle"
            class="w-4 h-4"
          />
          <span>Somente pagas</span>
        </div>
      </div>

      <!-- Saldo Líquido -->
      <div
        class="rounded-2xl bg-white dark:bg-zinc-900 ring-1 ring-zinc-200 dark:ring-zinc-800 p-6 flex flex-col gap-4"
      >
        <div class="flex items-center justify-between">
          <span class="text-xs font-black uppercase tracking-widest text-zinc-400">Saldo Líquido</span>
          <div
            class="w-9 h-9 rounded-xl flex items-center justify-center"
            :class="kpis.balance >= 0 ? 'bg-primary-50 dark:bg-primary-500/10' : 'bg-red-50 dark:bg-red-500/10'"
          >
            <UIcon
              name="i-heroicons-scale"
              class="w-5 h-5"
              :class="kpis.balance >= 0 ? 'text-primary-500' : 'text-red-500'"
            />
          </div>
        </div>
        <span
          class="text-3xl font-black"
          :class="kpis.balance >= 0 ? 'text-primary-500' : 'text-red-500'"
        >
          {{ kpis.balance >= 0 ? "" : "-" }}{{ formatCurrency(Math.abs(kpis.balance)) }}
        </span>
        <div
          class="flex items-center gap-1.5 text-xs font-bold"
          :class="kpis.balance >= 0 ? 'text-green-500' : 'text-red-500'"
        >
          <UIcon
            :name="kpis.balance >= 0 ? 'i-heroicons-arrow-trending-up' : 'i-heroicons-arrow-trending-down'"
            class="w-4 h-4"
          />
          <span>{{ kpis.balance >= 0 ? "Positivo" : "Negativo" }}</span>
        </div>
      </div>

      <!-- Pendente -->
      <div
        class="rounded-2xl bg-white dark:bg-zinc-900 ring-1 ring-zinc-200 dark:ring-zinc-800 p-6 flex flex-col gap-4"
      >
        <div class="flex items-center justify-between">
          <span class="text-xs font-black uppercase tracking-widest text-zinc-400">A Receber/Pagar</span>
          <div class="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-500/10 flex items-center justify-center">
            <UIcon
              name="i-heroicons-clock"
              class="w-5 h-5 text-amber-500"
            />
          </div>
        </div>
        <span class="text-3xl font-black text-zinc-900 dark:text-white">
          {{ formatCurrency(kpis.pending) }}
        </span>
        <div class="flex items-center gap-1.5 text-xs font-bold text-amber-500">
          <UIcon
            name="i-heroicons-exclamation-circle"
            class="w-4 h-4"
          />
          <span>{{ kpis.pendingCount }} {{ kpis.pendingCount === 1 ? "pendência" : "pendências" }}</span>
        </div>
      </div>
    </div>

    <!-- ── Table Card ── -->
    <UCard>
      <!-- Toolbar -->
      <template #header>
        <div class="flex items-center justify-between gap-4">
          <h3 class="text-sm font-black uppercase tracking-widest text-zinc-400 shrink-0">
            Todas as Transações
          </h3>
          <div class="flex items-center gap-2 flex-wrap justify-end">
            <UInput
              v-model="search"
              size="sm"
              placeholder="Buscar..."
              icon="i-heroicons-magnifying-glass"
              class="w-44 lg:w-56"
            />
            <USelect
              v-model="typeFilter"
              :items="TYPE_OPTS"
              value-key="value"
              label-key="label"
              size="sm"
              class="w-36"
            />
            <USelect
              v-model="statusFilter"
              :items="STATUS_OPTS"
              value-key="value"
              label-key="label"
              size="sm"
              class="w-40"
            />
          </div>
        </div>
      </template>

      <!-- Loading skeleton -->
      <div
        v-if="loadingTx"
        class="space-y-3 py-2"
      >
        <USkeleton
          v-for="i in 6"
          :key="i"
          class="h-14 rounded-xl"
        />
      </div>

      <!-- Empty state -->
      <div
        v-else-if="filteredTransactions.length === 0"
        class="flex flex-col items-center justify-center py-16 text-zinc-400"
      >
        <UIcon
          name="i-heroicons-arrows-right-left"
          class="w-12 h-12 mb-3"
        />
        <p class="text-sm font-bold">
          Nenhuma transação encontrada
        </p>
        <p class="text-xs mt-1">
          {{ search || typeFilter !== "all" || statusFilter !== "all" ? "Tente ajustar os filtros" : "Crie sua primeira transação" }}
        </p>
      </div>

      <!-- Table -->
      <div
        v-else
        class="overflow-x-auto"
      >
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-zinc-100 dark:border-zinc-800">
              <th class="text-left py-3 px-4 text-xs font-black uppercase tracking-widest text-zinc-400">
                Descrição
              </th>
              <th class="text-left py-3 px-4 text-xs font-black uppercase tracking-widest text-zinc-400">
                Tipo
              </th>
              <th class="text-left py-3 px-4 text-xs font-black uppercase tracking-widest text-zinc-400 hidden md:table-cell">
                Categoria
              </th>
              <th class="text-right py-3 px-4 text-xs font-black uppercase tracking-widest text-zinc-400">
                Valor
              </th>
              <th class="text-left py-3 px-4 text-xs font-black uppercase tracking-widest text-zinc-400">
                Status
              </th>
              <th class="text-left py-3 px-4 text-xs font-black uppercase tracking-widest text-zinc-400 hidden lg:table-cell">
                Data
              </th>
              <th class="text-left py-3 px-4 text-xs font-black uppercase tracking-widest text-zinc-400 hidden xl:table-cell">
                Vencimento
              </th>
              <th class="text-left py-3 px-4 text-xs font-black uppercase tracking-widest text-zinc-400 hidden xl:table-cell">
                Pagamento
              </th>
              <th class="py-3 px-4" />
            </tr>
          </thead>
          <tbody class="divide-y divide-zinc-50 dark:divide-zinc-800/60">
            <tr
              v-for="t in paginatedTransactions"
              :key="t.id"
              class="group hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors"
            >
              <!-- Description -->
              <td class="py-3.5 px-4">
                <div class="flex flex-col gap-0.5">
                  <span class="font-bold text-zinc-900 dark:text-white">
                    {{ t.description }}
                  </span>
                  <span
                    v-if="t.sale"
                    class="text-xs text-zinc-400"
                  >
                    <UIcon
                      name="i-heroicons-shopping-cart"
                      class="w-3 h-3 inline mr-0.5"
                    />
                    Venda: {{ t.sale.customerName }}
                  </span>
                </div>
              </td>

              <!-- Type -->
              <td class="py-3.5 px-4">
                <UBadge
                  :color="typeConfig[t.type].color as any"
                  variant="soft"
                  size="sm"
                  :icon="typeConfig[t.type].icon"
                >
                  {{ typeConfig[t.type].label }}
                </UBadge>
              </td>

              <!-- Category -->
              <td class="py-3.5 px-4 hidden md:table-cell">
                <span class="text-xs text-zinc-500 dark:text-zinc-400">
                  {{ t.category || "—" }}
                </span>
              </td>

              <!-- Amount -->
              <td class="py-3.5 px-4 text-right">
                <span
                  class="font-black tabular-nums"
                  :class="t.type === 'income' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'"
                >
                  {{ typeConfig[t.type].sign }}{{ formatCurrency(t.amount) }}
                </span>
              </td>

              <!-- Status -->
              <td class="py-3.5 px-4">
                <UBadge
                  :color="statusConfig[t.status].color as any"
                  variant="soft"
                  size="sm"
                >
                  {{ statusConfig[t.status].label }}
                </UBadge>
              </td>

              <!-- Date -->
              <td class="py-3.5 px-4 hidden lg:table-cell">
                <span class="text-xs text-zinc-500 dark:text-zinc-400">
                  {{ formatDate(t.date) }}
                </span>
              </td>

              <!-- Due Date -->
              <td class="py-3.5 px-4 hidden xl:table-cell">
                <span class="text-xs text-zinc-500 dark:text-zinc-400">
                  {{ formatDate(t.dueDate) }}
                </span>
              </td>

              <!-- Payment Method -->
              <td class="py-3.5 px-4 hidden xl:table-cell">
                <span class="text-xs text-zinc-500 dark:text-zinc-400">
                  {{ t.paymentMethod || "—" }}
                </span>
              </td>

              <!-- Actions -->
              <td class="py-3.5 px-4 text-right">
                <UDropdownMenu :items="rowActions(t)">
                  <UButton
                    color="neutral"
                    variant="ghost"
                    icon="i-heroicons-ellipsis-horizontal"
                    size="sm"
                    class="opacity-0 group-hover:opacity-100 transition-opacity"
                  />
                </UDropdownMenu>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Pagination -->
      <template
        v-if="totalPages > 1"
        #footer
      >
        <div class="flex items-center justify-between gap-4">
          <span class="text-xs text-zinc-400 font-bold">
            {{ filteredTransactions.length }} transação{{ filteredTransactions.length !== 1 ? "ões" : "" }} encontrada{{ filteredTransactions.length !== 1 ? "s" : "" }}
          </span>
          <div class="flex items-center gap-1">
            <UButton
              color="neutral"
              variant="ghost"
              icon="i-heroicons-chevron-left"
              size="sm"
              :disabled="page === 1"
              @click="page--"
            />
            <span class="text-xs font-bold text-zinc-500 px-2">
              {{ page }} / {{ totalPages }}
            </span>
            <UButton
              color="neutral"
              variant="ghost"
              icon="i-heroicons-chevron-right"
              size="sm"
              :disabled="page === totalPages"
              @click="page++"
            />
          </div>
        </div>
      </template>
    </UCard>

    <!-- ══════════════════════════════════════════
         SLIDEOVER — Create / Edit
    ══════════════════════════════════════════ -->
    <USlideover
      v-model:open="isDrawerOpen"
      :title="isEditing ? 'Editar Transação' : 'Nova Transação'"
      :ui="{ content: 'w-full', footer: 'p-0 block' }"
    >
      <template #body>
        <div class="p-6 space-y-6">
          <!-- Type Toggle -->
          <div>
            <p class="text-xs font-black uppercase tracking-widest text-zinc-400 mb-3">
              Tipo de Transação
            </p>
            <div class="grid grid-cols-2 gap-3">
              <button
                type="button"
                class="flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm border-2 transition-all"
                :class="form.type === 'income'
                  ? 'border-green-500 bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-400'
                  : 'border-zinc-200 dark:border-zinc-700 text-zinc-400 hover:border-zinc-300 dark:hover:border-zinc-600'"
                @click="form.type = 'income'"
              >
                <UIcon
                  name="i-heroicons-arrow-trending-up"
                  class="w-4 h-4"
                />
                Receita
              </button>
              <button
                type="button"
                class="flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm border-2 transition-all"
                :class="form.type === 'expense'
                  ? 'border-red-500 bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400'
                  : 'border-zinc-200 dark:border-zinc-700 text-zinc-400 hover:border-zinc-300 dark:hover:border-zinc-600'"
                @click="form.type = 'expense'"
              >
                <UIcon
                  name="i-heroicons-arrow-trending-down"
                  class="w-4 h-4"
                />
                Despesa
              </button>
            </div>
          </div>

          <!-- Description + Amount -->
          <div class="grid grid-cols-1 gap-4">
            <UFormField
              label="Descrição *"
              class="col-span-full"
            >
              <UInput
                v-model="form.description"
                placeholder="Ex: Venda de concreto FCK 25 — Obra Souza"
                class="w-full"
              />
            </UFormField>

            <UFormField label="Valor (R$) *">
              <UInput
                v-model="form.amount"
                type="number"
                min="0"
                step="0.01"
                placeholder="0,00"
                class="w-full"
              />
            </UFormField>

            <UFormField label="Categoria">
              <USelect
                v-model="form.category"
                :items="CATEGORY_SUGGESTIONS"
                placeholder="Selecione uma categoria"
                class="w-full"
              />
            </UFormField>
          </div>

          <!-- Status + Payment Method -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <UFormField label="Status">
              <USelect
                v-model="form.status"
                :items="[
                  { label: 'Pendente', value: 'pending' },
                  { label: 'Pago', value: 'paid' },
                  { label: 'Cancelado', value: 'cancelled' }
                ]"
                value-key="value"
                label-key="label"
                class="w-full"
              />
            </UFormField>

            <UFormField label="Forma de Pagamento">
              <USelect
                v-model="form.paymentMethod"
                :items="['Pix', 'Dinheiro', 'Cartão de Débito', 'Cartão de Crédito', 'Boleto', 'Transferência', 'Cheque', 'Outro']"
                placeholder="Selecionar..."
                class="w-full"
              />
            </UFormField>
          </div>

          <!-- Dates -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <UFormField label="Data">
              <UInput
                v-model="form.date"
                type="date"
                class="w-full"
              />
            </UFormField>

            <UFormField label="Vencimento">
              <UInput
                v-model="form.dueDate"
                type="date"
                class="w-full"
              />
            </UFormField>
          </div>
        </div>
      </template>

      <template #footer>
        <div class="border-t border-zinc-200 dark:border-zinc-800">
          <!-- Live value preview -->
          <div class="flex items-center justify-between px-6 pt-4 pb-3">
            <span class="text-xs font-black uppercase tracking-widest text-zinc-400">
              Valor da transação
            </span>
            <span
              class="text-xl font-black"
              :class="form.type === 'income' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'"
            >
              {{ typeConfig[form.type].sign }}{{ formatCurrency(Math.round(form.amount * 100)) }}
            </span>
          </div>
          <!-- Actions -->
          <div class="flex items-center gap-3 px-6 pb-6">
            <div class="flex-1 min-w-0">
              <UButton
                color="neutral"
                variant="outline"
                class="w-full"
                :disabled="loadingSave"
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
                {{ isEditing ? "Salvar Alterações" : "Criar Transação" }}
              </UButton>
            </div>
          </div>
        </div>
      </template>
    </USlideover>

    <!-- ══════════════════════════════════════════
         MODAL — Delete Confirm
    ══════════════════════════════════════════ -->
    <UModal
      v-model:open="isDeleteModalOpen"
      title="Excluir Transação"
    >
      <template #body>
        <div class="px-6 py-4 space-y-4">
          <p class="text-sm text-zinc-600 dark:text-zinc-400">
            Tem certeza que deseja excluir a transação
            <span class="font-bold text-zinc-900 dark:text-white">
              "{{ deleteTarget?.description }}"
            </span>?
          </p>
          <div
            v-if="deleteTarget"
            class="rounded-xl bg-zinc-50 dark:bg-zinc-800 p-4 flex items-center justify-between"
          >
            <div class="flex items-center gap-3">
              <div
                class="w-8 h-8 rounded-lg flex items-center justify-center"
                :class="deleteTarget.type === 'income' ? 'bg-green-100 dark:bg-green-500/20' : 'bg-red-100 dark:bg-red-500/20'"
              >
                <UIcon
                  :name="typeConfig[deleteTarget.type].icon"
                  class="w-4 h-4"
                  :class="deleteTarget.type === 'income' ? 'text-green-500' : 'text-red-500'"
                />
              </div>
              <div>
                <p class="text-sm font-bold text-zinc-900 dark:text-white">
                  {{ deleteTarget.description }}
                </p>
                <p class="text-xs text-zinc-400">
                  {{ formatDate(deleteTarget.date) }}
                </p>
              </div>
            </div>
            <span
              class="font-black text-sm"
              :class="deleteTarget.type === 'income' ? 'text-green-600' : 'text-red-600'"
            >
              {{ typeConfig[deleteTarget.type].sign }}{{ formatCurrency(deleteTarget.amount) }}
            </span>
          </div>
          <p class="text-xs text-zinc-400">
            Esta ação é irreversível.
          </p>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-3 px-6 pb-4">
          <UButton
            color="neutral"
            variant="ghost"
            :disabled="loadingDelete"
            @click="isDeleteModalOpen = false"
          >
            Cancelar
          </UButton>
          <UButton
            color="error"
            variant="soft"
            icon="i-heroicons-trash"
            :loading="loadingDelete"
            @click="handleDelete"
          >
            Excluir
          </UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>
