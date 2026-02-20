<script setup lang="ts">
definePageMeta({ layout: 'default' })
useSeoMeta({ title: 'Produtos | Meu Concreto' })

const { companyId } = useAuth()
const toast = useToast()

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
type ProductType = 'concrete' | 'pump' | 'additive' | 'rental' | 'other'
type ProductUnit = 'm3' | 'un' | 'hr' | 'kg' | 'ton'

interface Product {
  id: number
  companyId: number
  name: string
  description?: string | null
  type: ProductType
  unit: ProductUnit
  price: number // cents
  sku?: string | null
  fck?: number | null
  slump?: number | null
  stoneSize?: string | null
  active: boolean
  createdAt: string | number
  updatedAt: string | number
}

// ─────────────────────────────────────────────
// Data
// ─────────────────────────────────────────────

const {
  data: productsData,
  refresh: refreshProducts,
  pending: loadingProducts
} = await useFetch<{ products: Product[] }>('/api/products', { query: { companyId } })

const products = computed<Product[]>(
  () => productsData.value?.products ?? []
)

// ─────────────────────────────────────────────
// Type & Unit helpers
// ─────────────────────────────────────────────
const typeConfig: Record<
  ProductType,
  { label: string, color: string, icon: string }
> = {
  concrete: {
    label: 'Concreto',
    color: 'success',
    icon: 'i-lucide-layers'
  },
  pump: {
    label: 'Bombeamento',
    color: 'info',
    icon: 'i-lucide-waypoints'
  },
  additive: {
    label: 'Aditivo',
    color: 'warning',
    icon: 'i-lucide-flask-conical'
  },
  rental: {
    label: 'Locação',
    color: 'neutral',
    icon: 'i-lucide-wrench'
  },
  other: {
    label: 'Outro',
    color: 'neutral',
    icon: 'i-lucide-package'
  }
}

const TYPE_OPTS = [
  { label: 'Todos os Tipos', value: 'all' },
  { label: 'Concreto', value: 'concrete' },
  { label: 'Bombeamento', value: 'pump' },
  { label: 'Aditivo', value: 'additive' },
  { label: 'Locação', value: 'rental' },
  { label: 'Outro', value: 'other' }
]

const UNIT_LABELS: Record<ProductUnit, string> = {
  m3: 'm³',
  un: 'un',
  hr: 'hr',
  kg: 'kg',
  ton: 'ton'
}

// ─────────────────────────────────────────────
// Summary stats
// ─────────────────────────────────────────────
const stats = computed(() => {
  const all = products.value
  const active = all.filter(p => p.active)
  const concrete = all.filter(p => p.type === 'concrete')
  const avgPrice
    = active.length > 0
      ? active.reduce((s, p) => s + p.price, 0) / active.length
      : 0
  return {
    total: all.length,
    active: active.length,
    concrete: concrete.length,
    avgPrice
  }
})

// ─────────────────────────────────────────────
// Filter & Search
// ─────────────────────────────────────────────
const search = ref('')
const typeFilter = ref<ProductType | 'all'>('all')
const activeFilter = ref<'all' | 'active' | 'inactive'>('all')

const filteredProducts = computed(() => {
  return products.value.filter((p) => {
    const matchType = typeFilter.value === 'all' || p.type === typeFilter.value
    const matchActive
      = activeFilter.value === 'all'
        || (activeFilter.value === 'active' && p.active)
        || (activeFilter.value === 'inactive' && !p.active)
    const q = search.value.toLowerCase()
    const matchSearch
      = !q
        || p.name.toLowerCase().includes(q)
        || (p.sku ?? '').toLowerCase().includes(q)
        || (p.description ?? '').toLowerCase().includes(q)
    return matchType && matchActive && matchSearch
  })
})

// ─────────────────────────────────────────────
// Pagination
// ─────────────────────────────────────────────
const page = ref(1)
const pageSize = ref(12)

const paginatedProducts = computed(() => {
  const start = (page.value - 1) * pageSize.value
  return filteredProducts.value.slice(start, start + pageSize.value)
})

const totalPages = computed(() =>
  Math.ceil(filteredProducts.value.length / pageSize.value)
)

watch([search, typeFilter, activeFilter], () => {
  page.value = 1
})

// ─────────────────────────────────────────────
// Formatters
// ─────────────────────────────────────────────
const formatCurrency = (cents: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
    cents / 100
  )

