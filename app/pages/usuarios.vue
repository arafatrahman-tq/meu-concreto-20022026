<script setup lang="ts">
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

definePageMeta({ layout: 'default' })
useSeoMeta({ title: 'Usuários | Meu Concreto' })

// ─── Auth ────────────────────────────────────────────────────────────────────
const { user: authUser, companyId } = useAuth()
const toast = useToast()

// ─── Fetch ───────────────────────────────────────────────────────────────────
const {
  data: usersData,
  pending,
  refresh
} = await useFetch('/api/users', { query: { companyId } })

const usersList = computed(() => usersData.value?.users ?? [])

// All companies for the add-company combobox
const { data: allCompaniesData } = await useFetch('/api/companies')
const allCompaniesList = computed(
  () => (allCompaniesData.value as any)?.companies ?? []
)

// ─── KPIs ────────────────────────────────────────────────────────────────────
const totalUsers = computed(() => usersList.value.length)
const activeUsers = computed(
  () => usersList.value.filter(u => u.active).length
)
const adminUsers = computed(
  () => usersList.value.filter(u => u.role === 'admin').length
)
const managerUsers = computed(
  () => usersList.value.filter(u => u.role === 'manager').length
)

// ─── Filter / search ─────────────────────────────────────────────────────────
const search = ref('')
const roleFilter = ref<'all' | 'admin' | 'manager' | 'user'>('all')

const filteredUsers = computed(() => {
  let list = usersList.value
  if (roleFilter.value !== 'all')
    list = list.filter(u => u.role === roleFilter.value)
  const q = search.value.toLowerCase().trim()
  if (!q) return list
  return list.filter(
    u =>
      u.name.toLowerCase().includes(q)
      || u.email.toLowerCase().includes(q)
      || (u.document ?? '').includes(q)
  )
})

// ─── Role helpers ─────────────────────────────────────────────────────────────
const ROLE_OPTS = [
  { value: 'admin', label: 'Administrador' },
  { value: 'manager', label: 'Gerente' },
  { value: 'user', label: 'Usuário' }
]

function roleColor(role: string) {
  if (role === 'admin') return 'error'
  if (role === 'manager') return 'warning'
  return 'neutral'
}

function roleLabel(role: string) {
  return ROLE_OPTS.find(r => r.value === role)?.label ?? role
}

// ─── Format helpers ───────────────────────────────────────────────────────────
function formatDate(d: Date | string | number) {
  return format(new Date(d), 'dd MMM yyyy', { locale: ptBR })
}

function formatCPF(raw: string) {
  const d = raw.replace(/\D/g, '')
  if (d.length === 11)
    return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
  return raw
}

function formatPhone(raw: string) {
  const d = raw.replace(/\D/g, '')
  if (d.length === 11)
    return d.replace(/(\d{2})(\d{1})(\d{4})(\d{4})/, '($1) $2.$3-$4')
  if (d.length === 10) return d.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3')
  return raw
}

function userInitials(name: string) {
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) {
    const first = parts[0]?.[0] ?? ''
    const last = parts[parts.length - 1]?.[0] ?? ''
    return (first + last).toUpperCase()
  }
  return name.slice(0, 2).toUpperCase()
}

// ─── Drawer state ─────────────────────────────────────────────────────────────
const drawerOpen = ref(false)
const editMode = ref(false)
const editingId = ref<number | null>(null)
const saving = ref(false)

// ─── User-companies (multi-tenant) ───────────────────────────────────────────
interface UserCompanyEntry {
  id: number
  companyId: number
  companyName: string
  role: string
  active: boolean
}

const userCompanyList = ref<UserCompanyEntry[]>([])
const companiesLoading = ref(false)
const addCompanySearch = ref('')
const selectedCompanyToAdd = ref<{ id: number, name: string } | null>(null)
const addCompanyRole = ref<'admin' | 'manager' | 'user'>('user')
const addingCompany = ref(false)
const removingCompanyId = ref<number | null>(null)

const filteredCompaniesForAdd = computed(() => {
  const q = addCompanySearch.value.toLowerCase()
  const already = new Set(userCompanyList.value.map(uc => uc.companyId))
  return allCompaniesList.value
    .filter(
      (c: any) =>
        !already.has(c.id) && (!q || c.name.toLowerCase().includes(q))
    )
    .slice(0, 8)
})

