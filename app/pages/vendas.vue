<script setup lang="ts">
definePageMeta({ layout: 'default' })
useSeoMeta({ title: 'Vendas | Meu Concreto' })

const { user, companyId } = useAuth()
const toast = useToast()
const route = useRoute()

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
type SaleStatus
  = | 'pending'
    | 'confirmed'
    | 'in_progress'
    | 'completed'
    | 'cancelled'

interface SaleItem {
  productId?: number | null
  productName: string
  description?: string
  unit?: string
  quantity: number
  unitPrice: number // cents
  totalPrice?: number
  fck?: number | null
  slump?: number | null
  stoneSize?: string | null
}

interface Sale {
  id: number
  customerName: string
  customerDocument?: string | null
  customerPhone?: string | null
  customerAddress?: string | null
  status: SaleStatus
  date: string | number | null
  deliveryDate?: string | number | null
  subtotal: number
  discount: number
  total: number
  paymentMethod?: string | null
  notes?: string | null
  companyId: number
  userId?: number | null
  quoteId?: number | null
  sellerId?: number | null
  items: SaleItem[]
  transactions?: any[]
  createdAt: string | number
}

interface Product {
  id: number
  name: string
  unit: string
  price: number
  description?: string | null
  fck?: number | null
  slump?: number | null
  stoneSize?: string | null
}

interface PaymentMethod {
  id: number
  name: string
  type: string
  active: boolean
}

interface Company {
  id: number
  name: string
  document: string
  phone?: string | null
  email?: string | null
  address?: string | null
  city?: string | null
  state?: string | null
}

interface Seller {
  id: number
  name: string
  phone?: string | null
  active: boolean
}

interface KnownCustomer {
  id?: string
  label: string
  name: string
  document: string
  phone: string
  address: string
  suffix?: string
  source: 'company' | 'sale'
}

interface QuoteItem {
  productId?: number | null
  productName: string
  description?: string | null
  unit?: string | null
  quantity: number
  unitPrice: number
  fck?: number | null
  slump?: number | null
  stoneSize?: string | null
}

interface Quote {
  id: number
  customerName: string
  customerDocument?: string | null
  customerPhone?: string | null
  customerAddress?: string | null
  status: string
  date: string | number
  subtotal: number
  discount: number
  total: number
  notes?: string | null
  sellerId?: number | null
  items: QuoteItem[]
}

// ─────────────────────────────────────────────
// Data
// ─────────────────────────────────────────────
const {
  data: salesData,
  refresh: refreshSales,
  pending: loadingSales
} = await useFetch<{ sales: Sale[] }>('/api/sales', {
  query: { companyId }
})

const { data: productsData } = await useFetch<{ products: Product[] }>(
  '/api/products',
  {
    query: { companyId }
  }
)
const { data: companiesData } = await useFetch<{ companies: Company[] }>(
  '/api/companies',
  {
    query: { companyId }
  }
)
const { data: paymentMethodsData } = await useFetch<{
  paymentMethods: PaymentMethod[]
}>('/api/payment-methods', {
  query: { companyId, active: true }
})
const { data: sellersData } = await useFetch<{ sellers: Seller[] }>(
  '/api/sellers',
  {
    query: { companyId, active: true }
  }
)

const sales = computed<Sale[]>(() => salesData.value?.sales ?? [])
const products = computed<Product[]>(() => productsData.value?.products ?? [])
const companiesList = computed<Company[]>(
  () => companiesData.value?.companies ?? []
)
const paymentMethods = computed<PaymentMethod[]>(
  () => paymentMethodsData.value?.paymentMethods ?? []
)
const sellersList = computed<Seller[]>(() => sellersData.value?.sellers ?? [])

const sellerOptions = computed(() => [
  { label: 'Nenhum selecionado', value: undefined },
  ...sellersList.value.map(s => ({ label: s.name, value: s.id }))
])

const paymentMethodOptions = computed(() => [
  { label: 'Não informado', value: undefined },
  ...paymentMethods.value.map(pm => ({ label: pm.name, value: pm.name }))
])

// Process incoming query parameters
onMounted(() => {
  const {
    customer,
    customerName,
    customerDocument,
    customerPhone,
    customerAddress
  } = route.query

  if (customer || customerName) {
    // Open drawer and pre-fill form
    openCreate()
    form.customerName = String(customer || customerName)

    if (customerDocument) form.customerDocument = String(customerDocument)
    if (customerPhone) form.customerPhone = String(customerPhone)
    if (customerAddress) form.customerAddress = String(customerAddress)

    // If we have a document, try to find the actual company in our list
    if (customerDocument) {
      const match = companiesList.value.find(
        c => c.document === String(customerDocument)
      )
      if (match) {
        selectedCustomer.value = {
          id: `company-${match.id}`,
          label: match.name,
          name: match.name,
          document: match.document,
          phone: match.phone ?? '',
          address: [match.address, match.city, match.state]
            .filter(Boolean)
            .join(', '),
          source: 'company'
        }
      }
    }
  }
})

// ─────────────────────────────────────────────
// Known customers (from companies + past sales)
// ─────────────────────────────────────────────
const knownCustomers = computed<KnownCustomer[]>(() => {
  const map = new Map<string, KnownCustomer>()

  for (const c of companiesList.value) {
    const key = c.document || c.name
    const fullAddress = [c.address, c.city, c.state].filter(Boolean).join(', ')
    map.set(key, {
      id: `company-${c.id}`,
      label: c.name,
      name: c.name,
      document: c.document ?? '',
      phone: c.phone ?? '',
      address: fullAddress,
      suffix: c.document ? `CNPJ ${c.document}` : undefined,
      source: 'company'
    })
  }

  for (const s of sales.value) {
    const key = s.customerDocument || s.customerName
    if (!map.has(key)) {
      map.set(key, {
        id: `sale-${s.id}`,
        label: s.customerName,
        name: s.customerName,
        document: s.customerDocument ?? '',
        phone: s.customerPhone ?? '',
        address: s.customerAddress ?? '',
        suffix: s.customerDocument
          ? `CPF/CNPJ ${s.customerDocument}`
          : 'Cliente anterior',
        source: 'sale'
      })
    }
  }

  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name))
})

const customerSearchTerm = ref('')
const selectedCustomer = ref<KnownCustomer | undefined>(undefined)

const filteredCustomers = computed(() => {
  const q = customerSearchTerm.value.toLowerCase()
  if (!q) return knownCustomers.value
  return knownCustomers.value.filter(
    c =>
      c.name.toLowerCase().includes(q)
      || c.document.includes(q)
      || c.phone.includes(q)
  )
})

