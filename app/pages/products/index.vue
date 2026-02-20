<script setup lang="ts">
const user = useCookie<{ id: number, name: string, email: string, role: string, companyId: number }>('auth_user')
const companyId = computed(() => user.value?.companyId)

// --- State ---
const search = ref('')
const isModalOpen = ref(false)
const selectedProduct = ref(null)

// --- Data Fetching ---
const { data: productsData, status, refresh } = await useFetch('/api/products', {
  query: { companyId },
  watch: [companyId]
})

const products = computed(() => productsData.value?.products || [])

// --- Table Configuration ---
const columns = [
  { key: 'name', label: 'Nome', sortable: true, id: 'name' },
  { key: 'type', label: 'Tipo', sortable: true, id: 'type' },
  { key: 'unit', label: 'Unidade', id: 'unit' },
  { key: 'price', label: 'Preço', sortable: true, id: 'price' },
  { key: 'active', label: 'Status', id: 'active' },
  { key: 'actions', label: 'Ações', id: 'actions' }
]

const filteredRows = computed(() => {
  if (!search.value) return products.value
  return products.value.filter((p: any) => {
    return Object.values(p).some((value) => {
      return String(value).toLowerCase().includes(search.value.toLowerCase())
    })
  })
})

// --- Actions ---
function handleCreate() {
  selectedProduct.value = null
  isModalOpen.value = true
}

function handleEdit(row: any) {
  selectedProduct.value = { ...row } // Clone to avoid mutation
  isModalOpen.value = true
}

async function handleDelete(row: any) {
  if (!confirm(`Tem certeza que deseja excluir o produto "${row.name}"?`)) return

  try {
    await $fetch(`/api/products/${row.id}`, {
      method: 'DELETE'
    })
    refresh() // Refresh list
  } catch (error) {
    console.error('Erro ao excluir:', error)
    alert('Erro ao excluir produto.')
  }
}

// --- Formatters ---
const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value / 100) // Value is in cents
}

const getStatusColor = (active: boolean) => active ? 'success' : 'neutral'
const getStatusLabel = (active: boolean) => active ? 'Ativo' : 'Inativo'

const getTypeLabel = (type: string) => {
  const types: Record<string, string> = {
    concrete: 'Concreto',
    pump: 'Bomba',
    additive: 'Aditivo',
    rental: 'Locação',
    other: 'Outro'
  }
  return types[type] || type
}
</script>

<template>
  <UContainer class="py-8 space-y-6">
    <!-- Header -->
    <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div>
        <h1 class="text-3xl font-bold text-gray-900 dark:text-white font-display">
          Produtos
        </h1>
        <p class="text-gray-500 dark:text-gray-400">
          Gerencie seu catálogo de produtos e serviços.
        </p>
      </div>
      <div class="flex gap-2">
        <UButton
          icon="i-heroicons-plus"
          color="primary"
          variant="solid"
          @click="handleCreate"
        >
          Novo Produto
        </UButton>
      </div>
    </div>

    <!-- Filters & Table -->
    <UCard :ui="{ body: 'p-0 sm:p-0' }">
      <template #header>
        <div class="flex items-center justify-between gap-4 px-4 py-3">
          <UInput
            v-model="search"
            icon="i-heroicons-magnifying-glass-20-solid"
            placeholder="Buscar produtos..."
          />
        </div>
      </template>

      <UTable
        :rows="filteredRows"
        :columns="columns"
        :loading="status === 'pending'"
        class="w-full"
      >
        <!-- Custom Columns -->
        <template #type-data="{ row }">
          <UBadge
            color="neutral"
            variant="subtle"
          >
            {{ getTypeLabel((row as any).type) }}
          </UBadge>
        </template>

        <template #price-data="{ row }">
          <span class="font-medium font-mono">{{ formatCurrency((row as any).price) }}</span>
        </template>

        <template #active-data="{ row }">
          <UBadge
            :color="getStatusColor((row as any).active)"
            variant="subtle"
            size="xs"
          >
            {{ getStatusLabel((row as any).active) }}
          </UBadge>
        </template>

        <template #actions-data="{ row }">
          <div class="flex gap-2">
            <UButton
              color="neutral"
              variant="ghost"
              icon="i-heroicons-pencil-square-20-solid"
              size="xs"
              @click="handleEdit(row)"
            />
            <UButton
              color="error"
              variant="ghost"
              icon="i-heroicons-trash-20-solid"
              size="xs"
              @click="handleDelete(row)"
            />
          </div>
        </template>
      </UTable>

      <!-- Empty State -->
      <div
        v-if="!filteredRows.length"
        class="p-8 text-center text-gray-500"
      >
        <UIcon
          name="i-heroicons-cube"
          class="w-12 h-12 mx-auto text-gray-400 mb-4"
        />
        <p>Nenhum produto encontrado.</p>
      </div>
    </UCard>

    <!-- Modal -->
    <ProductsProductModal
      v-model="isModalOpen"
      :product="selectedProduct"
      @refresh="refresh"
    />
  </UContainer>
</template>