// ─────────────────────────────────────────────
// Drawer State
// ─────────────────────────────────────────────
const isDrawerOpen = ref(false)
const isEditing = ref(false)
const loadingSave = ref(false)
const editingId = ref<number | null>(null)

// ─────────────────────────────────────────────
// Form state
// ─────────────────────────────────────────────
const form = reactive({
  name: '',
  description: '',
  type: 'concrete' as ProductType,
  unit: 'm3' as ProductUnit,
  price: 0, // display in BRL float
  sku: '',
  fck: null as number | null,
  slump: null as number | null,
  stoneSize: '',
  active: true
})

const resetForm = () => {
  editingId.value = null
  isEditing.value = false
  form.name = ''
  form.description = ''
  form.type = 'concrete'
  form.unit = 'm3'
  form.price = 0
  form.sku = ''
  form.fck = null
  form.slump = null
  form.stoneSize = ''
  form.active = true
}

const openCreate = () => {
  resetForm()
  isDrawerOpen.value = true
}

const openEdit = (p: Product) => {
  resetForm()
  isEditing.value = true
  editingId.value = p.id
  form.name = p.name
  form.description = p.description ?? ''
  form.type = p.type
  form.unit = p.unit
  form.price = p.price / 100
  form.sku = p.sku ?? ''
  form.fck = p.fck ?? null
  form.slump = p.slump ?? null
  form.stoneSize = p.stoneSize ?? ''
  form.active = p.active
  isDrawerOpen.value = true
}

// Reset concrete-specific fields when type changes
watch(
  () => form.type,
  (newType) => {
    if (newType !== 'concrete') {
      form.fck = null
      form.slump = null
      form.stoneSize = ''
      if (newType !== 'pump' && newType !== 'rental') {
        form.unit = 'un'
      } else if (newType === 'pump') {
        form.unit = 'm3'
      } else if (newType === 'rental') {
        form.unit = 'hr'
      }
    } else {
      form.unit = 'm3'
    }
  }
)

// ─────────────────────────────────────────────
// Save
// ─────────────────────────────────────────────
const handleSave = async () => {
  if (form.name.trim().length < 3) {
    toast.add({ title: 'Campos inválidos', description: 'O nome deve ter pelo menos 3 caracteres.', color: 'warning', icon: 'i-heroicons-exclamation-triangle' })
    return
  }
  if (form.price < 0) {
    toast.add({ title: 'Campos inválidos', description: 'O preço não pode ser negativo.', color: 'warning', icon: 'i-heroicons-exclamation-triangle' })
    return
  }

  loadingSave.value = true
  try {
    const payload = {
      ...(isEditing.value ? {} : { companyId: companyId.value }),
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      type: form.type,
      unit: form.unit,
      price: Math.round(form.price * 100),
      sku: form.sku.trim() || undefined,
      fck: form.fck ?? undefined,
      slump: form.slump ?? undefined,
      stoneSize: form.stoneSize.trim() || undefined,
      active: form.active
    }

    if (isEditing.value && editingId.value) {
      await $fetch(`/api/products/${editingId.value}`, {
        method: 'PUT',
        body: payload
      })
      toast.add({
        title: 'Produto atualizado',
        description: `"${form.name}" foi atualizado com sucesso.`,
        color: 'success',
        icon: 'i-heroicons-check-circle'
      })
    } else {
      await $fetch('/api/products', { method: 'POST', body: payload })
      toast.add({
        title: 'Produto criado',
        description: `"${form.name}" foi adicionado ao catálogo.`,
        color: 'success',
        icon: 'i-heroicons-check-circle'
      })
    }

    isDrawerOpen.value = false
    await refreshProducts()
  } catch (e: any) {
    toast.add({
      title: 'Erro ao salvar',
      description: e?.data?.statusMessage ?? e?.message ?? 'Erro ao salvar produto.',
      color: 'error',
      icon: 'i-heroicons-exclamation-circle'
    })
  } finally {
    loadingSave.value = false
  }
}