async function loadUserCompanies(userId: number) {
  companiesLoading.value = true
  try {
    const data = await $fetch<{ userCompanies: UserCompanyEntry[] }>(
      `/api/user-companies?userId=${userId}`
    )
    userCompanyList.value = data.userCompanies
  } catch {
    userCompanyList.value = []
  } finally {
    companiesLoading.value = false
  }
}

async function addCompanyToUser() {
  if (!selectedCompanyToAdd.value || !editingId.value) return
  addingCompany.value = true
  try {
    await $fetch('/api/user-companies', {
      method: 'POST',
      body: {
        userId: editingId.value,
        companyId: selectedCompanyToAdd.value.id,
        role: addCompanyRole.value
      }
    })
    toast.add({
      title: 'Empresa vinculada',
      description: `${selectedCompanyToAdd.value.name} adicionada ao usuário.`,
      color: 'success'
    })
    selectedCompanyToAdd.value = null
    addCompanySearch.value = ''
    addCompanyRole.value = 'user'
    await loadUserCompanies(editingId.value)
  } catch (e: any) {
    toast.add({
      title: 'Erro',
      description: e.data?.message ?? 'Não foi possível vincular a empresa.',
      color: 'error'
    })
  } finally {
    addingCompany.value = false
  }
}

async function removeCompanyFromUser(entry: UserCompanyEntry) {
  if (!editingId.value) return
  removingCompanyId.value = entry.id
  try {
    await $fetch(`/api/user-companies/${entry.id}`, { method: 'DELETE' })
    toast.add({
      title: 'Empresa removida',
      description: `${entry.companyName} desvinculada do usuário.`,
      color: 'warning'
    })
    await loadUserCompanies(editingId.value)
  } catch {
    toast.add({
      title: 'Erro',
      description: 'Não foi possível remover a empresa.',
      color: 'error'
    })
  } finally {
    removingCompanyId.value = null
  }
}

// ─── Form ─────────────────────────────────────────────────────────────────────
const form = reactive({
  companyId: null as number | null,
  name: '',
  email: '',
  document: '',
  phone: '',
  role: 'user' as 'admin' | 'manager' | 'user',
  active: true,
  password: ''
})

// Masks — declared AFTER form to avoid TDZ
watch(
  () => form.document,
  (val) => {
    if (!val) return
    const digits = val.replace(/\D/g, '').slice(0, 11)
    let masked = digits
    if (digits.length > 9)
      masked = digits.replace(/(\d{3})(\d{3})(\d{3})(\d{0,2})/, '$1.$2.$3-$4')
    else if (digits.length > 6)
      masked = digits.replace(/(\d{3})(\d{3})(\d{0,3})/, '$1.$2.$3')
    else if (digits.length > 3)
      masked = digits.replace(/(\d{3})(\d{0,3})/, '$1.$2')
    if (masked !== val) form.document = masked
  }
)

watch(
  () => form.phone,
  (val) => {
    if (!val) return
    const digits = val.replace(/\D/g, '').slice(0, 11)
    let masked = digits
    if (digits.length > 7)
      masked = digits.replace(
        /(\d{2})(\d{1})(\d{0,4})(\d{0,4})/,
        (_, a, b, c, d) =>
          d ? `(${a}) ${b}.${c}-${d}` : c ? `(${a}) ${b}.${c}` : `(${a}) ${b}`
      )
    else if (digits.length > 2)
      masked = digits.replace(/(\d{2})(\d{0,})/, '($1) $2')
    if (masked !== val) form.phone = masked
  }
)

function resetForm() {
  form.companyId = companyId.value
  form.name = ''
  form.email = ''
  form.document = ''
  form.phone = ''
  form.role = 'user'
  form.active = true
  form.password = ''
  editMode.value = false
  editingId.value = null
  // Reset company section
  userCompanyList.value = []
  selectedCompanyToAdd.value = null
  addCompanySearch.value = ''
  addCompanyRole.value = 'user'
}

function openCreate() {
  resetForm()
  drawerOpen.value = true
}

function openEdit(u: (typeof usersList.value)[number]) {
  resetForm()
  editMode.value = true
  editingId.value = u.id
  form.name = u.name
  form.email = u.email
  form.document = u.document ? formatCPF(u.document) : ''
  form.phone = u.phone ? formatPhone(u.phone) : ''
  form.role = u.role as 'admin' | 'manager' | 'user'
  form.active = u.active
  drawerOpen.value = true
  // Load companies for this user
  loadUserCompanies(u.id)
}