const customerRegisteredAddress = ref('')
const useDeliveryAddress = ref(false)

const onCustomerSelect = (customer: KnownCustomer | undefined) => {
  if (!customer) return
  form.customerName = customer.name
  form.customerDocument = customer.document
  form.customerPhone = customer.phone
  customerRegisteredAddress.value = customer.address
  customerSearchTerm.value = customer.name
  if (!useDeliveryAddress.value) {
    form.customerAddress = customer.address
  }
}

// Customer selection is now handled via @update:model-value on UInputMenu
// to avoid false fires when selectedCustomer is set programmatically in openEdit.
watch(useDeliveryAddress, (val) => {
  if (!val) form.customerAddress = customerRegisteredAddress.value
})

// ─────────────────────────────────────────────
// Input masks
// ─────────────────────────────────────────────
const maskCpfCnpj = (value: string): string => {
  const d = value.replace(/\D/g, '').slice(0, 14)
  if (d.length <= 11) {
    return d
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
  }
  return d
    .replace(/(\d{2})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1/$2')
    .replace(/(\d{4})(\d{1,2})$/, '$1-$2')
}

const maskPhone = (value: string): string => {
  const d = value.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 10)
    return d.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{4})(\d)/, '$1-$2')
  return d.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d)/, '$1-$2')
}

// ─────────────────────────────────────────────
// Formatters
// ─────────────────────────────────────────────
const formatCurrency = (cents: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
    cents / 100
  )

const formatDate = (v: string | number | null | undefined) => {
  if (!v) return '—'
  return new Intl.DateTimeFormat('pt-BR').format(new Date(v))
}

// ─────────────────────────────────────────────
// Filter & Search
// ─────────────────────────────────────────────
const search = ref('')
const statusFilter = ref<SaleStatus | 'all'>('all')

const STATUS_OPTS = [
  { label: 'Todos', value: 'all' },
  { label: 'Pendente', value: 'pending' },
  { label: 'Confirmado', value: 'confirmed' },
  { label: 'Em Andamento', value: 'in_progress' },
  { label: 'Concluído', value: 'completed' },
  { label: 'Cancelado', value: 'cancelled' }
]

const filteredSales = computed(() => {
  return sales.value
    .filter((s) => {
      const matchState
        = statusFilter.value === 'all' || s.status === statusFilter.value
      const matchSearch
        = !search.value
          || s.customerName.toLowerCase().includes(search.value.toLowerCase())
          || String(s.id).includes(search.value)
          || (s.customerDocument ?? '').includes(search.value)
      return matchState && matchSearch
    })
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
})

// ─────────────────────────────────────────────
// Pagination
// ─────────────────────────────────────────────
const page = ref(1)
const pageSize = ref(10)

const paginatedSales = computed(() => {
  const start = (page.value - 1) * pageSize.value
  return filteredSales.value.slice(start, start + pageSize.value)
})

const totalPages = computed(() =>
  Math.ceil(filteredSales.value.length / pageSize.value)
)

watch([search, statusFilter], () => {
  page.value = 1
})

// ─────────────────────────────────────────────
// Status helpers
// ─────────────────────────────────────────────
const statusConfig: Record<
  SaleStatus,
  { label: string, color: string, icon: string }
> = {
  pending: {
    label: 'Pendente',
    color: 'warning',
    icon: 'i-heroicons-clock'
  },
  confirmed: {
    label: 'Confirmado',
    color: 'info',
    icon: 'i-heroicons-check-badge'
  },
  in_progress: {
    label: 'Em Andamento',
    color: 'info',
    icon: 'i-heroicons-truck'
  },
  completed: {
    label: 'Concluído',
    color: 'success',
    icon: 'i-heroicons-check-circle'
  },
  cancelled: {
    label: 'Cancelado',
    color: 'error',
    icon: 'i-heroicons-x-circle'
  }
}

const STATUS_ACTIONS: Record<
  SaleStatus,
  { next: SaleStatus, label: string }[]
> = {
  pending: [
    { next: 'confirmed', label: 'Confirmar Venda' },
    { next: 'cancelled', label: 'Cancelar' }
  ],
  confirmed: [
    { next: 'in_progress', label: 'Iniciar Entrega' },
    { next: 'cancelled', label: 'Cancelar' }
  ],
  in_progress: [
    { next: 'completed', label: 'Marcar como Concluído' },
    { next: 'cancelled', label: 'Cancelar' }
  ],
  completed: [],
  cancelled: [{ next: 'pending', label: 'Reabrir como Pendente' }]
}

// ─────────────────────────────────────────────
// Summary stats
// ─────────────────────────────────────────────
const stats = computed(() => {
  const all = sales.value
  return {
    total: all.length,
    inProgress: all.filter(
      s => s.status === 'confirmed' || s.status === 'in_progress'
    ).length,
    completed: all.filter(s => s.status === 'completed').length,
    totalValue: all
      .filter(
        s =>
          s.status === 'completed'
          || s.status === 'confirmed'
          || s.status === 'in_progress'
      )
      .reduce((sum, s) => sum + s.total, 0)
  }
})

// ─────────────────────────────────────────────
// Drawer State
// ─────────────────────────────────────────────
const isDrawerOpen = ref(false)
const isEditing = ref(false)
const loadingSave = ref(false)

// ─────────────────────────────────────────────
// Form state
// ─────────────────────────────────────────────
interface FormItem {
  _key: number
  productId: number | null
  productName: string
  description: string
  unit: string
  quantity: number
  unitPrice: number // display value in BRL (float)
  fck: number | null
  slump: number | null
  stoneSize: string
}

const makeNewItem = (): FormItem => ({
  _key: Date.now() + Math.random(),
  productId: null,
  productName: '',
  description: '',
  unit: 'm3',
  quantity: 1,
  unitPrice: 0,
  fck: null,
  slump: null,
  stoneSize: ''
})

const editingId = ref<number | null>(null)
const linkedQuoteId = ref<number | null>(null)

const form = reactive({
  customerName: '',
  customerDocument: '',
  customerPhone: '',
  customerAddress: '',
  sellerId: undefined as number | undefined,
  status: 'pending' as SaleStatus,
  date: new Date().toISOString().slice(0, 10),
  deliveryDate: '',
  discount: 0, // BRL float
  paymentMethod: '',
  notes: '',
  items: [makeNewItem()] as FormItem[]
})

