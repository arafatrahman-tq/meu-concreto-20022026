<script setup lang="ts">
definePageMeta({ layout: 'default' })
useSeoMeta({ title: 'Orçamentos | Meu Concreto' })

const { user, companyId } = useAuth()
const toast = useToast()
const route = useRoute()

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
type QuoteStatus = 'draft' | 'sent' | 'approved' | 'rejected' | 'expired'

interface QuoteItem {
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

interface Quote {
  id: number
  customerName: string
  customerDocument?: string | null
  customerPhone?: string | null
  customerAddress?: string | null
  status: QuoteStatus
  date: string | number
  validUntil?: string | number | null
  subtotal: number
  discount: number
  total: number
  notes?: string | null
  companyId: number
  userId?: number | null
  sellerId?: number | null
  items: QuoteItem[]
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
  id?: string // unique key for UI selection
  label: string // display name
  name: string
  document: string
  phone: string
  address: string // registered address (full)
  suffix?: string // shown as secondary line
  source: 'company' | 'quote'
}

// ─────────────────────────────────────────────
// Data
// ─────────────────────────────────────────────

const {
  data: quotesData,
  refresh: refreshQuotes,
  pending: loadingQuotes
} = await useFetch('/api/quotes', {
  query: { companyId }
})
const { data: productsData } = await useFetch('/api/products', {
  query: { companyId }
})
const { data: companiesData } = await useFetch('/api/companies', {
  query: { companyId }
})
const { data: sellersData } = await useFetch('/api/sellers', {
  query: { companyId, active: 'true' }
})

const quotes = computed<Quote[]>(() => (quotesData.value as any)?.quotes ?? [])
const products = computed<Product[]>(
  () => (productsData.value as any)?.products ?? []
)
const companiesList = computed<Company[]>(
  () => (companiesData.value as any)?.companies ?? []
)
const sellersList = computed<Seller[]>(
  () => (sellersData.value as any)?.sellers ?? []
)

const sellerOptions = computed(() => [
  { label: 'Nenhum selecionado', value: undefined },
  ...sellersList.value.map(s => ({ label: s.name, value: s.id }))
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

// Deduplicated known customers from companies + past quotes
const knownCustomers = computed<KnownCustomer[]>(() => {
  const map = new Map<string, KnownCustomer>()

  // 1. Companies first (source of truth)
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

  // 2. Past quotes customers (skip if already registered as company)
  for (const q of quotes.value) {
    const key = q.customerDocument || q.customerName
    if (!map.has(key)) {
      map.set(key, {
        id: `quote-${q.id}`,
        label: q.customerName,
        name: q.customerName,
        document: q.customerDocument ?? '',
        phone: q.customerPhone ?? '',
        address: q.customerAddress ?? '',
        suffix: q.customerDocument
          ? `CPF/CNPJ ${q.customerDocument}`
          : 'Cliente anterior',
        source: 'quote'
      })
    }
  }

  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name))
})

// Customer combobox search term
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

// Address state
const customerRegisteredAddress = ref('')
const useDeliveryAddress = ref(false)

const onCustomerSelect = (customer: KnownCustomer | undefined | string) => {
  if (!customer) return

  // If user typed a new name instead of selecting an object
  if (typeof customer === 'string') {
    form.customerName = customer
    customerSearchTerm.value = customer
    return
  }

  // If selecting a known customer object
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
  if (!val) {
    form.customerAddress = customerRegisteredAddress.value
  }
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
  return new Intl.DateTimeFormat('pt-BR').format(new Date(v as any))
}

// ─────────────────────────────────────────────
// Filter & Search
// ─────────────────────────────────────────────
const search = ref('')
const statusFilter = ref<QuoteStatus | 'all'>('all')

const STATUS_OPTS = [
  { label: 'Todos', value: 'all' },
  { label: 'Rascunho', value: 'draft' },
  { label: 'Enviado', value: 'sent' },
  { label: 'Aprovado', value: 'approved' },
  { label: 'Rejeitado', value: 'rejected' },
  { label: 'Expirado', value: 'expired' }
]

const filteredQuotes = computed(() => {
  return quotes.value
    .filter((q) => {
      const matchState
        = statusFilter.value === 'all' || q.status === statusFilter.value
      const matchSearch
        = !search.value
          || q.customerName.toLowerCase().includes(search.value.toLowerCase())
          || String(q.id).includes(search.value)
          || (q.customerDocument ?? '').includes(search.value)
      return matchState && matchSearch
    })
    .sort(
      (a, b) =>
        new Date(b.createdAt as any).getTime()
          - new Date(a.createdAt as any).getTime()
    )
})

// ─────────────────────────────────────────────
// Pagination
// ─────────────────────────────────────────────
const page = ref(1)
const pageSize = ref(10)

const paginatedQuotes = computed(() => {
  const start = (page.value - 1) * pageSize.value
  return filteredQuotes.value.slice(start, start + pageSize.value)
})

const totalPages = computed(() =>
  Math.ceil(filteredQuotes.value.length / pageSize.value)
)

watch([search, statusFilter], () => {
  page.value = 1
})

// ─────────────────────────────────────────────
// Status helpers
// ─────────────────────────────────────────────
const statusConfig: Record<
  QuoteStatus,
  { label: string, color: string, icon: string }
> = {
  draft: {
    label: 'Rascunho',
    color: 'neutral',
    icon: 'i-heroicons-pencil-square'
  },
  sent: { label: 'Enviado', color: 'info', icon: 'i-heroicons-paper-airplane' },
  approved: {
    label: 'Aprovado',
    color: 'success',
    icon: 'i-heroicons-check-circle'
  },
  rejected: {
    label: 'Rejeitado',
    color: 'error',
    icon: 'i-heroicons-x-circle'
  },
  expired: { label: 'Expirado', color: 'warning', icon: 'i-heroicons-clock' }
}

// ─────────────────────────────────────────────
// Summary stats
// ─────────────────────────────────────────────
const stats = computed(() => {
  const all = quotes.value
  return {
    total: all.length,
    approved: all.filter(q => q.status === 'approved').length,
    pending: all.filter(q => q.status === 'sent' || q.status === 'draft')
      .length,
    totalValue: all
      .filter(q => q.status === 'approved')
      .reduce((s, q) => s + q.total, 0)
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

const form = reactive({
  customerName: '',
  customerDocument: '',
  customerPhone: '',
  customerAddress: '',
  sellerId: undefined as number | undefined,
  status: 'draft' as QuoteStatus,
  validUntil: '',
  discount: 0, // in BRL (float)
  notes: '',
  items: [makeNewItem()] as FormItem[]
})

// Mask watches — must be after `form` is declared to avoid temporal dead zone
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
  isEditing.value = false
  form.customerName = ''
  form.customerDocument = ''
  form.customerPhone = ''
  form.customerAddress = ''
  form.sellerId = undefined
  form.status = 'draft'
  form.validUntil = ''
  form.discount = 0
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

const openEdit = (q: any) => {
  resetForm()
  isEditing.value = true
  editingId.value = q.id

  // Set all form fields directly — no watch involved, safe and predictable
  form.customerName = q.customerName
  form.customerDocument = q.customerDocument ?? ''
  form.customerPhone = q.customerPhone ?? ''
  form.customerAddress = q.customerAddress ?? ''
  form.sellerId = q.sellerId || undefined

  // Set the combobox display — matches by `name` via by="name" prop
  // Setting this does NOT trigger onCustomerSelect (handled by @update:model-value, not watch)
  selectedCustomer.value = {
    id: `quote-${q.id}`,
    label: q.customerName,
    name: q.customerName,
    document: q.customerDocument ?? '',
    phone: q.customerPhone ?? '',
    address: q.customerAddress ?? '',
    source: 'quote'
  }
  // Set the search term so the UInputMenu input displays the customer name
  customerSearchTerm.value = q.customerName ?? ''

  // Try to find registered address from companies
  const matchedCompany = companiesList.value.find(
    c => c.document === q.customerDocument || c.name === q.customerName
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
      = !!q.customerAddress && q.customerAddress !== fullAddr
  } else {
    customerRegisteredAddress.value = q.customerAddress ?? ''
    useDeliveryAddress.value = false
  }
  form.status = q.status
  form.validUntil = q.validUntil
    ? new Date(q.validUntil as any).toISOString().slice(0, 10)
    : ''
  form.discount = q.discount / 100
  form.notes = q.notes ?? ''
  form.items = (q.items ?? []).map((it: QuoteItem) => ({
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
      customerName: form.customerName,
      customerDocument: form.customerDocument || undefined,
      customerPhone: form.customerPhone || undefined,
      customerAddress: form.customerAddress || undefined,
      sellerId: form.sellerId || undefined,
      status: form.status,
      validUntil: form.validUntil
        ? new Date(form.validUntil).toISOString()
        : undefined,
      discount: Math.round(form.discount * 100),
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
      await $fetch(`/api/quotes/${editingId.value}`, {
        method: 'PUT',
        body: payload
      })
      toast.add({
        title: 'Orçamento atualizado',
        description: 'As alterações foram salvas com sucesso.',
        color: 'success',
        icon: 'i-heroicons-check-circle'
      })
    } else {
      await $fetch('/api/quotes', { method: 'POST', body: payload })
      toast.add({
        title: 'Orçamento criado',
        description: `Orçamento para ${form.customerName} criado com sucesso.`,
        color: 'success',
        icon: 'i-heroicons-check-circle'
      })
    }

    isDrawerOpen.value = false
    await refreshQuotes()
  } catch (e: any) {
    toast.add({
      title: 'Erro ao salvar',
      description:
        e?.data?.statusMessage ?? e?.message ?? 'Erro ao salvar orçamento.',
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
const deleteTarget = ref<Quote | null>(null)
const loadingDelete = ref(false)
const isDeleteModalOpen = ref(false)

const confirmDelete = (q: Quote) => {
  deleteTarget.value = q
  isDeleteModalOpen.value = true
}

const handleDelete = async () => {
  if (!deleteTarget.value) return
  loadingDelete.value = true
  const name = deleteTarget.value.customerName
  try {
    await $fetch(`/api/quotes/${deleteTarget.value.id}`, { method: 'DELETE' })
    isDeleteModalOpen.value = false
    toast.add({
      title: 'Orçamento excluído',
      description: `Orçamento de ${name} foi excluído.`,
      color: 'neutral',
      icon: 'i-heroicons-trash'
    })
    await refreshQuotes()
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
// Quick status update
// ─────────────────────────────────────────────
const updateStatus = async (q: Quote, status: QuoteStatus) => {
  try {
    await $fetch(`/api/quotes/${q.id}`, { method: 'PUT', body: { status } })
    toast.add({
      title: 'Status atualizado',
      description: `Orçamento #${String(q.id).padStart(4, '0')} agora é ${statusConfig[status].label}.`,
      color: 'success',
      icon: statusConfig[status].icon
    })
    await refreshQuotes()
  } catch (e) {
    console.error(e)
  }
}

const STATUS_ACTIONS: Record<
  QuoteStatus,
  { next: QuoteStatus, label: string }[]
> = {
  draft: [{ next: 'sent', label: 'Marcar como Enviado' }],
  sent: [
    { next: 'approved', label: 'Aprovar' },
    { next: 'rejected', label: 'Rejeitar' }
  ],
  approved: [],
  rejected: [{ next: 'draft', label: 'Reabrir como Rascunho' }],
  expired: [{ next: 'draft', label: 'Reabrir como Rascunho' }]
}

// ─────────────────────────────────────────────
// Duplicate quote
// ─────────────────────────────────────────────
const duplicateQuote = async (q: Quote) => {
  try {
    await $fetch('/api/quotes', {
      method: 'POST',
      body: {
        companyId: companyId.value,
        userId: user.value?.id ?? undefined,
        customerName: q.customerName,
        customerDocument: q.customerDocument ?? undefined,
        customerPhone: q.customerPhone ?? undefined,
        customerAddress: q.customerAddress ?? undefined,
        status: 'draft',
        discount: q.discount,
        notes: q.notes ?? undefined,
        items: (q.items ?? []).map(it => ({
          productId: it.productId ?? undefined,
          productName: it.productName,
          description: it.description ?? undefined,
          unit: it.unit ?? undefined,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
          fck: it.fck ?? undefined,
          slump: it.slump ?? undefined,
          stoneSize: it.stoneSize ?? undefined
        }))
      }
    })
    await refreshQuotes()
    toast.add({
      title: 'Orçamento duplicado',
      description: `Rascunho criado a partir do orçamento de ${q.customerName}.`,
      color: 'success',
      icon: 'i-heroicons-document-duplicate'
    })
  } catch (e) {
    console.error(e)
  }
}

// ─────────────────────────────────────────────
// Send Manual PDF via WhatsApp
// ─────────────────────────────────────────────
const isSendingPdf = ref<number | null>(null)
const sendManualPdf = async (q: Quote) => {
  if (isSendingPdf.value) return

  if (!q.customerPhone) {
    toast.add({
      title: 'Telefone ausente',
      description:
        'O cliente não possui um telefone de WhatsApp cadastrado neste orçamento.',
      color: 'warning',
      icon: 'i-heroicons-exclamation-circle'
    })
    return
  }

  isSendingPdf.value = q.id

  try {
    await $fetch(`/api/quotes/${q.id}/send-pdf`, { method: 'POST' })
    toast.add({
      title: 'PDF Enviado!',
      description: `Orçamento #${String(q.id).padStart(4, '0')} enviado com sucesso via WhatsApp.`,
      color: 'success',
      icon: 'i-heroicons-paper-airplane'
    })
  } catch (e: any) {
    console.error(e)
    toast.add({
      title: 'Erro ao enviar',
      description:
        e.data?.statusMessage || 'Verifique as configurações do WhatsApp.',
      color: 'error',
      icon: 'i-heroicons-exclamation-triangle'
    })
  } finally {
    isSendingPdf.value = null
  }
}

// Row action menu items (context-aware per quote)
const rowActions = (q: Quote) => {
  // Only fully approved quotes can be converted to a sale
  const canConvert = q.status === 'approved'
  // Approved quotes are immutable — specs/prices are locked once agreed
  const isApproved = q.status === 'approved'
  return [
    [
      {
        label: isApproved ? 'Ver Orçamento' : 'Editar Orçamento',
        icon: isApproved ? 'i-heroicons-eye' : 'i-heroicons-pencil-square',
        disabled: isApproved,
        onSelect: () => {
          if (!isApproved) openEdit(q)
        }
      },
      {
        label: 'Enviar via WhatsApp',
        icon: 'i-heroicons-paper-airplane',
        disabled: isSendingPdf.value !== null,
        onSelect: () => sendManualPdf(q)
      },
      {
        label: 'Duplicar como Rascunho',
        icon: 'i-heroicons-document-duplicate',
        onSelect: () => duplicateQuote(q)
      },
      ...STATUS_ACTIONS[q.status].map(a => ({
        label: a.label,
        icon: statusConfig[a.next].icon,
        onSelect: () => updateStatus(q, a.next)
      }))
    ],
    ...(canConvert
      ? [
          [
            {
              label: 'Converter em Venda',
              icon: 'i-heroicons-shopping-cart',
              onSelect: () => navigateTo(`/vendas?quoteId=${q.id}`)
            }
          ]
        ]
      : []),
    [
      {
        label: 'Excluir',
        icon: 'i-heroicons-trash',
        color: 'error' as const,
        disabled: isApproved,
        onSelect: () => {
          if (!isApproved) confirmDelete(q)
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
          Orçamentos
        </h1>
        <p class="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
          Gerencie suas propostas e acompanhe o funil de conversão
        </p>
      </div>
      <UButton
        color="primary"
        icon="i-heroicons-plus"
        size="md"
        class="shrink-0"
        @click="openCreate"
      >
        Novo Orçamento
      </UButton>
    </div>

    <!-- ── KPI Strip ── -->
    <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
      <div
        v-for="(kpi, i) in [
          {
            label: 'Total de Orçamentos',
            value: stats.total,
            suffix: 'orçamentos',
            icon: 'i-heroicons-document-text',
            color: 'text-primary-500',
            bg: 'bg-primary-50 dark:bg-primary-500/10'
          },
          {
            label: 'Aprovados',
            value: stats.approved,
            suffix: 'aprovados',
            icon: 'i-heroicons-check-circle',
            color: 'text-green-500',
            bg: 'bg-green-50 dark:bg-green-500/10'
          },
          {
            label: 'Aguardando Resposta',
            value: stats.pending,
            suffix: 'pendentes',
            icon: 'i-heroicons-clock',
            color: 'text-amber-500',
            bg: 'bg-amber-50 dark:bg-amber-500/10'
          },
          {
            label: 'Valor Total Aprovado',
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
        <!-- Label + ícone -->
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
        <!-- Valor -->
        <p
          class="text-3xl font-black text-zinc-900 dark:text-white tabular-nums"
        >
          {{ kpi.value }}
        </p>
        <!-- Subtexto -->
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
      <!-- Toolbar -->
      <template #header>
        <div class="flex items-center justify-between gap-4">
          <h3
            class="text-sm font-black uppercase tracking-widest text-zinc-400 shrink-0"
          >
            Lista de Orçamentos
          </h3>
          <div class="flex items-center gap-2 flex-wrap justify-end">
            <!-- Search -->
            <UInput
              v-model="search"
              icon="i-heroicons-magnifying-glass"
              placeholder="Buscar cliente, nº..."
              size="sm"
              class="w-44 lg:w-56"
            />
            <!-- Status filter -->
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
        v-if="loadingQuotes"
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
        v-else-if="filteredQuotes.length === 0"
        class="flex flex-col items-center justify-center py-16 text-zinc-400"
      >
        <UIcon
          name="i-heroicons-document-text"
          class="w-12 h-12 mb-3"
        />
        <p class="text-sm font-bold">
          Nenhum orçamento encontrado
        </p>
        <p class="text-xs mt-1">
          Ajuste a busca ou crie um novo orçamento
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
                Validade
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
              v-for="q in paginatedQuotes"
              :key="q.id"
              class="border-b border-zinc-100 dark:border-zinc-800/60 hover:bg-primary-50/50 dark:hover:bg-primary-500/5 transition-colors group relative"
            >
              <!-- ID -->
              <td
                class="px-4 py-3.5 font-black text-zinc-400 text-xs whitespace-nowrap"
              >
                #{{ String(q.id).padStart(4, "0") }}
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
                      {{ q.customerName.charAt(0).toUpperCase() }}
                    </span>
                  </div>
                  <div class="min-w-0">
                    <p
                      class="font-bold text-zinc-900 dark:text-white truncate max-w-35 sm:max-w-50"
                    >
                      {{ q.customerName }}
                    </p>
                    <p
                      v-if="q.customerPhone"
                      class="text-xs text-zinc-400 truncate"
                    >
                      {{ q.customerPhone }}
                    </p>
                  </div>
                </div>
              </td>
              <!-- Date -->
              <td
                class="px-4 py-3.5 text-zinc-500 text-xs whitespace-nowrap hidden md:table-cell"
              >
                {{ formatDate(q.createdAt) }}
              </td>
              <!-- Valid until -->
              <td class="px-4 py-3.5 hidden lg:table-cell">
                <span
                  v-if="q.validUntil"
                  class="text-xs text-zinc-500"
                  :class="{
                    'text-red-500 font-bold':
                      new Date(q.validUntil as any) < new Date()
                      && q.status !== 'approved'
                  }"
                >
                  {{ formatDate(q.validUntil) }}
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
                    STATUS_ACTIONS[q.status].length
                      ? [
                        STATUS_ACTIONS[q.status].map((a) => ({
                          label: a.label,
                          onSelect: () => updateStatus(q, a.next)
                        }))
                      ]
                      : undefined
                  "
                  :disabled="STATUS_ACTIONS[q.status].length === 0"
                >
                  <UBadge
                    :color="statusConfig[q.status].color as any"
                    variant="soft"
                    size="sm"
                    :icon="statusConfig[q.status].icon"
                    :class="
                      STATUS_ACTIONS[q.status].length
                        ? 'cursor-pointer'
                        : 'cursor-default'
                    "
                  >
                    {{ statusConfig[q.status].label }}
                  </UBadge>
                </UDropdownMenu>
              </td>
              <!-- Total -->
              <td
                class="px-4 py-3.5 text-right font-black text-zinc-900 dark:text-white whitespace-nowrap"
              >
                {{ formatCurrency(q.total) }}
              </td>
              <!-- Actions -->
              <td class="px-4 py-3.5 text-right">
                <UDropdownMenu :items="rowActions(q)">
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
          v-if="filteredQuotes.length > pageSize"
          class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between pt-1"
        >
          <p class="text-xs text-zinc-400">
            {{ filteredQuotes.length }} orçamentos · página {{ page }} de
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
      :title="isEditing ? 'Editar Orçamento' : 'Novo Orçamento'"
      side="right"
      :ui="{ content: 'w-full', footer: 'p-0 block' }"
    >
      <template #body>
        <div class="flex flex-col gap-6 p-6 overflow-y-auto h-full pb-24">
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
                  :filter-on-blur="false"
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
                <!-- Registered address preview (when a known customer is selected) -->
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

                <!-- Delivery address input -->
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
                Itens do Orçamento
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

                <!-- Product name + description (editable) -->
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

          <!-- ── Section: Detalhes ── -->
          <div class="space-y-4">
            <h4
              class="text-xs font-black uppercase tracking-widest text-zinc-400 flex items-center gap-2"
            >
              <UIcon
                name="i-heroicons-clipboard-document-list"
                class="w-4 h-4"
              />
              Detalhes do Orçamento
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
              <UFormField label="Válido até">
                <UInput
                  v-model="form.validUntil"
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
                placeholder="Condições de pagamento, prazo de entrega, observações gerais..."
                :rows="3"
                class="w-full"
              />
            </UFormField>
          </div>
        </div>
      </template>

      <!-- Footer with save actions -->
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
                {{ isEditing ? "Salvar Alterações" : "Criar Orçamento" }}
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
      title="Excluir Orçamento"
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
                Tem certeza que deseja excluir o orçamento
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
  </div>
</template>