// ─── Save ─────────────────────────────────────────────────────────────────────
async function handleSave() {
  if (form.name.trim().length < 3) {
    toast.add({ title: 'Campos inválidos', description: 'Nome deve ter pelo menos 3 caracteres.', color: 'warning', icon: 'i-heroicons-exclamation-triangle' })
    return
  }

  if (!editMode.value) {
    if (!form.email || !/\S+@\S+\.\S+/.test(form.email)) {
      toast.add({ title: 'Campos inválidos', description: 'Informe um e-mail válido.', color: 'warning', icon: 'i-heroicons-exclamation-triangle' })
      return
    }
    const cpfDigits = form.document.replace(/\D/g, '')
    if (cpfDigits.length < 11) {
      toast.add({ title: 'Campos inválidos', description: 'CPF deve ter 11 dígitos.', color: 'warning', icon: 'i-heroicons-exclamation-triangle' })
      return
    }
    if (form.password.length < 6) {
      toast.add({ title: 'Campos inválidos', description: 'Senha deve ter pelo menos 6 caracteres.', color: 'warning', icon: 'i-heroicons-exclamation-triangle' })
      return
    }
  }

  saving.value = true
  try {
    if (editMode.value && editingId.value) {
      await $fetch(`/api/users/${editingId.value}`, {
        method: 'PUT',
        body: {
          name: form.name.trim(),
          phone: form.phone,
          role: form.role,
          active: form.active
        }
      })
      toast.add({
        title: 'Usuário atualizado',
        description: `${form.name} foi atualizado com sucesso.`,
        color: 'success'
      })
    } else {
      await $fetch('/api/users', {
        method: 'POST',
        body: {
          companyId: form.companyId,
          name: form.name.trim(),
          email: form.email.trim(),
          document: form.document,
          phone: form.phone,
          role: form.role,
          active: form.active,
          password: form.password
        }
      })
      toast.add({
        title: 'Usuário criado',
        description: `${form.name} foi cadastrado com sucesso.`,
        color: 'success'
      })
    }
    drawerOpen.value = false
    resetForm()
    await refresh()
  } catch (e: any) {
    const errMsg = e.statusCode === 409
      ? 'E-mail ou CPF já cadastrado para outro usuário.'
      : e.data?.message ?? 'Erro ao salvar. Tente novamente.'
    toast.add({
      title: 'Erro ao salvar',
      description: errMsg,
      color: 'error'
    })
  } finally {
    saving.value = false
  }
}

// ─── Toggle active ─────────────────────────────────────────────────────────────
async function toggleActive(u: (typeof usersList.value)[number]) {
  if (u.id === authUser.value?.id) {
    toast.add({
      title: 'Ação não permitida',
      description: 'Você não pode desativar seu próprio usuário.',
      color: 'error'
    })
    return
  }
  try {
    await $fetch(`/api/users/${u.id}`, {
      method: 'PUT',
      body: { active: !u.active }
    })
    const label = u.active ? 'desativado' : 'ativado'
    toast.add({
      title: `Usuário ${label}`,
      description: `${u.name} foi ${label} com sucesso.`,
      color: u.active ? 'warning' : 'success'
    })
    await refresh()
  } catch {
    toast.add({
      title: 'Erro',
      description: 'Não foi possível alterar o status.',
      color: 'error'
    })
  }
}

// ─── Delete ───────────────────────────────────────────────────────────────────
const deleteModal = ref(false)
const deleting = ref(false)
const userToDelete = ref<(typeof usersList.value)[number] | null>(null)

function confirmDelete(u: (typeof usersList.value)[number]) {
  if (u.id === authUser.value?.id) {
    toast.add({
      title: 'Ação não permitida',
      description: 'Você não pode excluir seu próprio usuário.',
      color: 'error'
    })
    return
  }
  userToDelete.value = u
  deleteModal.value = true
}