// Mask watches — after form declaration to avoid temporal dead zone
watch(
  () => form.customerDocument,
  (val) => {
    const masked = maskCpfCnpj(val)
    if (masked !== val) form.customerDocument = masked
  }
)

watch(
  () => form.customerPhone,
  (val) => {
    const masked = maskPhone(val)
    if (masked !== val) form.customerPhone = masked
  }
)

const resetForm = () => {
  editingId.value = null
  linkedQuoteId.value = null
  isEditing.value = false
  form.customerName = ''
  form.customerDocument = ''
  form.customerPhone = ''
  form.customerAddress = ''
  form.sellerId = undefined
  form.status = 'pending'
  form.date = new Date().toISOString().slice(0, 10)
  form.deliveryDate = ''
  form.discount = 0
  form.paymentMethod = ''
  form.notes = ''
  form.items = [makeNewItem()]
  customerSearchTerm.value = ''
  selectedCustomer.value = undefined
  customerRegisteredAddress.value = ''
  useDeliveryAddress.value = false
}

const openCreate = () => {
  resetForm()
  isDrawerOpen.value = true
}

const openEdit = (s: Sale) => {
  // Guard: completed and cancelled sales cannot be edited
  if (isLocked(s)) {
    toast.add({
      title: 'Edição não permitida',
      description: `Vendas com status "${statusConfig[s.status].label}" não podem ser editadas.`,
      color: 'warning',
      icon: 'i-heroicons-lock-closed'
    })
    return
  }
  // Block the selectedCustomer watch throughout the entire initialization
  //   (removed — now handled by @update:model-value event on UInputMenu)
  resetForm()
  isEditing.value = true
  editingId.value = s.id
  linkedQuoteId.value = s.quoteId ?? null

  // Set all form fields directly — no watch involved, safe and predictable
  form.customerName = s.customerName
  form.customerDocument = s.customerDocument ?? ''
  form.customerPhone = s.customerPhone ?? ''
  form.customerAddress = s.customerAddress ?? ''
  form.sellerId = (s as any).sellerId || undefined

  // Set the combobox display — matches by `name` via by="name" prop
  // Setting this does NOT trigger onCustomerSelect (handled by @update:model-value, not watch)
  selectedCustomer.value = {
    id: `sale-${s.id}`,
    label: s.customerName,
    name: s.customerName,
    document: s.customerDocument ?? '',
    phone: s.customerPhone ?? '',
    address: s.customerAddress ?? '',
    source: 'sale'
  }
  // Set the search term so the UInputMenu input displays the customer name
  customerSearchTerm.value = s.customerName ?? ''

  const matchedCompany = companiesList.value.find(
    c => c.document === s.customerDocument || c.name === s.customerName
  )
  if (matchedCompany) {
    const fullAddr = [
      matchedCompany.address,
      matchedCompany.city,
      matchedCompany.state
    ]
      .filter(Boolean)
      .join(', ')
    customerRegisteredAddress.value = fullAddr
    useDeliveryAddress.value
      = !!s.customerAddress && s.customerAddress !== fullAddr
  } else {
    customerRegisteredAddress.value = s.customerAddress ?? ''
    useDeliveryAddress.value = false
  }
  form.status = s.status
  form.date = s.date
    ? new Date(s.date).toISOString().slice(0, 10)
    : new Date().toISOString().slice(0, 10)
  form.deliveryDate = s.deliveryDate
    ? new Date(s.deliveryDate).toISOString().slice(0, 10)
    : ''
  form.discount = s.discount / 100
  form.paymentMethod = s.paymentMethod ?? ''
  form.notes = s.notes ?? ''
  form.items = (s.items ?? []).map(it => ({
    _key: Date.now() + Math.random(),
    productId: it.productId ?? null,
    productName: it.productName,
    description: it.description ?? '',
    unit: it.unit ?? 'm3',
    quantity: it.quantity,
    unitPrice: it.unitPrice / 100,
    fck: it.fck ?? null,
    slump: it.slump ?? null,
    stoneSize: it.stoneSize ?? ''
  }))
  if (form.items.length === 0) form.items = [makeNewItem()]
  isDrawerOpen.value = true
}

// ─────────────────────────────────────────────
// Pre-fill from quote (when coming from ?quoteId=)
// ─────────────────────────────────────────────
const prefillFromQuote = async (quoteId: number) => {
  try {
    const res = await $fetch<{ quote: Quote }>(`/api/quotes/${quoteId}`)
    const q = res?.quote
    if (!q) return
    linkedQuoteId.value = quoteId
    form.customerName = q.customerName ?? ''
    form.customerDocument = q.customerDocument ?? ''
    form.customerPhone = q.customerPhone ?? ''
    form.customerAddress = q.customerAddress ?? ''
    form.sellerId = (q as any).sellerId ?? null
    customerSearchTerm.value = q.customerName ?? ''
    form.discount = (q.discount ?? 0) / 100
    form.notes = q.notes ?? ''
    form.items = (q.items ?? []).map(it => ({
      _key: Date.now() + Math.random(),
      productId: it.productId ?? null,
      productName: it.productName,
      description: it.description ?? '',
      unit: it.unit ?? 'm3',
      quantity: it.quantity,
      unitPrice: it.unitPrice / 100,
      fck: it.fck ?? null,
      slump: it.slump ?? null,
      stoneSize: it.stoneSize ?? ''
    }))
    if (form.items.length === 0) form.items = [makeNewItem()]
  } catch (e) {
    console.error('Failed to prefill from quote:', e)
  }
}

// Check for ?quoteId on mount
onMounted(async () => {
  const quoteId = route.query.quoteId
    ? parseInt(String(route.query.quoteId))
    : null
  if (quoteId) {
    resetForm()
    await prefillFromQuote(quoteId)
    isDrawerOpen.value = true
  }
})

// ─────────────────────────────────────────────
// Items management
// ─────────────────────────────────────────────
const addItem = () => {
  form.items.push(makeNewItem())
}

const removeItem = (idx: number) => {
  if (form.items.length > 1) form.items.splice(idx, 1)
}

const onProductSelect = (idx: number, productId: number | null) => {
  if (!productId) return
  const prod = products.value.find(p => p.id === productId)
  if (!prod) return
  const item = form.items[idx]
  if (!item) return
  item.productId = prod.id
  item.productName = prod.name
  item.description = prod.description ?? ''
  item.unit = prod.unit
  item.unitPrice = prod.price / 100
  item.fck = prod.fck ?? null
  item.slump = prod.slump ?? null
  item.stoneSize = prod.stoneSize ?? ''
}

