<script setup lang="ts">
definePageMeta({ layout: 'default' })
useSeoMeta({ title: 'Empresas | Meu Concreto' })

const { user } = useAuth()
const toast = useToast()

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
interface Company {
  id: number
  name: string
  document: string // CNPJ — stored without mask
  email?: string | null
  phone?: string | null
  address?: string | null
  city?: string | null
  state?: string | null
  zip?: string | null
  active: boolean
  createdAt: string | number
  updatedAt: string | number
}

// ─────────────────────────────────────────────
// Data
// ─────────────────────────────────────────────
const {
  data: companiesData,
  refresh: refreshCompanies,
  pending: loadingCompanies
} = await useFetch('/api/companies')

const companies = computed<Company[]>(
  () => (companiesData.value as { companies?: Company[] })?.companies ?? []
)

// ─────────────────────────────────────────────
// Summary stats
// ─────────────────────────────────────────────
const stats = computed(() => {
  const all = companies.value
  const now = new Date()
  const thisMonth = all.filter((c) => {
    const d = new Date(c.createdAt as string | number)
    return (
      d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
    )
  })
  return {
    total: all.length,
    active: all.filter(c => c.active).length,
    inactive: all.filter(c => !c.active).length,
    thisMonth: thisMonth.length
  }
})

// ─────────────────────────────────────────────
// Filter & Search
// ─────────────────────────────────────────────
const search = ref('')
const activeFilter = ref<'all' | 'active' | 'inactive'>('all')

const filteredCompanies = computed(() => {
  return companies.value.filter((c) => {
    const matchActive
      = activeFilter.value === 'all'
        || (activeFilter.value === 'active' && c.active)
        || (activeFilter.value === 'inactive' && !c.active)
    const q = search.value.toLowerCase()
    const matchSearch
      = !q
        || c.name.toLowerCase().includes(q)
        || c.document.includes(q.replace(/\D/g, ''))
        || (c.city ?? '').toLowerCase().includes(q)
        || (c.email ?? '').toLowerCase().includes(q)
    return matchActive && matchSearch
  })
})

// ─────────────────────────────────────────────
// Pagination
// ─────────────────────────────────────────────
const page = ref(1)
const pageSize = ref(10)

const paginatedCompanies = computed(() => {
  const start = (page.value - 1) * pageSize.value
  return filteredCompanies.value.slice(start, start + pageSize.value)
})

const totalPages = computed(() =>
  Math.ceil(filteredCompanies.value.length / pageSize.value)
)

watch([search, activeFilter], () => {
  page.value = 1
})

// ─────────────────────────────────────────────
// Formatters
// ─────────────────────────────────────────────
const formatCnpj = (v: string) => {
  const d = v.replace(/\D/g, '').slice(0, 14)
  return d
    .replace(/(\d{2})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1/$2')
    .replace(/(\d{4})(\d{1,2})$/, '$1-$2')
}

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

const formatDate = (v: string | number | null | undefined) => {
  if (!v) return '—'
  return new Intl.DateTimeFormat('pt-BR').format(new Date(v as string | number))
}

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
  document: '', // CNPJ — only used on create
  email: '',
  phone: '',
  address: '',
  city: '',
  state: undefined as string | undefined,
  zip: '',
  active: true
})

// Input masks via watch (must be after form declaration)
watch(
  () => form.document,
  (val) => {
    const masked = formatCnpj(val)
    if (masked !== val) form.document = masked
  }
)

watch(
  () => form.phone,
  (val) => {
    const masked = formatPhone(val)
    if (masked !== val) form.phone = masked
  }
)

// ─────────────────────────────────────────────
// ViaCEP integration
// ─────────────────────────────────────────────
const cepLoading = ref(false)
const cepStatus = ref<'idle' | 'success' | 'error'>('idle')
const cepMessage = ref('')

interface ViaCepResponse { erro?: boolean, logradouro?: string, localidade?: string, uf?: string }