async function handleDelete() {
  if (!userToDelete.value) return
  deleting.value = true
  try {
    await $fetch(`/api/users/${userToDelete.value.id}`, { method: 'DELETE' })
    toast.add({
      title: 'Usuário excluído',
      description: `${userToDelete.value.name} foi removido.`,
      color: 'success'
    })
    deleteModal.value = false
    userToDelete.value = null
    await refresh()
  } catch (e: any) {
    toast.add({
      title: 'Erro ao excluir',
      description: e.data?.message ?? 'Não foi possível excluir o usuário.',
      color: 'error'
    })
  } finally {
    deleting.value = false
  }
}

// ─── Dropdown actions ─────────────────────────────────────────────────────────
function rowActions(u: (typeof usersList.value)[number]) {
  const isAdmin = authUser.value?.role === 'admin'
  const isSelf = authUser.value?.id === u.id

  return [
    [
      {
        label: 'Editar',
        icon: 'i-heroicons-pencil-square',
        onSelect: () => openEdit(u)
      },
      {
        label: u.active ? 'Desativar' : 'Ativar',
        icon: u.active ? 'i-heroicons-eye-slash' : 'i-heroicons-eye',
        onSelect: () => toggleActive(u)
      }
    ],
    ...(isAdmin && !isSelf
      ? [
          [
            {
              label: 'Excluir',
              icon: 'i-heroicons-trash',
              color: 'error' as const,
              onSelect: () => confirmDelete(u)
            }
          ]
        ]
      : [])
  ]
}
</script>