// ─────────────────────────────────────────────
// Totals
// ─────────────────────────────────────────────
const subtotalBRL = computed(() =>
  form.items.reduce((s, it) => s + it.quantity * it.unitPrice, 0)
)
const totalBRL = computed(() => Math.max(0, subtotalBRL.value - form.discount))

// ─────────────────────────────────────────────
// Save
// ─────────────────────────────────────────────
const handleSave = async () => {
  if (form.customerName.trim().length < 3) {
    toast.add({
      title: 'Campos inválidos',
      description: 'Nome do cliente deve ter pelo menos 3 caracteres.',
      color: 'warning',
      icon: 'i-heroicons-exclamation-triangle'
    })
    return
  }
  if (form.items.some(it => !it.productName.trim())) {
    toast.add({
      title: 'Campos inválidos',
      description: 'Todos os itens precisam ter um nome de produto.',
      color: 'warning',
      icon: 'i-heroicons-exclamation-triangle'
    })
    return
  }
  if (form.items.some(it => it.quantity <= 0)) {
    toast.add({
      title: 'Campos inválidos',
      description: 'A quantidade de cada item deve ser maior que zero.',
      color: 'warning',
      icon: 'i-heroicons-exclamation-triangle'
    })
    return
  }
  if (form.items.some(it => it.unitPrice < 0)) {
    toast.add({
      title: 'Campos inválidos',
      description: 'O preço unitário não pode ser negativo.',
      color: 'warning',
      icon: 'i-heroicons-exclamation-triangle'
    })
    return
  }
  if (form.discount < 0) {
    toast.add({
      title: 'Campos inválidos',
      description: 'O desconto não pode ser negativo.',
      color: 'warning',
      icon: 'i-heroicons-exclamation-triangle'
    })
    return
  }

  loadingSave.value = true
  try {
    const payload = {
      companyId: companyId.value,
      userId: user.value?.id ?? undefined,
      quoteId: linkedQuoteId.value ?? undefined,
      customerName: form.customerName,
      customerDocument: form.customerDocument || undefined,
      customerPhone: form.customerPhone || undefined,
      customerAddress: form.customerAddress || undefined,
      sellerId: form.sellerId || undefined,
      status: form.status,
      date: form.date
        ? new Date(form.date).toISOString()
        : new Date().toISOString(),
      deliveryDate: form.deliveryDate
        ? new Date(form.deliveryDate).toISOString()
        : undefined,
      discount: Math.round(form.discount * 100),
      paymentMethod: form.paymentMethod || undefined,
      notes: form.notes || undefined,
      items: form.items.map(it => ({
        productId: it.productId ?? undefined,
        productName: it.productName,
        description: it.description || undefined,
        unit: it.unit || undefined,
        quantity: it.quantity,
        unitPrice: Math.round(it.unitPrice * 100),
        fck: it.fck ?? undefined,
        slump: it.slump ?? undefined,
        stoneSize: it.stoneSize || undefined
      }))
    }

    if (isEditing.value && editingId.value) {
      await $fetch(`/api/sales/${editingId.value}`, {
        method: 'PUT',
        body: payload
      })
      toast.add({
        title: 'Venda atualizada',
        description: 'As alterações foram salvas com sucesso.',
        color: 'success',
        icon: 'i-heroicons-check-circle'
      })
    } else {
      await $fetch('/api/sales', { method: 'POST', body: payload })
      toast.add({
        title: 'Venda criada',
        description: `Venda para ${form.customerName} criada com sucesso.`,
        color: 'success',
        icon: 'i-heroicons-check-circle'
      })
    }

    isDrawerOpen.value = false
    await refreshSales()
  } catch (e: unknown) {
    const err = e as { data?: { statusMessage?: string }, message?: string }
    toast.add({
      title: 'Erro ao salvar',
      description:
        err?.data?.statusMessage ?? err?.message ?? 'Erro ao salvar venda.',
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
const deleteTarget = ref<Sale | null>(null)
const loadingDelete = ref(false)
const isDeleteModalOpen = ref(false)

const confirmDelete = (s: Sale) => {
  deleteTarget.value = s
  isDeleteModalOpen.value = true
}

const handleDelete = async () => {
  if (!deleteTarget.value) return
  loadingDelete.value = true
  const name = deleteTarget.value.customerName
  try {
    await $fetch(`/api/sales/${deleteTarget.value.id}`, { method: 'DELETE' })
    isDeleteModalOpen.value = false
    toast.add({
      title: 'Venda excluída',
      description: `Venda de ${name} foi excluída.`,
      color: 'neutral',
      icon: 'i-heroicons-trash'
    })
    await refreshSales()
  } catch (e: unknown) {
    const err = e as { data?: { statusMessage?: string }, message?: string }
    toast.add({
      title: 'Erro ao excluir',
      description:
        err?.data?.statusMessage ?? err?.message ?? 'Tente novamente.',
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
const updateStatus = async (s: Sale, status: SaleStatus) => {
  try {
    await $fetch(`/api/sales/${s.id}`, { method: 'PUT', body: { status } })
    toast.add({
      title: 'Status atualizado',
      description: `Venda #${String(s.id).padStart(4, '0')} agora é ${statusConfig[status].label}.`,
      color: 'success',
      icon: statusConfig[status].icon
    })
    await refreshSales()
  } catch (e) {
    console.error(e)
  }
}

// ─────────────────────────────────────────────
// Billing logic
// ─────────────────────────────────────────────
const billingDialog = ref(false)
const billingSale = ref<Sale | null>(null)
const billingForm = reactive({
  paymentMethod: '',
  status: 'paid' as 'paid' | 'pending'
})

const openBill = (s: Sale) => {
  if (isBilled(s)) {
    toast.add({
      title: 'Venda já faturada',
      description: `A venda #${String(s.id).padStart(4, '0')} já possui uma transação financeira registrada.`,
      color: 'warning',
      icon: 'i-heroicons-check-badge'
    })
    return
  }
  if (s.status === 'cancelled') {
    toast.add({
      title: 'Operação inválida',
      description: 'Não é possível faturar uma venda cancelada.',
      color: 'error',
      icon: 'i-heroicons-x-circle'
    })
    return
  }
  billingSale.value = s
  billingForm.paymentMethod = s.paymentMethod || ''
  billingForm.status = 'paid'
  billingDialog.value = true
}

const handleBill = async () => {
  if (!billingSale.value) return
  try {
    await $fetch(`/api/sales/${billingSale.value.id}/bill`, {
      method: 'POST',
      body: {
        paymentMethod: billingForm.paymentMethod,
        status: billingForm.status
      }
    })
    toast.add({
      title: 'Venda faturada',
      description: `A venda #${String(billingSale.value.id).padStart(4, '0')} gerou uma transação de receita.`,
      color: 'success',
      icon: 'i-heroicons-banknotes'
    })
    billingDialog.value = false
    await refreshSales()
  } catch (e: any) {
    toast.add({
      title: 'Erro ao faturar',
      description:
        e.data?.statusMessage || e.message || 'Tente novamente mais tarde.',
      color: 'error',
      icon: 'i-heroicons-exclamation-circle'
    })
  }
}

const sendWhatsapp = async (s: Sale) => {
  if (!s.customerPhone) {
    toast.add({
      title: 'Telefone ausente',
      description:
        'O cliente não possui um telefone de WhatsApp cadastrado nesta venda.',
      color: 'warning',
      icon: 'i-heroicons-exclamation-circle'
    })
    return
  }

  try {
    const res = await $fetch<{
      success: boolean
      sent: string[]
      failed: string[]
    }>(`/api/sales/${s.id}/send-pdf`, { method: 'POST' })
    if (res.success) {
      toast.add({
        title: 'Enviado com sucesso',
        description: `PDF enviado para ${res.sent.join(', ')}`,
        color: 'success',
        icon: 'i-heroicons-check-circle'
      })
    } else {
      throw new Error('Falha no envio')
    }
  } catch (e: any) {
    toast.add({
      title: 'Erro ao enviar',
      description:
        e.data?.statusMessage || e.message || 'Tente novamente mais tarde.',
      color: 'error',
      icon: 'i-heroicons-exclamation-circle'
    })
  }
}

// ─────────────────────────────────────────────
// Row action menu items
// ─────────────────────────────────────────────
const isBilled = (s: Sale) => (s.transactions ?? []).length > 0
const isLocked = (s: Sale) =>
  s.status === 'completed' || s.status === 'cancelled'

const rowActions = (s: Sale) => {
  const billed = isBilled(s)
  const locked = isLocked(s)
  return [
    [
      {
        label: locked ? 'Ver Venda' : 'Editar Venda',
        icon: locked ? 'i-heroicons-eye' : 'i-heroicons-pencil-square',
        disabled: locked,
        onSelect: () => {
          if (!locked) openEdit(s)
        }
      },
      ...STATUS_ACTIONS[s.status].map(a => ({
        label: a.label,
        icon: statusConfig[a.next].icon,
        onSelect: () => updateStatus(s, a.next)
      })),
      ...(s.status !== 'cancelled'
        ? [
            {
              label: billed ? 'Já Faturada' : 'Faturar',
              icon: billed
                ? 'i-heroicons-check-badge'
                : 'i-heroicons-banknotes',
              color: (billed ? 'neutral' : 'success') as any,
              disabled: billed,
              onSelect: () => {
                if (!billed) openBill(s)
              }
            }
          ]
        : [])
    ],
    [
      {
        label: 'Enviar via WhatsApp',
        icon: 'i-simple-icons-whatsapp',
        onSelect: () => sendWhatsapp(s)
      }
    ],
    [
      {
        label: 'Excluir',
        icon: 'i-heroicons-trash',
        color: 'error' as const,
        disabled: locked || billed,
        onSelect: () => {
          if (!locked && !billed) confirmDelete(s)
        }
      }
    ]
  ]
}

const productOptions = computed(() =>
  products.value.map(p => ({
    label: `${p.name}${p.fck ? ` — FCK ${p.fck}MPa` : ''}`,
    value: p.id
  }))
)
</script>

<template>
  <div class="p-6 lg:p-8 space-y-6">
    <!-- ── Page Header ── -->
    <div class="flex items-start justify-between gap-4">
      <div>
        <h1 class="text-2xl font-black text-zinc-900 dark:text-white">
          Vendas
        </h1>
        <p class="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
          Gerencie pedidos, entregas e acompanhe o faturamento
        </p>
      </div>
      <UButton
        color="primary"
        icon="i-heroicons-plus"
        size="md"
        class="shrink-0"
        @click="openCreate"
      >
        Nova Venda
      </UButton>
    </div>

    <!-- ── KPI Strip ── -->
    <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
      <div
        v-for="(kpi, i) in [
          {
            label: 'Total de Vendas',
            value: stats.total,
            suffix: 'vendas',
            icon: 'i-heroicons-shopping-cart',
            color: 'text-primary-500',
            bg: 'bg-primary-50 dark:bg-primary-500/10'
          },
          {
            label: 'Em Andamento',
            value: stats.inProgress,
            suffix: 'em progresso',
            icon: 'i-heroicons-truck',
            color: 'text-amber-500',
            bg: 'bg-amber-50 dark:bg-amber-500/10'
          },
          {
            label: 'Concluídas',
            value: stats.completed,
            suffix: 'concluídas',
            icon: 'i-heroicons-check-circle',
            color: 'text-green-500',
            bg: 'bg-green-50 dark:bg-green-500/10'
          },
          {
            label: 'Valor em Aberto',
            value: formatCurrency(stats.totalValue),
            suffix: '',
            icon: 'i-lucide-trending-up',
            color: 'text-blue-500',
            bg: 'bg-blue-50 dark:bg-blue-500/10'
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
            Lista de Vendas
          </h3>
          <div class="flex items-center gap-2 flex-wrap justify-end">
            <UInput
              v-model="search"
              icon="i-heroicons-magnifying-glass"
              placeholder="Buscar cliente, nº..."
              size="sm"
              class="w-44 lg:w-56"
            />
            <USelect
              v-model="statusFilter"
              :items="STATUS_OPTS"
              value-key="value"
              label-key="label"
              size="sm"
              class="w-36"
            />
          </div>
        </div>
      </template>

      <!-- Loading skeleton -->
      <div
        v-if="loadingSales"
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
        v-else-if="filteredSales.length === 0"
        class="flex flex-col items-center justify-center py-16 text-zinc-400"
      >
        <UIcon
          name="i-heroicons-shopping-cart"
          class="w-12 h-12 mb-3"
        />
        <p class="text-sm font-bold">
          Nenhuma venda encontrada
        </p>
        <p class="text-xs mt-1">
          Ajuste a busca ou registre uma nova venda
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
                Nº
              </th>
              <th
                class="text-left px-4 py-3 text-xs font-black uppercase tracking-widest text-zinc-400"
              >
                Cliente
              </th>
              <th
                class="text-left px-4 py-3 text-xs font-black uppercase tracking-widest text-zinc-400 hidden md:table-cell"
              >
                Data
              </th>
              <th
                class="text-left px-4 py-3 text-xs font-black uppercase tracking-widest text-zinc-400 hidden lg:table-cell"
              >
                Entrega
              </th>
              <th
                class="text-left px-4 py-3 text-xs font-black uppercase tracking-widest text-zinc-400 hidden lg:table-cell"
              >
                Pagamento
              </th>
              <th
                class="text-left px-4 py-3 text-xs font-black uppercase tracking-widest text-zinc-400"
              >
                Status
              </th>
              <th
                class="text-right px-4 py-3 text-xs font-black uppercase tracking-widest text-zinc-400"
              >
                Total
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
              v-for="s in paginatedSales"
              :key="s.id"
              class="border-b border-zinc-100 dark:border-zinc-800/60 hover:bg-primary-50/50 dark:hover:bg-primary-500/5 transition-colors group relative"
            >
              <!-- ID -->
              <td
                class="px-4 py-3.5 font-black text-zinc-400 text-xs whitespace-nowrap"
              >
                #{{ String(s.id).padStart(4, "0") }}
                <span
                  v-if="s.quoteId"
                  class="block text-[10px] text-zinc-300 dark:text-zinc-600"
                >
                  ORC #{{ String(s.quoteId).padStart(4, "0") }}
                </span>
              </td>
              <!-- Customer -->
              <td class="px-4 py-3.5">
                <div class="flex items-center gap-3">
                  <div
                    class="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-500/10 flex items-center justify-center shrink-0"
                  >
                    <span
                      class="text-xs font-black text-primary-600 dark:text-primary-400"
                    >
                      {{ s.customerName.charAt(0).toUpperCase() }}
                    </span>
                  </div>
                  <div class="min-w-0">
                    <p
                      class="font-bold text-zinc-900 dark:text-white truncate max-w-35 sm:max-w-50"
                    >
                      {{ s.customerName }}
                    </p>
                    <p
                      v-if="s.customerPhone"
                      class="text-xs text-zinc-400 truncate"
                    >
                      {{ s.customerPhone }}
                    </p>
                  </div>
                </div>
              </td>
              <!-- Date -->
              <td
                class="px-4 py-3.5 text-zinc-500 text-xs whitespace-nowrap hidden md:table-cell"
              >
                {{ formatDate(s.date) }}
              </td>
              <!-- Delivery date -->
              <td class="px-4 py-3.5 hidden lg:table-cell">
                <span
                  v-if="s.deliveryDate"
                  class="text-xs text-zinc-500"
                >
                  {{ formatDate(s.deliveryDate) }}
                </span>
                <span
                  v-else
                  class="text-xs text-zinc-300"
                >—</span>
              </td>
              <!-- Payment method -->
              <td class="px-4 py-3.5 hidden lg:table-cell">
                <span
                  v-if="s.paymentMethod"
                  class="text-xs text-zinc-500"
                >
                  {{ s.paymentMethod }}
                </span>
                <span
                  v-else
                  class="text-xs text-zinc-300"
                >—</span>
              </td>
              <!-- Status -->
              <td class="px-4 py-3.5">
                <UDropdownMenu
                  :items="
                    STATUS_ACTIONS[s.status].length
                      ? [
                        STATUS_ACTIONS[s.status].map((a) => ({
                          label: a.label,
                          onSelect: () => updateStatus(s, a.next)
                        }))
                      ]
                      : undefined
                  "
                  :disabled="STATUS_ACTIONS[s.status].length === 0"
                >
                  <UBadge
                    :color="statusConfig[s.status].color as any"
                    variant="soft"
                    size="sm"
                    :icon="statusConfig[s.status].icon"
                    :class="
                      STATUS_ACTIONS[s.status].length
                        ? 'cursor-pointer'
                        : 'cursor-default'
                    "
                  >
                    {{ statusConfig[s.status].label }}
                  </UBadge>
                </UDropdownMenu>
              </td>
              <!-- Total -->
              <td
                class="px-4 py-3.5 text-right font-black text-zinc-900 dark:text-white whitespace-nowrap"
              >
                {{ formatCurrency(s.total) }}
              </td>
              <!-- Actions -->
              <td class="px-4 py-3.5 text-right">
                <UDropdownMenu :items="rowActions(s)">
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
      <template #footer>
        <div
          v-if="filteredSales.length > pageSize"
          class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between pt-1"
        >
          <p class="text-xs text-zinc-400">
            {{ filteredSales.length }} vendas · página {{ page }} de
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
      :title="isEditing ? 'Editar Venda' : 'Nova Venda'"
      side="right"
      :ui="{ content: 'w-full', footer: 'p-0 block' }"
    >
      <template #body>
        <div class="flex flex-col gap-6 p-6 overflow-y-auto h-full pb-24">
          <!-- Quote origin badge -->
          <div
            v-if="linkedQuoteId"
            class="flex items-center gap-2 rounded-xl bg-blue-50 dark:bg-blue-500/10 ring-1 ring-blue-200 dark:ring-blue-500/20 px-4 py-2.5"
          >
            <UIcon
              name="i-heroicons-document-text"
              class="w-4 h-4 text-blue-500 shrink-0"
            />
            <p class="text-sm text-blue-700 dark:text-blue-300">
              Originada do orçamento
              <strong>#{{ String(linkedQuoteId).padStart(4, "0") }}</strong>
            </p>
          </div>

          <!-- ── Section: Cliente ── -->
          <div class="space-y-4">
            <h4
              class="text-xs font-black uppercase tracking-widest text-zinc-400 flex items-center gap-2"
            >
              <UIcon
                name="i-heroicons-user"
                class="w-4 h-4"
              />
              Dados do Cliente
            </h4>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <!-- Nome com autocomplete -->
              <UFormField
                label="Nome do Cliente *"
                class="col-span-full"
              >
                <UInputMenu
                  v-model="selectedCustomer"
                  v-model:search-term="customerSearchTerm"
                  :items="filteredCustomers"
                  placeholder="Buscar ou digitar nome..."
                  icon="i-heroicons-user"
                  class="w-full"
                  :reset-search-term-on-blur="false"
                  :reset-search-term-on-select="false"
                  by="name"
                  @update:model-value="
                    (v: KnownCustomer | undefined) => v && onCustomerSelect(v)
                  "
                  @update:search-term="
                    (v: string) => {
                      form.customerName = v;
                      if (selectedCustomer && v !== selectedCustomer.name) {
                        selectedCustomer = undefined;
                      }
                    }
                  "
                >
                  <template #item="{ item }">
                    <div class="flex items-center gap-3 py-0.5 w-full min-w-0">
                      <div
                        class="w-7 h-7 rounded-full bg-primary-100 dark:bg-primary-500/10 flex items-center justify-center shrink-0"
                      >
                        <span
                          class="text-[10px] font-black text-primary-600 dark:text-primary-400"
                        >
                          {{ item.name.charAt(0).toUpperCase() }}
                        </span>
                      </div>
                      <div class="min-w-0">
                        <p
                          class="text-sm font-bold text-zinc-900 dark:text-white truncate"
                        >
                          {{ item.name }}
                        </p>
                        <p
                          v-if="item.suffix"
                          class="text-xs text-zinc-400 truncate"
                        >
                          {{ item.suffix }}
                        </p>
                      </div>
                      <UBadge
                        :color="item.source === 'company' ? 'info' : 'neutral'"
                        variant="soft"
                        size="xs"
                        class="ml-auto shrink-0"
                      >
                        {{ item.source === "company" ? "Empresa" : "Anterior" }}
                      </UBadge>
                    </div>
                  </template>
                </UInputMenu>
              </UFormField>

              <!-- Documento + Telefone -->
              <UFormField label="CPF / CNPJ">
                <UInput
                  v-model="form.customerDocument"
                  placeholder="000.000.000-00 ou 00.000.000/0000-00"
                  icon="i-heroicons-identification"
                  class="w-full"
                />
              </UFormField>
              <UFormField label="Telefone">
                <UInput
                  v-model="form.customerPhone"
                  placeholder="(00) 00000-0000"
                  icon="i-heroicons-phone"
                  class="w-full"
                />
              </UFormField>

              <!-- Address block -->
              <div class="col-span-full space-y-3">
                <div
                  v-if="customerRegisteredAddress"
                  class="rounded-xl bg-zinc-50 dark:bg-zinc-800/50 ring-1 ring-zinc-200 dark:ring-zinc-700 p-3 flex items-start gap-3"
                >
                  <UIcon
                    name="i-heroicons-map-pin"
                    class="w-4 h-4 text-zinc-400 mt-0.5 shrink-0"
                  />
                  <div class="min-w-0 flex-1">
                    <p
                      class="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest mb-0.5"
                    >
                      Endereço Cadastrado
                    </p>
                    <p class="text-sm text-zinc-700 dark:text-zinc-300">
                      {{ customerRegisteredAddress }}
                    </p>
                  </div>
                  <UButton
                    color="neutral"
                    variant="ghost"
                    size="xs"
                    icon="i-heroicons-pencil-square"
                    :label="useDeliveryAddress ? 'Cancelar' : 'Alterar entrega'"
                    @click="useDeliveryAddress = !useDeliveryAddress"
                  />
                </div>

                <UFormField
                  :label="
                    customerRegisteredAddress
                      ? 'Endereço de Entrega (diferente)'
                      : 'Endereço de Entrega'
                  "
                  :class="{
                    hidden: customerRegisteredAddress && !useDeliveryAddress
                  }"
                >
                  <UInput
                    v-model="form.customerAddress"
                    placeholder="Rua, número, bairro, cidade"
                    icon="i-heroicons-truck"
                    class="w-full"
                  />
                </UFormField>
              </div>

              <!-- Vendedor Responsável -->
              <UFormField
                label="Vendedor Responsável"
                class="col-span-full"
              >
                <USelect
                  v-model="form.sellerId"
                  :items="sellerOptions"
                  value-key="value"
                  label-key="label"
                  placeholder="Selecione um vendedor..."
                  class="w-full"
                />
              </UFormField>
            </div>
          </div>

          <USeparator />

          <!-- ── Section: Itens ── -->
          <div class="space-y-4">
            <div class="flex items-center justify-between">
              <h4
                class="text-xs font-black uppercase tracking-widest text-zinc-400 flex items-center gap-2"
              >
                <UIcon
                  name="i-lucide-package"
                  class="w-4 h-4"
                />
                Itens da Venda
              </h4>
              <UButton
                color="primary"
                variant="soft"
                icon="i-heroicons-plus"
                size="xs"
                @click="() => addItem()"
              >
                Adicionar
              </UButton>
            </div>

            <div class="space-y-4">
              <div
                v-for="(item, idx) in form.items"
                :key="item._key"
                class="rounded-xl border border-zinc-200 dark:border-zinc-700 p-4 space-y-3 relative"
              >
                <!-- Remove btn -->
                <button
                  v-if="form.items.length > 1"
                  class="absolute top-3 right-3 text-zinc-300 hover:text-red-400 transition-colors"
                  @click="removeItem(idx)"
                >
                  <UIcon
                    name="i-heroicons-x-mark"
                    class="w-4 h-4"
                  />
                </button>

                <!-- Product select -->
                <UFormField label="Produto">
                  <USelect
                    :items="productOptions"
                    :model-value="item.productId ?? undefined"
                    value-key="value"
                    label-key="label"
                    placeholder="Selecione ou deixe em branco"
                    class="w-full"
                    @update:model-value="
                      (v: any) => onProductSelect(idx, v ?? null)
                    "
                  />
                </UFormField>

                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <UFormField label="Nome do Item *">
                    <UInput
                      v-model="item.productName"
                      placeholder="Nome do produto/serviço"
                      class="w-full"
                    />
                  </UFormField>
                  <UFormField label="Unidade">
                    <USelect
                      v-model="item.unit"
                      :items="['m3', 'un', 'hr', 'kg', 'ton']"
                      class="w-full"
                    />
                  </UFormField>
                </div>

                <UFormField label="Descrição">
                  <UInput
                    v-model="item.description"
                    placeholder="Detalhes adicionais (opcional)"
                    class="w-full"
                  />
                </UFormField>

                <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <UFormField label="Qtd">
                    <UInput
                      v-model.number="item.quantity"
                      type="number"
                      min="0.1"
                      step="0.1"
                      class="w-full"
                    />
                  </UFormField>
                  <UFormField label="Preço Unit. (R$)">
                    <UInput
                      v-model.number="item.unitPrice"
                      type="number"
                      min="0"
                      step="0.01"
                      class="w-full"
                    />
                  </UFormField>
                  <UFormField label="Total">
                    <div
                      class="flex items-center h-9 px-3 rounded-xl bg-zinc-50 dark:bg-zinc-800 text-sm font-bold text-zinc-700 dark:text-zinc-300 ring-1 ring-zinc-200 dark:ring-zinc-700"
                    >
                      {{
                        formatCurrency(
                          Math.round(item.quantity * item.unitPrice * 100)
                        )
                      }}
                    </div>
                  </UFormField>
                </div>

                <!-- Concrete specifics -->
                <div
                  v-if="item.unit === 'm3'"
                  class="grid grid-cols-3 gap-3 pt-1 border-t border-dashed border-zinc-100 dark:border-zinc-700"
                >
                  <UFormField label="FCK (MPa)">
                    <UInput
                      v-model.number="item.fck"
                      type="number"
                      placeholder="25"
                      class="w-full"
                    />
                  </UFormField>
                  <UFormField label="Slump (cm)">
                    <UInput
                      v-model.number="item.slump"
                      type="number"
                      placeholder="10"
                      class="w-full"
                    />
                  </UFormField>
                  <UFormField label="Brita">
                    <UInput
                      v-model="item.stoneSize"
                      placeholder="brita 1"
                      class="w-full"
                    />
                  </UFormField>
                </div>
              </div>
            </div>
          </div>

          <USeparator />

          <!-- ── Section: Detalhes da Venda ── -->
          <div class="space-y-4">
            <h4
              class="text-xs font-black uppercase tracking-widest text-zinc-400 flex items-center gap-2"
            >
              <UIcon
                name="i-heroicons-clipboard-document-list"
                class="w-4 h-4"
              />
              Detalhes da Venda
            </h4>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <UFormField label="Status">
                <USelect
                  v-model="form.status"
                  :items="STATUS_OPTS.filter((s) => s.value !== 'all')"
                  value-key="value"
                  label-key="label"
                  class="w-full"
                />
              </UFormField>
              <UFormField label="Forma de Pagamento">
                <USelect
                  v-model="form.paymentMethod"
                  :items="paymentMethodOptions"
                  value-key="value"
                  label-key="label"
                  class="w-full"
                />
              </UFormField>
              <UFormField label="Data da Venda">
                <UInput
                  v-model="form.date"
                  type="date"
                  class="w-full"
                />
              </UFormField>
              <UFormField label="Data de Entrega">
                <UInput
                  v-model="form.deliveryDate"
                  type="date"
                  class="w-full"
                />
              </UFormField>
              <UFormField label="Desconto (R$)">
                <UInput
                  v-model.number="form.discount"
                  type="number"
                  min="0"
                  step="0.01"
                  class="w-full"
                />
              </UFormField>
              <UFormField label="Total Final">
                <div
                  class="flex items-center h-9 px-3 rounded-xl bg-primary-50 dark:bg-primary-500/10 text-sm font-black text-primary-600 dark:text-primary-400 ring-1 ring-primary-200 dark:ring-primary-500/20"
                >
                  {{ formatCurrency(Math.round(totalBRL * 100)) }}
                </div>
              </UFormField>
            </div>

            <UFormField label="Observações">
              <UTextarea
                v-model="form.notes"
                placeholder="Condições de entrega, observações gerais..."
                :rows="3"
                class="w-full"
              />
            </UFormField>
          </div>
        </div>
      </template>

      <!-- Footer -->
      <template #footer>
        <div class="border-t border-zinc-200 dark:border-zinc-800">
          <!-- Totals summary -->
          <div class="flex items-center justify-between px-6 pt-4 pb-3">
            <span
              class="text-xs font-black uppercase tracking-widest text-zinc-400"
            >Subtotal</span>
            <div class="text-right">
              <span class="text-sm font-bold text-zinc-700 dark:text-zinc-300">
                {{ formatCurrency(Math.round(subtotalBRL * 100)) }}
              </span>
              <span
                v-if="form.discount > 0"
                class="ml-3 text-sm font-bold text-red-500"
              >
                &minus;{{ formatCurrency(Math.round(form.discount * 100)) }}
              </span>
            </div>
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
                {{ isEditing ? "Salvar Alterações" : "Registrar Venda" }}
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
      title="Excluir Venda"
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
                Tem certeza que deseja excluir a venda
                <strong class="text-zinc-700 dark:text-zinc-300">
                  #{{ String(deleteTarget?.id ?? 0).padStart(4, "0") }}
                </strong>
                de
                <strong class="text-zinc-700 dark:text-zinc-300">{{
                  deleteTarget?.customerName
                }}</strong>? Esta ação não pode ser desfeita.
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

    <!-- ══════════════════════════════════════════
         MODAL — Bill (Faturar)
    ══════════════════════════════════════════ -->
    <UModal
      v-model:open="billingDialog"
      title="Faturar Venda"
    >
      <template #body>
        <div class="p-6 space-y-4">
          <div class="flex items-start gap-4">
            <div
              class="w-12 h-12 rounded-full bg-green-50 dark:bg-green-500/10 flex items-center justify-center shrink-0"
            >
              <UIcon
                name="i-heroicons-banknotes"
                class="w-6 h-6 text-green-500"
              />
            </div>
            <div>
              <p class="font-bold text-zinc-900 dark:text-white">
                Faturamento da Venda
              </p>
              <p class="text-sm text-zinc-500 mt-1">
                Esta ação criará uma transação de receita no valor de
                <strong class="text-zinc-700 dark:text-zinc-300">
                  {{ formatCurrency(billingSale?.total || 0) }} </strong>.
              </p>
            </div>
          </div>

          <div class="grid grid-cols-1 gap-4 py-2">
            <UFormField label="Forma de pagamento">
              <USelectMenu
                v-model="billingForm.paymentMethod"
                :items="paymentMethodOptions"
                value-key="value"
                label-key="label"
                placeholder="Selecione..."
                class="w-full"
              />
            </UFormField>

            <UFormField label="Status da transação">
              <USelect
                v-model="billingForm.status"
                :items="[
                  { label: 'Recebido (Pago)', value: 'paid' },
                  { label: 'Pendente', value: 'pending' }
                ]"
                value-key="value"
                label-key="label"
                class="w-full"
              />
            </UFormField>
          </div>

          <div class="flex items-center justify-end gap-3 pt-2">
            <UButton
              color="neutral"
              variant="ghost"
              @click="billingDialog = false"
            >
              Cancelar
            </UButton>
            <UButton
              color="success"
              icon="i-heroicons-check"
              @click="handleBill"
            >
              Confirmar faturamento
            </UButton>
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>