// ─────────────────────────────────────────────
// Toggle active
// ─────────────────────────────────────────────
const toggleActive = async (p: Product) => {
  try {
    await $fetch(`/api/products/${p.id}`, {
      method: 'PUT',
      body: { active: !p.active }
    })
    toast.add({
      title: p.active ? 'Produto desativado' : 'Produto ativado',
      description: `"${p.name}" foi ${p.active ? 'desativado' : 'ativado'}.`,
      color: p.active ? 'neutral' : 'success',
      icon: p.active ? 'i-heroicons-eye-slash' : 'i-heroicons-check-circle'
    })
    await refreshProducts()
  } catch (e: any) {
    toast.add({
      title: 'Erro',
      description: e?.data?.statusMessage ?? 'Tente novamente.',
      color: 'error',
      icon: 'i-heroicons-exclamation-circle'
    })
  }
}

// ─────────────────────────────────────────────
// Delete
// ─────────────────────────────────────────────
const deleteTarget = ref<Product | null>(null)
const loadingDelete = ref(false)
const isDeleteModalOpen = ref(false)

const confirmDelete = (p: Product) => {
  deleteTarget.value = p
  isDeleteModalOpen.value = true
}

const handleDelete = async () => {
  if (!deleteTarget.value) return
  loadingDelete.value = true
  const name = deleteTarget.value.name
  try {
    await $fetch(`/api/products/${deleteTarget.value.id}`, {
      method: 'DELETE'
    })
    isDeleteModalOpen.value = false
    toast.add({
      title: 'Produto excluído',
      description: `"${name}" foi removido do catálogo.`,
      color: 'neutral',
      icon: 'i-heroicons-trash'
    })
    await refreshProducts()
  } catch (e: any) {
    toast.add({
      title: 'Erro ao excluir',
      description: e?.data?.statusMessage ?? e?.message ?? 'Tente novamente.',
      color: 'error',
      icon: 'i-heroicons-exclamation-circle'
    })
  } finally {
    loadingDelete.value = false
    deleteTarget.value = null
  }
}

// ─────────────────────────────────────────────
// Row actions
// ─────────────────────────────────────────────
const rowActions = (p: Product) => [
  [
    {
      label: 'Editar Produto',
      icon: 'i-heroicons-pencil-square',
      onSelect: () => openEdit(p)
    },
    {
      label: p.active ? 'Desativar' : 'Ativar',
      icon: p.active ? 'i-heroicons-eye-slash' : 'i-heroicons-eye',
      onSelect: () => toggleActive(p)
    }
  ],
  [
    {
      label: 'Excluir',
      icon: 'i-heroicons-trash',
      color: 'error' as const,
      onSelect: () => confirmDelete(p)
    }
  ]
]

// Active filter options
const ACTIVE_OPTS = [
  { label: 'Todos', value: 'all' },
  { label: 'Ativos', value: 'active' },
  { label: 'Inativos', value: 'inactive' }
]

// Unit options for select
const UNIT_OPTS = [
  { label: 'm³ — metros cúbicos', value: 'm3' },
  { label: 'un — unidade', value: 'un' },
  { label: 'hr — hora', value: 'hr' },
  { label: 'kg — quilograma', value: 'kg' },
  { label: 'ton — tonelada', value: 'ton' }
]

// Type options for form
const TYPE_FORM_OPTS = [
  { label: 'Concreto', value: 'concrete' },
  { label: 'Bombeamento', value: 'pump' },
  { label: 'Aditivo', value: 'additive' },
  { label: 'Locação', value: 'rental' },
  { label: 'Outro', value: 'other' }
]
</script>