const lookupCep = async (digits: string) => {
  cepLoading.value = true
  cepStatus.value = 'idle'
  cepMessage.value = ''
  try {
    const data = await $fetch<ViaCepResponse>(`https://viacep.com.br/ws/${digits}/json/`)
    if (data.erro) {
      cepStatus.value = 'error'
      cepMessage.value = 'CEP não encontrado.'
      return
    }
    // Fill address fields — overwrite with API data
    if (data.logradouro) form.address = data.logradouro
    form.city = data.localidade ?? form.city
    form.state = data.uf ?? form.state
    cepStatus.value = 'success'
    cepMessage.value = `${data.localidade} / ${data.uf}`
  } catch {
    cepStatus.value = 'error'
    cepMessage.value = 'Erro ao consultar CEP. Verifique sua conexão.'
  } finally {
    cepLoading.value = false
  }
}

watch(
  () => form.zip,
  (val) => {
    const masked = formatZip(val)
    if (masked !== val) form.zip = masked
    // Trigger lookup when CEP is complete (8 digits)
    const digits = val.replace(/\D/g, '')
    if (digits.length === 8) {
      lookupCep(digits)
    } else {
      cepStatus.value = 'idle'
      cepMessage.value = ''
    }
  }
)

// ─────────────────────────────────────────────
// Members (edit mode only)
// ─────────────────────────────────────────────
interface CompanyMemberEntry {
  id: number
  name: string
  email: string
  role: string
  active: boolean
}

const membersList = ref<CompanyMemberEntry[]>([])
const membersLoading = ref(false)
const addUserSearch = ref('')
const selectedUserToAdd = ref<{ id: number, name: string } | null>(null)
const addUserRole = ref<'admin' | 'manager' | 'user'>('user')
const addingUser = ref(false)
const removingUserId = ref<number | null>(null)

const { data: allUsersData } = await useFetch<{ users: CompanyMemberEntry[] }>('/api/users')
const allUsersList = computed(() => allUsersData.value?.users ?? [])

const filteredUsersForAdd = computed(() => {
  const q = addUserSearch.value.toLowerCase()
  const already = new Set(membersList.value.map(m => m.id))
  return allUsersList.value
    .filter(u => !already.has(u.id) && (!q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)))
    .slice(0, 8)
})

const MEMBER_ROLE_OPTS = [
  { value: 'admin', label: 'Administrador' },
  { value: 'manager', label: 'Gerente' },
  { value: 'user', label: 'Usuário' }
]

function memberRoleColor(role: string) {
  if (role === 'admin') return 'error'
  if (role === 'manager') return 'warning'
  return 'neutral'
}

function memberRoleLabel(role: string) {
  return MEMBER_ROLE_OPTS.find(r => r.value === role)?.label ?? role
}

async function loadMembers(companyId: number) {
  membersLoading.value = true
  try {
    const data = await $fetch<{ users: CompanyMemberEntry[] }>(`/api/users?companyId=${companyId}`)
    membersList.value = data.users ?? []
  } catch {
    membersList.value = []
  } finally {
    membersLoading.value = false
  }
}

async function addUserToCompany() {
  if (!selectedUserToAdd.value || !editingId.value) return
  addingUser.value = true
  try {
    await $fetch('/api/user-companies', {
      method: 'POST',
      body: { userId: selectedUserToAdd.value.id, companyId: editingId.value, role: addUserRole.value }
    })
    toast.add({ title: 'Usuário vinculado', description: `${selectedUserToAdd.value.name} adicionado à empresa.`, color: 'success' })
    selectedUserToAdd.value = null
    addUserSearch.value = ''
    addUserRole.value = 'user'
    await loadMembers(editingId.value)
  } catch (e: unknown) {
    const err = e as { data?: { message?: string } }
    toast.add({ title: 'Erro', description: err.data?.message ?? 'Não foi possível vincular o usuário.', color: 'error' })
  } finally {
    addingUser.value = false
  }
}

async function removeUserFromCompany(member: CompanyMemberEntry) {
  if (!editingId.value) return
  removingUserId.value = member.id
  try {
    await $fetch(`/api/user-companies/by?userId=${member.id}&companyId=${editingId.value}`, { method: 'DELETE' })
    toast.add({ title: 'Usuário removido', description: `${member.name} desvinculado da empresa.`, color: 'warning' })
    await loadMembers(editingId.value)
  } catch {
    toast.add({ title: 'Erro', description: 'Não foi possível remover o usuário.', color: 'error' })
  } finally {
    removingUserId.value = null
  }
}