<template>
  <div class="p-8 space-y-8">
    <!-- Page Header -->
    <div class="flex items-center justify-between flex-wrap gap-4">
      <div>
        <h1 class="text-2xl font-black text-zinc-900 dark:text-white">
          Usuários
        </h1>
        <p class="text-sm text-zinc-500 mt-1">
          Gerencie os usuários e permissões do sistema
        </p>
      </div>
      <UButton
        v-if="authUser?.role === 'admin'"
        color="primary"
        icon="i-heroicons-plus"
        @click="openCreate"
      >
        Novo Usuário
      </UButton>
    </div>

    <!-- KPIs -->
    <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
      <!-- Total -->
      <div
        class="rounded-2xl bg-white dark:bg-zinc-900 ring-1 ring-zinc-200 dark:ring-zinc-800 p-6 flex flex-col gap-4"
      >
        <div class="flex items-center justify-between">
          <span
            class="text-xs font-black uppercase tracking-widest text-zinc-400"
          >Total</span>
          <div
            class="w-9 h-9 rounded-xl bg-primary-50 dark:bg-primary-500/10 flex items-center justify-center"
          >
            <UIcon
              name="i-heroicons-users"
              class="w-5 h-5 text-primary-500"
            />
          </div>
        </div>
        <span class="text-3xl font-black text-zinc-900 dark:text-white">{{
          totalUsers
        }}</span>
        <div class="text-xs font-bold text-zinc-400">
          usuários cadastrados
        </div>
      </div>

      <!-- Ativos -->
      <div
        class="rounded-2xl bg-white dark:bg-zinc-900 ring-1 ring-zinc-200 dark:ring-zinc-800 p-6 flex flex-col gap-4"
      >
        <div class="flex items-center justify-between">
          <span
            class="text-xs font-black uppercase tracking-widest text-zinc-400"
          >Ativos</span>
          <div
            class="w-9 h-9 rounded-xl bg-green-50 dark:bg-green-500/10 flex items-center justify-center"
          >
            <UIcon
              name="i-heroicons-check-circle"
              class="w-5 h-5 text-green-500"
            />
          </div>
        </div>
        <span class="text-3xl font-black text-zinc-900 dark:text-white">{{
          activeUsers
        }}</span>
        <div class="text-xs font-bold text-zinc-400">
          com acesso ao sistema
        </div>
      </div>

      <!-- Admins -->
      <div
        class="rounded-2xl bg-white dark:bg-zinc-900 ring-1 ring-zinc-200 dark:ring-zinc-800 p-6 flex flex-col gap-4"
      >
        <div class="flex items-center justify-between">
          <span
            class="text-xs font-black uppercase tracking-widest text-zinc-400"
          >Admins</span>
          <div
            class="w-9 h-9 rounded-xl bg-red-50 dark:bg-red-500/10 flex items-center justify-center"
          >
            <UIcon
              name="i-heroicons-shield-check"
              class="w-5 h-5 text-red-500"
            />
          </div>
        </div>
        <span class="text-3xl font-black text-zinc-900 dark:text-white">{{
          adminUsers
        }}</span>
        <div class="text-xs font-bold text-zinc-400">
          administradores
        </div>
      </div>

      <!-- Gerentes -->
      <div
        class="rounded-2xl bg-white dark:bg-zinc-900 ring-1 ring-zinc-200 dark:ring-zinc-800 p-6 flex flex-col gap-4"
      >
        <div class="flex items-center justify-between">
          <span
            class="text-xs font-black uppercase tracking-widest text-zinc-400"
          >Gerentes</span>
          <div
            class="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-500/10 flex items-center justify-center"
          >
            <UIcon
              name="i-heroicons-briefcase"
              class="w-5 h-5 text-amber-500"
            />
          </div>
        </div>
        <span class="text-3xl font-black text-zinc-900 dark:text-white">{{
          managerUsers
        }}</span>
        <div class="text-xs font-bold text-zinc-400">
          com perfil gerente
        </div>
      </div>
    </div>

    <!-- Table Card -->
    <UCard>
      <template #header>
        <div class="flex items-center justify-between gap-4">
          <h3
            class="text-sm font-black uppercase tracking-widest text-zinc-400 shrink-0"
          >
            Usuários
          </h3>
          <div class="flex items-center gap-2 flex-wrap justify-end">
            <!-- Role filter -->
            <div
              class="flex items-center gap-1 rounded-xl ring-1 ring-zinc-200 dark:ring-zinc-700 p-0.5 bg-white dark:bg-zinc-900"
            >
              <button
                v-for="opt in [
                  { value: 'all', label: 'Todos' },
                  { value: 'admin', label: 'Admins' },
                  { value: 'manager', label: 'Gerentes' },
                  { value: 'user', label: 'Usuários' }
                ]"
                :key="opt.value"
                class="px-3 py-1 rounded-lg text-xs font-bold transition-all"
                :class="
                  roleFilter === opt.value
                    ? 'bg-primary-500 text-white shadow'
                    : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
                "
                @click="roleFilter = opt.value as typeof roleFilter"
              >
                {{ opt.label }}
              </button>
            </div>
            <UInput
              v-model="search"
              size="sm"
              placeholder="Buscar usuário..."
              icon="i-heroicons-magnifying-glass"
              class="w-44 lg:w-56"
            />
          </div>
        </div>
      </template>

      <!-- Loading -->
      <div
        v-if="pending"
        class="space-y-3 p-4"
      >
        <USkeleton
          v-for="i in 5"
          :key="i"
          class="h-14 rounded-xl"
        />
      </div>

      <!-- Empty -->
      <div
        v-else-if="filteredUsers.length === 0"
        class="flex flex-col items-center justify-center py-16 text-zinc-400"
      >
        <UIcon
          name="i-heroicons-users"
          class="w-12 h-12 mb-3"
        />
        <p class="text-sm font-bold">
          Nenhum usuário encontrado
        </p>
        <p class="text-xs mt-1">
          Tente ajustar o filtro ou cadastre um novo usuário
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
              <th
                class="text-left py-3 px-4 text-xs font-black uppercase tracking-widest text-zinc-400"
              >
                Usuário
              </th>
              <th
                class="text-left py-3 px-4 text-xs font-black uppercase tracking-widest text-zinc-400"
              >
                Perfil
              </th>
              <th
                class="text-left py-3 px-4 text-xs font-black uppercase tracking-widest text-zinc-400 hidden md:table-cell"
              >
                CPF
              </th>
              <th
                class="text-left py-3 px-4 text-xs font-black uppercase tracking-widest text-zinc-400 hidden lg:table-cell"
              >
                Telefone
              </th>
              <th
                class="text-left py-3 px-4 text-xs font-black uppercase tracking-widest text-zinc-400 hidden xl:table-cell"
              >
                Cadastro
              </th>
              <th
                class="text-left py-3 px-4 text-xs font-black uppercase tracking-widest text-zinc-400"
              >
                Status
              </th>
              <th class="py-3 px-4" />
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="u in filteredUsers"
              :key="u.id"
              class="border-b border-zinc-100 dark:border-zinc-800 hover:bg-primary-50/50 dark:hover:bg-primary-500/5 group transition-colors"
            >
              <!-- Avatar + name + email -->
              <td class="py-3 px-4">
                <div class="flex items-center gap-3">
                  <div
                    class="w-9 h-9 rounded-full flex items-center justify-center shrink-0 font-black text-xs text-white"
                    :class="
                      u.id === authUser?.id
                        ? 'bg-primary-500'
                        : 'bg-zinc-300 dark:bg-zinc-600'
                    "
                  >
                    {{ userInitials(u.name) }}
                  </div>
                  <div class="min-w-0">
                    <div class="flex items-center gap-1.5">
                      <span
                        class="font-bold text-zinc-900 dark:text-white truncate"
                      >{{ u.name }}</span>
                      <UBadge
                        v-if="u.id === authUser?.id"
                        color="primary"
                        variant="soft"
                        size="xs"
                      >
                        você
                      </UBadge>
                    </div>
                    <span class="text-xs text-zinc-400 truncate block">{{
                      u.email
                    }}</span>
                  </div>
                </div>
              </td>

              <!-- Role -->
              <td class="py-3 px-4">
                <UBadge
                  :color="roleColor(u.role)"
                  variant="soft"
                  size="sm"
                >
                  {{ roleLabel(u.role) }}
                </UBadge>
              </td>

              <!-- CPF -->
              <td
                class="py-3 px-4 hidden md:table-cell text-zinc-600 dark:text-zinc-400 font-mono text-xs"
              >
                {{ u.document ? formatCPF(u.document) : "—" }}
              </td>

              <!-- Phone -->
              <td
                class="py-3 px-4 hidden lg:table-cell text-zinc-600 dark:text-zinc-400 text-xs"
              >
                {{ u.phone ? formatPhone(u.phone) : "—" }}
              </td>

              <!-- Created -->
              <td class="py-3 px-4 hidden xl:table-cell text-zinc-400 text-xs">
                {{ formatDate(u.createdAt) }}
              </td>

              <!-- Status -->
              <td class="py-3 px-4">
                <button
                  class="cursor-pointer"
                  @click="toggleActive(u)"
                >
                  <UBadge
                    :color="u.active ? 'success' : 'neutral'"
                    variant="soft"
                    size="sm"
                    :ui="{
                      label:
                        'text-[10px] font-black uppercase tracking-[0.15em]'
                    }"
                  >
                    {{ u.active ? "Ativo" : "Inativo" }}
                  </UBadge>
                </button>
              </td>

              <!-- Actions -->
              <td class="py-3 px-4 text-right">
                <UDropdownMenu
                  :items="rowActions(u)"
                  :content="{ align: 'end' }"
                >
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
    </UCard>

    <!-- ─── Slideover Drawer ─────────────────────────────────────────────── -->
    <USlideover
      v-model:open="drawerOpen"
      :title="editMode ? 'Editar Usuário' : 'Novo Usuário'"
      :description="
        editMode
          ? 'Atualize as informações do usuário abaixo.'
          : 'Preencha os dados para cadastrar um novo usuário.'
      "
      :ui="{ content: 'w-full', footer: 'p-0 block' }"
      @update:open="
        (v) => {
          if (!v) resetForm();
        }
      "
    >
      <template #body>
        <div class="flex flex-col gap-6 p-6 overflow-y-auto h-full pb-24">
          <!-- Dados pessoais -->
          <div>
            <p
              class="text-xs font-black uppercase tracking-widest text-zinc-400 mb-4"
            >
              Dados Pessoais
            </p>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <UFormField
                label="Nome completo *"
                class="col-span-full"
              >
                <UInput
                  v-model="form.name"
                  placeholder="Ex: João da Silva"
                  class="w-full"
                />
              </UFormField>

              <!-- Email — create only -->
              <UFormField
                label="E-mail *"
                class="col-span-full"
              >
                <UInput
                  v-model="form.email"
                  type="email"
                  placeholder="joao@empresa.com.br"
                  class="w-full"
                  :disabled="editMode"
                />
                <template
                  v-if="editMode"
                  #hint
                >
                  <span class="text-xs text-zinc-400">E-mail não pode ser alterado após o cadastro</span>
                </template>
              </UFormField>

              <!-- CPF — create only -->
              <UFormField label="CPF *">
                <UInput
                  v-model="form.document"
                  placeholder="000.000.000-00"
                  class="w-full"
                  :disabled="editMode"
                  maxlength="14"
                />
                <template
                  v-if="editMode"
                  #hint
                >
                  <span class="text-xs text-zinc-400">CPF não pode ser alterado</span>
                </template>
              </UFormField>

              <UFormField label="Telefone">
                <UInput
                  v-model="form.phone"
                  placeholder="(00) 9.0000-0000"
                  class="w-full"
                  maxlength="16"
                />
              </UFormField>
            </div>
          </div>

          <USeparator />

          <!-- Acesso e permissões -->
          <div>
            <p
              class="text-xs font-black uppercase tracking-widest text-zinc-400 mb-4"
            >
              Acesso e Permissões
            </p>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <UFormField
                label="Perfil de acesso *"
                class="col-span-full"
              >
                <USelect
                  v-model="form.role"
                  :items="ROLE_OPTS"
                  value-key="value"
                  label-key="label"
                  class="w-full"
                />
              </UFormField>

              <!-- Password — create only -->
              <UFormField
                v-if="!editMode"
                label="Senha *"
                class="col-span-full"
              >
                <UInput
                  v-model="form.password"
                  type="password"
                  placeholder="Mínimo 6 caracteres"
                  class="w-full"
                />
              </UFormField>

              <UFormField
                label="Status"
                class="col-span-full"
              >
                <div class="flex items-center gap-3">
                  <USwitch
                    v-model="form.active"
                    color="primary"
                  />
                  <span
                    class="text-sm font-medium text-zinc-700 dark:text-zinc-300"
                  >
                    {{ form.active ? "Usuário ativo" : "Usuário inativo" }}
                  </span>
                </div>
              </UFormField>

              <!-- Principal Company Selector (Create Mode Only) -->
              <UFormField
                v-if="!editMode"
                label="Empresa Principal *"
                description="O usuário será vinculado a esta empresa inicialmente."
                class="col-span-full"
              >
                <UInputMenu
                  v-model="form.companyId"
                  :items="allCompaniesList"
                  value-key="id"
                  label-key="name"
                  placeholder="Selecionar Empresa..."
                  icon="i-heroicons-building-office-2"
                  class="w-full"
                  open-on-focus
                >
                  <template #item="{ item }">
                    <div class="flex items-center gap-2 py-0.5">
                      <UIcon
                        name="i-heroicons-building-office-2"
                        class="w-4 h-4 text-zinc-400"
                      />
                      <span class="text-sm font-medium">{{ item.name }}</span>
                    </div>
                  </template>
                </UInputMenu>
              </UFormField>
            </div>
          </div>

          <!-- ── Empresas vinculadas (edit mode only) ── -->
          <template v-if="editMode">
            <USeparator />

            <div>
              <div class="flex items-center justify-between mb-4">
                <p
                  class="text-xs font-black uppercase tracking-widest text-zinc-400"
                >
                  Empresas com Acesso
                </p>
                <USkeleton
                  v-if="companiesLoading"
                  class="h-4 w-16 rounded"
                />
                <span
                  v-else
                  class="text-xs font-bold text-zinc-400"
                >
                  {{ userCompanyList.length }} empresa{{
                    userCompanyList.length !== 1 ? "s" : ""
                  }}
                </span>
              </div>

              <!-- Current companies list -->
              <div
                v-if="companiesLoading"
                class="space-y-2"
              >
                <USkeleton
                  v-for="i in 2"
                  :key="i"
                  class="h-12 rounded-xl"
                />
              </div>

              <div
                v-else-if="userCompanyList.length === 0"
                class="flex flex-col items-center justify-center py-6 text-zinc-400 rounded-xl ring-1 ring-zinc-200 dark:ring-zinc-800 bg-zinc-50 dark:bg-zinc-900/50"
              >
                <UIcon
                  name="i-heroicons-building-office-2"
                  class="w-8 h-8 mb-2"
                />
                <p class="text-xs font-bold">
                  Nenhuma empresa vinculada
                </p>
              </div>

              <div
                v-else
                class="space-y-2 mb-4"
              >
                <div
                  v-for="entry in userCompanyList"
                  :key="entry.id"
                  class="flex items-center gap-3 px-3 py-2.5 rounded-xl ring-1 ring-zinc-200 dark:ring-zinc-800 bg-white dark:bg-zinc-900 group/entry"
                >
                  <div
                    class="w-8 h-8 rounded-lg bg-primary-50 dark:bg-primary-500/10 flex items-center justify-center shrink-0"
                  >
                    <UIcon
                      name="i-heroicons-building-office-2"
                      class="w-4 h-4 text-primary-500"
                    />
                  </div>
                  <div class="flex-1 min-w-0">
                    <span
                      class="text-sm font-bold text-zinc-900 dark:text-white truncate block"
                    >
                      {{ entry.companyName }}
                    </span>
                    <UBadge
                      :color="roleColor(entry.role)"
                      variant="soft"
                      size="xs"
                    >
                      {{ roleLabel(entry.role) }}
                    </UBadge>
                  </div>
                  <UButton
                    color="error"
                    variant="ghost"
                    icon="i-heroicons-x-mark"
                    size="xs"
                    :loading="removingCompanyId === entry.id"
                    class="opacity-0 group-hover/entry:opacity-100 transition-opacity shrink-0"
                    @click="removeCompanyFromUser(entry)"
                  />
                </div>
              </div>

              <!-- Add company row -->
              <div
                class="rounded-xl ring-1 ring-zinc-200 dark:ring-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 p-3 space-y-3"
              >
                <p class="text-xs font-bold text-zinc-500">
                  Vincular nova empresa
                </p>
                <div class="flex gap-2">
                  <UInputMenu
                    v-model="selectedCompanyToAdd"
                    v-model:search-term="addCompanySearch"
                    :items="filteredCompaniesForAdd"
                    label-key="name"
                    placeholder="Buscar Empresa..."
                    icon="i-heroicons-building-office-2"
                    class="flex-1"
                    open-on-focus
                  >
                    <template #item="{ item }">
                      <div class="flex items-center gap-2 py-0.5">
                        <UIcon
                          name="i-heroicons-building-office-2"
                          class="w-4 h-4 text-zinc-400"
                        />
                        <span class="text-sm font-medium">{{ item.name }}</span>
                      </div>
                    </template>
                  </UInputMenu>
                  <USelect
                    v-model="addCompanyRole"
                    :items="ROLE_OPTS"
                    value-key="value"
                    label-key="label"
                    class="w-36"
                  />
                </div>
                <UButton
                  color="primary"
                  variant="soft"
                  icon="i-heroicons-plus"
                  size="sm"
                  :loading="addingCompany"
                  :disabled="!selectedCompanyToAdd"
                  class="w-full justify-center"
                  @click="addCompanyToUser"
                >
                  Vincular empresa
                </UButton>
              </div>
            </div>
          </template>
        </div>
      </template>

      <!-- Footer -->
      <template #footer>
        <div class="flex items-center gap-3 p-6 border-t border-zinc-200 dark:border-zinc-800">
          <div class="flex-1 min-w-0">
            <UButton
              color="neutral"
              variant="outline"
              class="w-full"
              @click="drawerOpen = false"
            >
              Cancelar
            </UButton>
          </div>
          <div class="flex-1 min-w-0">
            <UButton
              color="primary"
              class="w-full"
              :loading="saving"
              icon="i-heroicons-check"
              @click="handleSave"
            >
              {{ editMode ? "Salvar alterações" : "Cadastrar usuário" }}
            </UButton>
          </div>
        </div>
      </template>
    </USlideover>

    <!-- ─── Delete Confirm Modal ─────────────────────────────────────────── -->
    <UModal
      v-model:open="deleteModal"
      :dismissible="!deleting"
    >
      <template #content>
        <div class="p-6 space-y-4">
          <div class="flex items-start gap-4">
            <div
              class="w-10 h-10 rounded-xl bg-red-50 dark:bg-red-500/10 flex items-center justify-center shrink-0"
            >
              <UIcon
                name="i-heroicons-trash"
                class="w-5 h-5 text-red-500"
              />
            </div>
            <div>
              <h3 class="font-black text-zinc-900 dark:text-white">
                Excluir usuário
              </h3>
              <p class="text-sm text-zinc-500 mt-1">
                Tem certeza que deseja excluir
                <span class="font-bold text-zinc-700 dark:text-zinc-300">{{
                  userToDelete?.name
                }}</span>? Esta ação não pode ser desfeita.
              </p>
            </div>
          </div>
          <div class="flex justify-end gap-2 pt-2">
            <UButton
              color="neutral"
              variant="ghost"
              :disabled="deleting"
              @click="deleteModal = false"
            >
              Cancelar
            </UButton>
            <UButton
              color="error"
              variant="soft"
              :loading="deleting"
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