<template>
  <div class="p-6 lg:p-8 space-y-6">
    <!-- ── Page Header ── -->
    <div class="flex items-start justify-between gap-4">
      <div>
        <h1 class="text-2xl font-black text-zinc-900 dark:text-white">
          Produtos
        </h1>
        <p class="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
          Gerencie o catálogo de produtos e serviços da empresa
        </p>
      </div>
      <UButton
        color="primary"
        icon="i-heroicons-plus"
        size="md"
        class="shrink-0"
        @click="openCreate"
      >
        Novo Produto
      </UButton>
    </div>

    <!-- ── KPI Strip ── -->
    <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
      <div
        v-for="(kpi, i) in [
          {
            label: 'Total de Produtos',
            value: stats.total,
            suffix: 'cadastrados',
            icon: 'i-lucide-package',
            color: 'text-primary-500',
            bg: 'bg-primary-50 dark:bg-primary-500/10'
          },
          {
            label: 'Produtos Ativos',
            value: stats.active,
            suffix: 'disponíveis',
            icon: 'i-heroicons-check-circle',
            color: 'text-green-500',
            bg: 'bg-green-50 dark:bg-green-500/10'
          },
          {
            label: 'Concretos',
            value: stats.concrete,
            suffix: 'traços cadastrados',
            icon: 'i-lucide-layers',
            color: 'text-blue-500',
            bg: 'bg-blue-50 dark:bg-blue-500/10'
          },
          {
            label: 'Preço Médio',
            value: formatCurrency(stats.avgPrice),
            suffix: 'por produto ativo',
            icon: 'i-lucide-trending-up',
            color: 'text-amber-500',
            bg: 'bg-amber-50 dark:bg-amber-500/10'
          }
        ]"
        :key="i"
        class="rounded-2xl bg-white dark:bg-zinc-900 ring-1 ring-zinc-200 dark:ring-zinc-800 p-6 flex flex-col gap-4"
      >
        <div class="flex items-center justify-between gap-2">
          <span
            class="text-xs font-black uppercase tracking-widest text-zinc-400 leading-tight"
          >
            {{ kpi.label }}
          </span>
          <div
            :class="[
              kpi.bg,
              'w-10 h-10 rounded-xl flex items-center justify-center shrink-0'
            ]"
          >
            <UIcon
              :name="kpi.icon"
              :class="['w-5 h-5', kpi.color]"
            />
          </div>
        </div>
        <p
          class="text-3xl font-black text-zinc-900 dark:text-white tabular-nums"
        >
          {{ kpi.value }}
        </p>
        <p
          v-if="kpi.suffix"
          class="text-xs text-zinc-400 font-medium -mt-2"
        >
          {{ kpi.suffix }}
        </p>
      </div>
    </div>

    <!-- ── Table Card ── -->
    <UCard>
      <template #header>
        <div class="flex items-center justify-between gap-4">
          <h3
            class="text-sm font-black uppercase tracking-widest text-zinc-400 shrink-0"
          >
            Catálogo de Produtos
          </h3>
          <div class="flex items-center gap-2 flex-wrap justify-end">
            <UInput
              v-model="search"
              icon="i-heroicons-magnifying-glass"
              placeholder="Buscar nome, SKU..."
              size="sm"
              class="w-44 lg:w-56"
            />
            <USelect
              v-model="typeFilter"
              :items="TYPE_OPTS"
              value-key="value"
              label-key="label"
              size="sm"
              class="w-40"
            />
            <USelect
              v-model="activeFilter"
              :items="ACTIVE_OPTS"
              value-key="value"
              label-key="label"
              size="sm"
              class="w-28"
            />
          </div>
        </div>
      </template>

      <!-- Loading skeleton -->
      <div
        v-if="loadingProducts"
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
        v-else-if="filteredProducts.length === 0"
        class="flex flex-col items-center justify-center py-16 text-zinc-400"
      >
        <UIcon
          name="i-lucide-package"
          class="w-12 h-12 mb-3"
        />
        <p class="text-sm font-bold">
          Nenhum produto encontrado
        </p>
        <p class="text-xs mt-1">
          Ajuste os filtros ou cadastre um novo produto
        </p>
      </div>

      <!-- Table -->
      <div
        v-else
        class="overflow-x-auto -mx-4 sm:mx-0"
      >
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-zinc-100 dark:border-zinc-800">
              <th
                class="text-left px-4 py-3 text-xs font-black uppercase tracking-widest text-zinc-400 whitespace-nowrap"
              >
                Produto
              </th>
              <th
                class="text-left px-4 py-3 text-xs font-black uppercase tracking-widest text-zinc-400 hidden sm:table-cell"
              >
                Tipo
              </th>
              <th
                class="text-left px-4 py-3 text-xs font-black uppercase tracking-widest text-zinc-400 hidden lg:table-cell"
              >
                Especificações
              </th>
              <th
                class="text-left px-4 py-3 text-xs font-black uppercase tracking-widest text-zinc-400 hidden md:table-cell"
              >
                SKU
              </th>
              <th
                class="text-right px-4 py-3 text-xs font-black uppercase tracking-widest text-zinc-400"
              >
                Preço
              </th>
              <th
                class="text-left px-4 py-3 text-xs font-black uppercase tracking-widest text-zinc-400"
              >
                Status
              </th>
              <th
                class="text-right px-4 py-3 text-xs font-black uppercase tracking-widest text-zinc-400"
              >
                Ações
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="p in paginatedProducts"
              :key="p.id"
              class="border-b border-zinc-100 dark:border-zinc-800/60 hover:bg-primary-50/50 dark:hover:bg-primary-500/5 transition-colors group relative"
              :class="{ 'opacity-50': !p.active }"
            >
              <!-- Product name + description -->
              <td class="px-4 py-3.5">
                <div class="flex items-center gap-3">
                  <div
                    :class="[
                      'w-9 h-9 rounded-xl flex items-center justify-center shrink-0',
                      typeConfig[p.type].color === 'success'
                        ? 'bg-green-50 dark:bg-green-500/10'
                        : typeConfig[p.type].color === 'info'
                          ? 'bg-blue-50 dark:bg-blue-500/10'
                          : typeConfig[p.type].color === 'warning'
                            ? 'bg-amber-50 dark:bg-amber-500/10'
                            : 'bg-zinc-100 dark:bg-zinc-800'
                    ]"
                  >
                    <UIcon
                      :name="typeConfig[p.type].icon"
                      :class="[
                        'w-4 h-4',
                        typeConfig[p.type].color === 'success'
                          ? 'text-green-600'
                          : typeConfig[p.type].color === 'info'
                            ? 'text-blue-600'
                            : typeConfig[p.type].color === 'warning'
                              ? 'text-amber-600'
                              : 'text-zinc-500'
                      ]"
                    />
                  </div>
                  <div class="min-w-0">
                    <p
                      class="font-bold text-zinc-900 dark:text-white truncate max-w-40 sm:max-w-56"
                    >
                      {{ p.name }}
                    </p>
                    <p
                      v-if="p.description"
                      class="text-xs text-zinc-400 truncate max-w-40 sm:max-w-56"
                    >
                      {{ p.description }}
                    </p>
                  </div>
                </div>
              </td>

              <!-- Type badge -->
              <td class="px-4 py-3.5 hidden sm:table-cell">
                <UBadge
                  :color="typeConfig[p.type].color as any"
                  variant="soft"
                  size="sm"
                  :icon="typeConfig[p.type].icon"
                >
                  {{ typeConfig[p.type].label }}
                </UBadge>
              </td>

              <!-- Concrete specs -->
              <td class="px-4 py-3.5 hidden lg:table-cell">
                <div
                  v-if="
                    p.type === 'concrete' && (p.fck || p.slump || p.stoneSize)
                  "
                  class="flex items-center gap-2 flex-wrap"
                >
                  <span
                    v-if="p.fck"
                    class="text-xs font-bold px-2 py-0.5 rounded-lg bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 whitespace-nowrap"
                  >
                    FCK {{ p.fck }} MPa
                  </span>
                  <span
                    v-if="p.slump"
                    class="text-xs font-bold px-2 py-0.5 rounded-lg bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 whitespace-nowrap"
                  >
                    Slump {{ p.slump }} cm
                  </span>
                  <span
                    v-if="p.stoneSize"
                    class="text-xs font-bold px-2 py-0.5 rounded-lg bg-stone-50 dark:bg-stone-500/10 text-stone-600 dark:text-stone-400 whitespace-nowrap"
                  >
                    {{ p.stoneSize }}
                  </span>
                </div>
                <span
                  v-else
                  class="text-xs text-zinc-300 dark:text-zinc-700"
                >—</span>
              </td>

              <!-- SKU -->
              <td
                class="px-4 py-3.5 text-xs text-zinc-400 font-mono hidden md:table-cell"
              >
                {{ p.sku || "—" }}
              </td>

              <!-- Price -->
              <td
                class="px-4 py-3.5 text-right font-black text-zinc-900 dark:text-white whitespace-nowrap"
              >
                <div>
                  {{ formatCurrency(p.price) }}
                  <span class="text-xs text-zinc-400 font-normal ml-1">
                    / {{ UNIT_LABELS[p.unit] }}
                  </span>
                </div>
              </td>

              <!-- Status -->
              <td class="px-4 py-3.5">
                <button
                  class="group/toggle"
                  title="Clique para alternar"
                  @click="toggleActive(p)"
                >
                  <UBadge
                    :color="p.active ? 'success' : 'neutral'"
                    variant="soft"
                    size="sm"
                    :icon="
                      p.active
                        ? 'i-heroicons-check-circle'
                        : 'i-heroicons-eye-slash'
                    "
                    class="cursor-pointer transition-opacity group-hover/toggle:opacity-70"
                  >
                    {{ p.active ? "Ativo" : "Inativo" }}
                  </UBadge>
                </button>
              </td>

              <!-- Actions -->
              <td class="px-4 py-3.5 text-right">
                <UDropdownMenu :items="rowActions(p)">
                  <UButton
                    color="neutral"
                    variant="ghost"
                    icon="i-heroicons-ellipsis-horizontal"
                    size="xs"
                    class="opacity-40 group-hover:opacity-100 transition-opacity"
                  />
                </UDropdownMenu>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Pagination -->
      <template
        v-if="filteredProducts.length > pageSize"
        #footer
      >
        <div
          class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between pt-1"
        >
          <p class="text-xs text-zinc-400">
            {{ filteredProducts.length }} produtos · página {{ page }} de
            {{ totalPages }}
          </p>
          <div class="flex items-center gap-2">
            <UButton
              color="neutral"
              variant="ghost"
              icon="i-heroicons-chevron-left"
              size="xs"
              :disabled="page === 1"
              @click="page--"
            />
            <UButton
              color="neutral"
              variant="ghost"
              icon="i-heroicons-chevron-right"
              size="xs"
              :disabled="page >= totalPages"
              @click="page++"
            />
          </div>
        </div>
      </template>
    </UCard>

    <!-- ══════════════════════════════════════════
         DRAWER — Create / Edit
    ══════════════════════════════════════════ -->
    <USlideover
      v-model:open="isDrawerOpen"
      :title="isEditing ? 'Editar Produto' : 'Novo Produto'"
      side="right"
      :ui="{ content: 'w-full', footer: 'p-0 block' }"
    >
      <template #body>
        <div class="flex flex-col gap-6 p-6 overflow-y-auto h-full pb-24">
          <!-- ── Section: Identificação ── -->
          <div class="space-y-4">
            <h4
              class="text-xs font-black uppercase tracking-widest text-zinc-400 flex items-center gap-2"
            >
              <UIcon
                name="i-lucide-package"
                class="w-4 h-4"
              />
              Identificação
            </h4>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <!-- Nome -->
              <UFormField
                label="Nome do Produto *"
                class="col-span-full"
              >
                <UInput
                  v-model="form.name"
                  placeholder="ex: Concreto FCK 25 MPa Brita 1"
                  icon="i-lucide-package"
                  class="w-full"
                />
              </UFormField>

              <!-- Tipo -->
              <UFormField label="Tipo *">
                <USelect
                  v-model="form.type"
                  :items="TYPE_FORM_OPTS"
                  value-key="value"
                  label-key="label"
                  class="w-full"
                />
              </UFormField>

              <!-- Unidade -->
              <UFormField label="Unidade *">
                <USelect
                  v-model="form.unit"
                  :items="UNIT_OPTS"
                  value-key="value"
                  label-key="label"
                  class="w-full"
                />
              </UFormField>

              <!-- Preço -->
              <UFormField label="Preço (R$) *">
                <UInput
                  v-model.number="form.price"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0,00"
                  icon="i-heroicons-banknotes"
                  class="w-full"
                />
              </UFormField>

              <!-- SKU -->
              <UFormField label="SKU / Código">
                <UInput
                  v-model="form.sku"
                  placeholder="ex: CONC-25-B1"
                  icon="i-heroicons-qr-code"
                  class="w-full"
                />
              </UFormField>

              <!-- Descrição -->
              <UFormField
                label="Descrição"
                class="col-span-full"
              >
                <UTextarea
                  v-model="form.description"
                  placeholder="Detalhes, características técnicas, condições de uso..."
                  :rows="2"
                  class="w-full"
                />
              </UFormField>
            </div>
          </div>

          <!-- ── Section: Especificações de Concreto (conditional) ── -->
          <Transition
            enter-active-class="transition-all duration-200 ease-out"
            enter-from-class="opacity-0 -translate-y-2"
            enter-to-class="opacity-100 translate-y-0"
            leave-active-class="transition-all duration-150 ease-in"
            leave-from-class="opacity-100 translate-y-0"
            leave-to-class="opacity-0 -translate-y-2"
          >
            <div
              v-if="form.type === 'concrete'"
              class="space-y-4"
            >
              <USeparator />
              <h4
                class="text-xs font-black uppercase tracking-widest text-zinc-400 flex items-center gap-2"
              >
                <UIcon
                  name="i-lucide-layers"
                  class="w-4 h-4"
                />
                Especificações do Concreto
              </h4>
              <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <UFormField label="FCK (MPa)">
                  <UInput
                    v-model.number="form.fck"
                    type="number"
                    min="10"
                    max="100"
                    step="1"
                    placeholder="25"
                    class="w-full"
                  />
                </UFormField>
                <UFormField label="Slump (cm)">
                  <UInput
                    v-model.number="form.slump"
                    type="number"
                    min="0"
                    max="30"
                    step="1"
                    placeholder="10"
                    class="w-full"
                  />
                </UFormField>
                <UFormField label="Brita">
                  <UInput
                    v-model="form.stoneSize"
                    placeholder="brita 1"
                    class="w-full"
                  />
                </UFormField>
              </div>
              <!-- Concrete hint card -->
              <div
                class="rounded-xl bg-blue-50 dark:bg-blue-500/10 ring-1 ring-blue-200 dark:ring-blue-500/20 p-3 flex items-start gap-3"
              >
                <UIcon
                  name="i-heroicons-information-circle"
                  class="w-4 h-4 text-blue-500 mt-0.5 shrink-0"
                />
                <p class="text-xs text-blue-700 dark:text-blue-300">
                  As especificações técnicas (FCK, Slump e Brita) serão
                  preenchidas automaticamente nos itens de orçamento ao
                  selecionar este produto.
                </p>
              </div>
            </div>
          </Transition>

          <USeparator />

          <!-- ── Section: Configurações ── -->
          <div class="space-y-4">
            <h4
              class="text-xs font-black uppercase tracking-widest text-zinc-400 flex items-center gap-2"
            >
              <UIcon
                name="i-heroicons-cog-6-tooth"
                class="w-4 h-4"
              />
              Configurações
            </h4>
            <!-- Active toggle -->
            <div
              class="flex items-center justify-between p-4 rounded-xl ring-1 ring-zinc-200 dark:ring-zinc-700 bg-zinc-50 dark:bg-zinc-800/50"
            >
              <div>
                <p class="text-sm font-bold text-zinc-900 dark:text-white">
                  Produto Ativo
                </p>
                <p class="text-xs text-zinc-400 mt-0.5">
                  Produtos inativos não aparecem na seleção de orçamentos e
                  vendas
                </p>
              </div>
              <button
                type="button"
                :class="[
                  'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none',
                  form.active
                    ? 'bg-primary-500'
                    : 'bg-zinc-300 dark:bg-zinc-600'
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
        <div class="border-t border-zinc-200 dark:border-zinc-800">
          <!-- Price preview -->
          <div class="flex items-center justify-between px-6 pt-4 pb-3">
            <span class="text-xs font-black uppercase tracking-widest text-zinc-400">
              Preço unitário
            </span>
            <span class="text-sm font-bold text-zinc-700 dark:text-zinc-300">
              {{ formatCurrency(Math.round(form.price * 100)) }}
              <span class="text-zinc-400 font-normal">/ {{ UNIT_LABELS[form.unit] }}</span>
            </span>
          </div>
          <!-- Actions -->
          <div class="flex items-center gap-3 px-6 pb-6">
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
                {{ isEditing ? "Salvar Alterações" : "Criar Produto" }}
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
      title="Excluir Produto"
    >
      <template #body>
        <div class="p-6 space-y-4">
          <div class="flex items-start gap-4">
            <div
              class="w-12 h-12 rounded-full bg-red-50 dark:bg-red-500/10 flex items-center justify-center shrink-0"
            >
              <UIcon
                name="i-heroicons-trash"
                class="w-6 h-6 text-red-500"
              />
            </div>
            <div>
              <p class="font-bold text-zinc-900 dark:text-white">
                Confirmar exclusão
              </p>
              <p class="text-sm text-zinc-500 mt-1">
                Tem certeza que deseja excluir
                <strong class="text-zinc-700 dark:text-zinc-300">
                  "{{ deleteTarget?.name }}"
                </strong>
                do catálogo? Esta ação não pode ser desfeita.
              </p>
              <UAlert
                class="mt-3"
                color="warning"
                variant="soft"
                icon="i-heroicons-exclamation-triangle"
                description="Orçamentos e vendas que já usam este produto não serão afetados."
              />
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