const resetForm = () => {
  editingId.value = null
  isEditing.value = false
  form.name = ''
  form.document = ''
  form.email = ''
  form.phone = ''
  form.address = ''
  form.city = ''
  form.state = undefined
  form.zip = ''
  form.active = true
  cepStatus.value = 'idle'
  cepMessage.value = ''
  // Reset members
  membersList.value = []
  selectedUserToAdd.value = null
  addUserSearch.value = ''
  addUserRole.value = 'user'
}

const openCreate = () => {
  resetForm()
  isDrawerOpen.value = true
}

const openEdit = (c: Company) => {
  resetForm()
  isEditing.value = true
  editingId.value = c.id
  form.name = c.name
  form.document = formatCnpj(c.document) // display formatted
  form.email = c.email ?? ''
  form.phone = c.phone ? formatPhone(c.phone) : ''
  form.address = c.address ?? ''
  form.city = c.city ?? ''
  form.state = c.state ?? undefined
  form.zip = c.zip ? formatZip(c.zip) : ''
  form.active = c.active
  isDrawerOpen.value = true
  loadMembers(c.id)
}

// ─────────────────────────────────────────────
// Save
// ─────────────────────────────────────────────
const handleSave = async () => {
  if (form.name.trim().length < 3) {
    toast.add({ title: 'Campos inválidos', description: 'O nome deve ter pelo menos 3 caracteres.', color: 'warning', icon: 'i-heroicons-exclamation-triangle' })
    return
  }
  if (!isEditing.value && form.document.replace(/\D/g, '').length < 14) {
    toast.add({ title: 'Campos inválidos', description: 'CNPJ inválido — informe todos os 14 dígitos.', color: 'warning', icon: 'i-heroicons-exclamation-triangle' })
    return
  }
  if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
    toast.add({ title: 'Campos inválidos', description: 'E-mail inválido.', color: 'warning', icon: 'i-heroicons-exclamation-triangle' })
    return
  }
  if (form.state && form.state.length !== 2) {
    toast.add({ title: 'Campos inválidos', description: 'Estado deve ter exatamente 2 letras (ex: SP).', color: 'warning', icon: 'i-heroicons-exclamation-triangle' })
    return
  }

  loadingSave.value = true
  try {
    if (isEditing.value && editingId.value) {
      // companyUpdateSchema omits document
      const payload = {
        name: form.name.trim(),
        email: form.email.trim() || undefined,
        phone: form.phone.trim() || undefined,
        address: form.address.trim() || undefined,
        city: form.city.trim() || undefined,
        state: form.state?.trim() || undefined,
        zip: form.zip.trim() || undefined,
        active: form.active
      }
      await $fetch(`/api/companies/${editingId.value}`, {
        method: 'PUT',
        body: payload
      })
      toast.add({
        title: 'Empresa atualizada',
        description: `"${form.name}" foi atualizada com sucesso.`,
        color: 'success',
        icon: 'i-heroicons-check-circle'
      })
    } else {
      const payload = {
        name: form.name.trim(),
        document: form.document.trim(),
        email: form.email.trim() || undefined,
        phone: form.phone.trim() || undefined,
        address: form.address.trim() || undefined,
        city: form.city.trim() || undefined,
        state: form.state?.trim() || undefined,
        zip: form.zip.trim() || undefined,
        active: form.active
      }
      await $fetch('/api/companies', { method: 'POST', body: payload })
      toast.add({
        title: 'Empresa cadastrada',
        description: `"${form.name}" foi adicionada ao sistema.`,
        color: 'success',
        icon: 'i-heroicons-check-circle'
      })
    }

    isDrawerOpen.value = false
    await refreshCompanies()
  } catch (e: unknown) {
    const err = e as { statusCode?: number, data?: { statusMessage?: string }, message?: string }
    const errMsg = err?.statusCode === 409
      ? 'CNPJ já cadastrado. Verifique os dados.'
      : err?.data?.statusMessage ?? err?.message ?? 'Erro ao salvar empresa.'
    toast.add({
      title: 'Erro ao salvar',
      description: errMsg,
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
const toggleActive = async (c: Company) => {
  try {
    await $fetch(`/api/companies/${c.id}`, {
      method: 'PUT',
      body: { active: !c.active }
    })
    toast.add({
      title: c.active ? 'Empresa desativada' : 'Empresa ativada',
      description: `"${c.name}" foi ${c.active ? 'desativada' : 'ativada'}.`,
      color: c.active ? 'neutral' : 'success',
      icon: c.active ? 'i-heroicons-eye-slash' : 'i-heroicons-check-circle'
    })
    await refreshCompanies()
  } catch (e: unknown) {
    const err = e as { data?: { statusMessage?: string } }
    toast.add({
      title: 'Erro',
      description: err?.data?.statusMessage ?? 'Tente novamente.',
      color: 'error',
      icon: 'i-heroicons-exclamation-circle'
    })
  }
}

// ─────────────────────────────────────────────
// Delete
// ─────────────────────────────────────────────
const deleteTarget = ref<Company | null>(null)
const loadingDelete = ref(false)
const isDeleteModalOpen = ref(false)
const deleteError = ref('')

const confirmDelete = (c: Company) => {
  deleteTarget.value = c
  deleteError.value = ''
  isDeleteModalOpen.value = true
}

const handleDelete = async () => {
  if (!deleteTarget.value) return
  loadingDelete.value = true
  deleteError.value = ''
  const name = deleteTarget.value.name
  try {
    await $fetch(`/api/companies/${deleteTarget.value.id}`, {
      method: 'DELETE'
    })
    isDeleteModalOpen.value = false
    toast.add({
      title: 'Empresa excluída',
      description: `"${name}" foi removida do sistema.`,
      color: 'neutral',
      icon: 'i-heroicons-trash'
    })
    await refreshCompanies()
  } catch (e: unknown) {
    const err = e as { statusCode?: number, data?: { statusMessage?: string }, message?: string }
    if (err?.statusCode === 409) {
      deleteError.value = 'Não é possível excluir: esta empresa possui usuários vinculados. Remova os usuários primeiro.'
    } else {
      deleteError.value = err?.data?.statusMessage ?? err?.message ?? 'Erro ao excluir.'
    }
  } finally {
    loadingDelete.value = false
  }
}

// ─────────────────────────────────────────────
// Row actions
// ─────────────────────────────────────────────
const rowActions = (c: Company) => {
  const isAdmin = user.value?.role === 'admin'

  return [
    [
      {
        label: 'Editar Empresa',
        icon: 'i-heroicons-pencil-square',
        onSelect: () => openEdit(c)
      },
      {
        label: c.active ? 'Desativar' : 'Ativar',
        icon: c.active ? 'i-heroicons-eye-slash' : 'i-heroicons-eye',
        onSelect: () => toggleActive(c)
      }
    ],
    ...(isAdmin
      ? [
          [
            {
              label: 'Excluir',
              icon: 'i-heroicons-trash',
              color: 'error' as const,
              onSelect: () => confirmDelete(c)
            }
          ]
        ]
      : [])
  ]
}

const ACTIVE_OPTS = [
  { label: 'Todas', value: 'all' },
  { label: 'Ativas', value: 'active' },
  { label: 'Inativas', value: 'inactive' }
]
</script>

<template>
  <div class="p-6 lg:p-8 space-y-6">
    <!-- ── Page Header ── -->
    <div class="flex items-start justify-between gap-4">
      <div>
        <h1 class="text-2xl font-black text-zinc-900 dark:text-white">
          Empresas
        </h1>
        <p class="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
          Gerencie as empresas e clientes cadastrados no sistema
        </p>
      </div>
      <UButton
        v-if="user?.role === 'admin'"
        color="primary"
        icon="i-heroicons-plus"
        size="md"
        class="shrink-0"
        @click="openCreate"
      >
        Nova Empresa
      </UButton>
    </div>

    <!-- ── KPI Strip ── -->
    <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
      <div
        v-for="(kpi, i) in [
          {
            label: 'Total de Empresas',
            value: stats.total,
            suffix: 'cadastradas',
            icon: 'i-heroicons-building-office-2',
            color: 'text-primary-500',
            bg: 'bg-primary-50 dark:bg-primary-500/10'
          },
          {
            label: 'Empresas Ativas',
            value: stats.active,
            suffix: 'em operação',
            icon: 'i-heroicons-check-circle',
            color: 'text-green-500',
            bg: 'bg-green-50 dark:bg-green-500/10'
          },
          {
            label: 'Empresas Inativas',
            value: stats.inactive,
            suffix: 'desativadas',
            icon: 'i-heroicons-eye-slash',
            color: 'text-zinc-400',
            bg: 'bg-zinc-100 dark:bg-zinc-800'
          },
          {
            label: 'Cadastradas no Mês',
            value: stats.thisMonth,
            suffix: 'este mês',
            icon: 'i-heroicons-calendar-days',
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
            Lista de Empresas
          </h3>
          <div class="flex items-center gap-2 flex-wrap justify-end">
            <UInput
              v-model="search"
              icon="i-heroicons-magnifying-glass"
              placeholder="Buscar nome, CNPJ, cidade..."
              size="sm"
              class="w-52 lg:w-64"
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
        v-if="loadingCompanies"
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
        v-else-if="filteredCompanies.length === 0"
        class="flex flex-col items-center justify-center py-16 text-zinc-400"
      >
        <UIcon
          name="i-heroicons-building-office-2"
          class="w-12 h-12 mb-3"
        />
        <p class="text-sm font-bold">
          Nenhuma empresa encontrada
        </p>
        <p class="text-xs mt-1">
          Ajuste os filtros ou cadastre uma nova empresa
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
                class="text-left px-4 py-3 text-xs font-black uppercase tracking-widest text-zinc-400"
              >
                Empresa
              </th>
              <th
                class="text-left px-4 py-3 text-xs font-black uppercase tracking-widest text-zinc-400 hidden md:table-cell"
              >
                CNPJ
              </th>
              <th
                class="text-left px-4 py-3 text-xs font-black uppercase tracking-widest text-zinc-400 hidden lg:table-cell"
              >
                Localização
              </th>
              <th
                class="text-left px-4 py-3 text-xs font-black uppercase tracking-widest text-zinc-400 hidden xl:table-cell"
              >
                Contato
              </th>
              <th
                class="text-left px-4 py-3 text-xs font-black uppercase tracking-widest text-zinc-400 hidden sm:table-cell"
              >
                Cadastro
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
              v-for="c in paginatedCompanies"
              :key="c.id"
              class="border-b border-zinc-100 dark:border-zinc-800/60 hover:bg-primary-50/50 dark:hover:bg-primary-500/5 transition-colors group relative"
              :class="{ 'opacity-60': !c.active }"
            >
              <!-- Name + initials avatar -->
              <td class="px-4 py-3.5">
                <div class="flex items-center gap-3">
                  <div
                    class="w-9 h-9 rounded-xl bg-primary-100 dark:bg-primary-500/10 flex items-center justify-center shrink-0"
                  >
                    <span
                      class="text-sm font-black text-primary-600 dark:text-primary-400"
                    >
                      {{ c.name.charAt(0).toUpperCase() }}
                    </span>
                  </div>
                  <div class="min-w-0">
                    <p
                      class="font-bold text-zinc-900 dark:text-white truncate max-w-36 sm:max-w-52"
                    >
                      {{ c.name }}
                    </p>
                    <p
                      v-if="c.email"
                      class="text-xs text-zinc-400 truncate max-w-36 sm:max-w-52"
                    >
                      {{ c.email }}
                    </p>
                  </div>
                </div>
              </td>

              <!-- CNPJ -->
              <td
                class="px-4 py-3.5 text-xs text-zinc-500 font-mono whitespace-nowrap hidden md:table-cell"
              >
                {{ formatCnpj(c.document) }}
              </td>

              <!-- Location -->
              <td class="px-4 py-3.5 hidden lg:table-cell">
                <div
                  v-if="c.city || c.state"
                  class="flex items-center gap-1.5"
                >
                  <UIcon
                    name="i-heroicons-map-pin"
                    class="w-3.5 h-3.5 text-zinc-400 shrink-0"
                  />
                  <span class="text-sm text-zinc-600 dark:text-zinc-300">
                    {{ [c.city, c.state].filter(Boolean).join(" / ") }}
                  </span>
                </div>
                <span
                  v-else
                  class="text-xs text-zinc-300 dark:text-zinc-700"
                >—</span>
              </td>

              <!-- Contact -->
              <td class="px-4 py-3.5 hidden xl:table-cell">
                <div
                  v-if="c.phone"
                  class="flex items-center gap-1.5 text-sm text-zinc-600 dark:text-zinc-300"
                >
                  <UIcon
                    name="i-heroicons-phone"
                    class="w-3.5 h-3.5 text-zinc-400 shrink-0"
                  />
                  {{ formatPhone(c.phone) }}
                </div>
                <span
                  v-else
                  class="text-xs text-zinc-300 dark:text-zinc-700"
                >—</span>
              </td>

              <!-- Created at -->
              <td
                class="px-4 py-3.5 text-xs text-zinc-400 whitespace-nowrap hidden sm:table-cell"
              >
                {{ formatDate(c.createdAt) }}
              </td>

              <!-- Status -->
              <td class="px-4 py-3.5">
                <button
                  class="group/toggle"
                  @click="toggleActive(c)"
                >
                  <UBadge
                    :color="c.active ? 'success' : 'neutral'"
                    variant="soft"
                    size="sm"
                    :icon="
                      c.active
                        ? 'i-heroicons-check-circle'
                        : 'i-heroicons-eye-slash'
                    "
                    class="cursor-pointer transition-opacity group-hover/toggle:opacity-70"
                  >
                    {{ c.active ? "Ativa" : "Inativa" }}
                  </UBadge>
                </button>
              </td>

              <!-- Actions -->
              <td class="px-4 py-3.5 text-right">
                <UDropdownMenu :items="rowActions(c)">
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
        v-if="filteredCompanies.length > pageSize"
        #footer
      >
        <div
          class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between pt-1"
        >
          <p class="text-xs text-zinc-400">
            {{ filteredCompanies.length }} empresas · página {{ page }} de
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
      :title="isEditing ? 'Editar Empresa' : 'Nova Empresa'"
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
                name="i-heroicons-building-office-2"
                class="w-4 h-4"
              />
              Identificação
            </h4>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <!-- Nome -->
              <UFormField
                label="Razão Social / Nome *"
                class="col-span-full"
              >
                <UInput
                  v-model="form.name"
                  placeholder="ex: Construtora Exemplo Ltda"
                  icon="i-heroicons-building-office-2"
                  class="w-full"
                />
              </UFormField>

              <!-- CNPJ — only editable on create -->
              <UFormField
                label="CNPJ *"
                class="col-span-full"
              >
                <UInput
                  v-model="form.document"
                  placeholder="00.000.000/0000-00"
                  icon="i-heroicons-identification"
                  :disabled="isEditing"
                  :class="[
                    'w-full',
                    isEditing ? 'opacity-50 cursor-not-allowed' : ''
                  ]"
                />
                <template
                  v-if="isEditing"
                  #hint
                >
                  <span class="text-xs text-zinc-400">
                    O CNPJ não pode ser alterado após o cadastro.
                  </span>
                </template>
              </UFormField>

              <!-- E-mail -->
              <UFormField label="E-mail">
                <UInput
                  v-model="form.email"
                  type="email"
                  placeholder="contato@empresa.com.br"
                  icon="i-heroicons-envelope"
                  class="w-full"
                />
              </UFormField>

              <!-- Telefone -->
              <UFormField label="Telefone">
                <UInput
                  v-model="form.phone"
                  placeholder="(00) 00000-0000"
                  icon="i-heroicons-phone"
                  class="w-full"
                />
              </UFormField>
            </div>
          </div>

          <USeparator />

          <!-- ── Section: Endereço ── -->
          <div class="space-y-4">
            <h4
              class="text-xs font-black uppercase tracking-widest text-zinc-400 flex items-center gap-2"
            >
              <UIcon
                name="i-heroicons-map-pin"
                class="w-4 h-4"
              />
              Endereço
            </h4>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <!-- Logradouro -->
              <UFormField
                label="Logradouro"
                class="col-span-full"
              >
                <UInput
                  v-model="form.address"
                  placeholder="Rua, Av., número, complemento"
                  icon="i-heroicons-map-pin"
                  class="w-full"
                />
              </UFormField>

              <!-- Cidade -->
              <UFormField label="Cidade">
                <UInput
                  v-model="form.city"
                  placeholder="São Paulo"
                  class="w-full"
                />
              </UFormField>

              <!-- Estado -->
              <UFormField label="Estado (UF)">
                <USelect
                  v-model="form.state"
                  :items="BR_STATES"
                  value-key="value"
                  label-key="label"
                  placeholder="Selecione..."
                  class="w-full"
                />
              </UFormField>

              <!-- CEP -->
              <UFormField
                label="CEP"
                :hint="cepStatus === 'success' ? cepMessage : undefined"
              >
                <template
                  v-if="cepStatus === 'success'"
                  #hint
                >
                  <span
                    class="flex items-center gap-1 text-xs text-green-600 dark:text-green-400 font-medium"
                  >
                    <UIcon
                      name="i-heroicons-check-circle"
                      class="w-3.5 h-3.5"
                    />
                    {{ cepMessage }}
                  </span>
                </template>
                <UInput
                  v-model="form.zip"
                  placeholder="00000-000"
                  icon="i-heroicons-map-pin"
                  :loading="cepLoading"
                  :trailing-icon="
                    !cepLoading && cepStatus === 'success'
                      ? 'i-heroicons-check-circle'
                      : !cepLoading && cepStatus === 'error'
                        ? 'i-heroicons-exclamation-circle'
                        : undefined
                  "
                  :ui="{
                    trailingIcon:
                      cepStatus === 'success'
                        ? 'text-green-500'
                        : cepStatus === 'error'
                          ? 'text-red-500'
                          : ''
                  }"
                  class="w-full"
                />
                <p
                  v-if="cepStatus === 'error'"
                  class="mt-1 text-xs text-red-500 flex items-center gap-1"
                >
                  <UIcon
                    name="i-heroicons-exclamation-circle"
                    class="w-3.5 h-3.5 shrink-0"
                  />
                  {{ cepMessage }}
                </p>
              </UFormField>
            </div>
          </div>

          <USeparator />

          <!-- ── Section: Membros (edit mode only) ── -->
          <template v-if="isEditing">
            <div>
              <div class="flex items-center justify-between mb-4">
                <h4 class="text-xs font-black uppercase tracking-widest text-zinc-400 flex items-center gap-2">
                  <UIcon
                    name="i-heroicons-users"
                    class="w-4 h-4"
                  />
                  Membros com Acesso
                </h4>
                <USkeleton
                  v-if="membersLoading"
                  class="h-4 w-16 rounded"
                />
                <span
                  v-else
                  class="text-xs font-bold text-zinc-400"
                >
                  {{ membersList.length }} usuário{{ membersList.length !== 1 ? 's' : '' }}
                </span>
              </div>

              <!-- Skeleton -->
              <div
                v-if="membersLoading"
                class="space-y-2"
              >
                <USkeleton
                  v-for="i in 2"
                  :key="i"
                  class="h-12 rounded-xl"
                />
              </div>

              <!-- Empty state -->
              <div
                v-else-if="membersList.length === 0"
                class="flex flex-col items-center justify-center py-6 text-zinc-400 rounded-xl ring-1 ring-zinc-200 dark:ring-zinc-800 bg-zinc-50 dark:bg-zinc-900/50"
              >
                <UIcon
                  name="i-heroicons-users"
                  class="w-8 h-8 mb-2"
                />
                <p class="text-xs font-bold">
                  Nenhum usuário vinculado
                </p>
              </div>

              <!-- Members list -->
              <div
                v-else
                class="space-y-2 mb-4"
              >
                <div
                  v-for="member in membersList"
                  :key="member.id"
                  class="flex items-center gap-3 px-3 py-2.5 rounded-xl ring-1 ring-zinc-200 dark:ring-zinc-800 bg-white dark:bg-zinc-900 group/entry"
                >
                  <div class="w-8 h-8 rounded-lg bg-primary-50 dark:bg-primary-500/10 flex items-center justify-center shrink-0">
                    <span class="text-sm font-black text-primary-600 dark:text-primary-400">
                      {{ member.name.charAt(0).toUpperCase() }}
                    </span>
                  </div>
                  <div class="flex-1 min-w-0">
                    <span class="text-sm font-bold text-zinc-900 dark:text-white truncate block">
                      {{ member.name }}
                    </span>
                    <UBadge
                      :color="memberRoleColor(member.role)"
                      variant="soft"
                      size="xs"
                    >
                      {{ memberRoleLabel(member.role) }}
                    </UBadge>
                  </div>
                  <UButton
                    color="error"
                    variant="ghost"
                    icon="i-heroicons-x-mark"
                    size="xs"
                    :loading="removingUserId === member.id"
                    class="opacity-0 group-hover/entry:opacity-100 transition-opacity shrink-0"
                    @click="removeUserFromCompany(member)"
                  />
                </div>
              </div>

              <!-- Add user row -->
              <div class="rounded-xl ring-1 ring-zinc-200 dark:ring-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 p-3 space-y-3">
                <p class="text-xs font-bold text-zinc-500">
                  Vincular novo usuário
                </p>
                <UInput
                  v-model="addUserSearch"
                  placeholder="Buscar por nome ou e-mail..."
                  icon="i-heroicons-magnifying-glass"
                  size="sm"
                  class="w-full"
                />
                <div
                  v-if="filteredUsersForAdd.length > 0"
                  class="space-y-1"
                >
                  <button
                    v-for="u in filteredUsersForAdd"
                    :key="u.id"
                    type="button"
                    :class="[
                      'w-full flex items-center gap-2 px-2 py-2 rounded-lg text-left transition-colors',
                      selectedUserToAdd?.id === u.id
                        ? 'bg-primary-50 dark:bg-primary-500/10 ring-1 ring-primary-300'
                        : 'hover:bg-white dark:hover:bg-zinc-800'
                    ]"
                    @click="selectedUserToAdd = selectedUserToAdd?.id === u.id ? null : { id: u.id, name: u.name }"
                  >
                    <div class="w-6 h-6 rounded-md bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center shrink-0">
                      <span class="text-xs font-black text-zinc-600 dark:text-zinc-300">{{ u.name.charAt(0).toUpperCase() }}</span>
                    </div>
                    <div class="flex-1 min-w-0">
                      <p class="text-xs font-bold text-zinc-800 dark:text-zinc-200 truncate">
                        {{ u.name }}
                      </p>
                      <p class="text-[10px] text-zinc-400 truncate">
                        {{ u.email }}
                      </p>
                    </div>
                    <UIcon
                      v-if="selectedUserToAdd?.id === u.id"
                      name="i-heroicons-check"
                      class="w-4 h-4 text-primary-500 shrink-0"
                    />
                  </button>
                </div>
                <div
                  v-else-if="addUserSearch"
                  class="text-xs text-zinc-400 text-center py-2"
                >
                  Nenhum usuário encontrado
                </div>

                <div
                  v-if="selectedUserToAdd"
                  class="flex items-center gap-2 pt-1"
                >
                  <USelect
                    v-model="addUserRole"
                    :items="MEMBER_ROLE_OPTS"
                    value-key="value"
                    label-key="label"
                    size="sm"
                    class="flex-1"
                  />
                  <UButton
                    color="primary"
                    size="sm"
                    icon="i-heroicons-plus"
                    :loading="addingUser"
                    @click="addUserToCompany"
                  >
                    Adicionar
                  </UButton>
                </div>
              </div>
            </div>

            <USeparator />
          </template>

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
                  Empresa Ativa
                </p>
                <p class="text-xs text-zinc-400 mt-0.5">
                  Empresas inativas não aparecem nas sugestões de clientes em
                  orçamentos e vendas
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
              {{ isEditing ? "Salvar Alterações" : "Cadastrar Empresa" }}
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
      title="Excluir Empresa"
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
            <div class="flex-1 min-w-0">
              <p class="font-bold text-zinc-900 dark:text-white">
                Confirmar exclusão
              </p>
              <p class="text-sm text-zinc-500 mt-1">
                Tem certeza que deseja excluir a empresa
                <strong class="text-zinc-700 dark:text-zinc-300">
                  "{{ deleteTarget?.name }}"
                </strong>
                ? Esta ação não pode ser desfeita e todos os dados associados
                serão perdidos.
              </p>

              <!-- Conflict error shown inline in modal -->
              <UAlert
                v-if="deleteError"
                class="mt-3"
                color="error"
                variant="soft"
                icon="i-heroicons-exclamation-triangle"
                :description="deleteError"
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
