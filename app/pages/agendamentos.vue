<script setup lang="ts">
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

definePageMeta({ layout: 'default' })
useSeoMeta({ title: 'Agendamentos | Meu Concreto' })

const { companyId, user } = useAuth()
const toast = useToast()

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
type ScheduleStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled'
type ScheduleType = 'concrete_delivery' | 'pump_service' | 'site_visit' | 'other'

interface Schedule {
  id: number
  title: string
  description?: string | null
  customerName?: string | null
  customerPhone?: string | null
  location?: string | null
  status: ScheduleStatus
  type: ScheduleType
  date: string | Date
  startTime?: string | null
  endTime?: string | null
  whatsappSent: boolean
  saleId?: number | null
  companyId: number
  userId: number
  createdAt: string
  user?: {
    name: string
  }
}

interface ScheduleForm {
  id?: number
  title: string
  description: string
  customerName: string
  customerPhone: string
  location: string
  status: ScheduleStatus
  type: ScheduleType
  date: string
  startTime: string
  endTime: string
  saleId: number | null
}

// ─────────────────────────────────────────────
// Data Handling
// ─────────────────────────────────────────────
const {
  data: schedulesData,
  pending,
  refresh
} = await useFetch('/api/schedules', {
  query: computed(() => ({ companyId: companyId.value }))
})

const schedules = computed(() => schedulesData.value?.schedules || [])

// ─────────────────────────────────────────────
// UI State
// ─────────────────────────────────────────────
const isOpen = ref(false)
const isEditing = ref(false)
const isSaving = ref(false)
const searchTerm = ref('')

const defaultForm: ScheduleForm = {
  id: undefined,
  title: '',
  description: '',
  customerName: '',
  customerPhone: '',
  location: '',
  status: 'pending',
  type: 'concrete_delivery',
  date: new Date().toISOString().split('T')[0] || '',
  startTime: '08:00',
  endTime: '10:00',
  saleId: null
}

const form = ref<ScheduleForm>({ ...defaultForm })

const columns = [
  { accessorKey: 'date', header: 'Data/Hora' },
  { accessorKey: 'title', header: 'Título' },
  { accessorKey: 'customerName', header: 'Cliente' },
  { accessorKey: 'type', header: 'Tipo' },
  { accessorKey: 'status', header: 'Status' },
  { id: 'actions', header: '' }
]

const filteredSchedules = computed(() => {
  if (!searchTerm.value) return schedules.value
  return schedules.value.filter(
    (s: Schedule) =>
      s.title.toLowerCase().includes(searchTerm.value.toLowerCase())
      || s.customerName?.toLowerCase().includes(searchTerm.value.toLowerCase())
  )
})

// ─────────────────────────────────────────────
// Actions
// ─────────────────────────────────────────────
const openCreate = () => {
  isEditing.value = false
  form.value = { ...defaultForm }
  isOpen.value = true
}

const openEdit = (schedule: Schedule) => {
  isEditing.value = true
  form.value = {
    id: schedule.id,
    title: schedule.title,
    description: schedule.description || '',
    customerName: schedule.customerName || '',
    customerPhone: schedule.customerPhone || '',
    location: schedule.location || '',
    status: schedule.status,
    type: schedule.type,
    date: new Date(schedule.date).toISOString().split('T')[0] as string,
    startTime: schedule.startTime || '08:00',
    endTime: schedule.endTime || '10:00',
    saleId: schedule.saleId || null
  }
  isOpen.value = true
}

const saveSchedule = async () => {
  if (!form.value.date) return
  isSaving.value = true
  try {
    const payload = {
      ...form.value,
      companyId: companyId.value,
      userId: user.value?.id,
      date: new Date(form.value.date).toISOString()
    }

    if (isEditing.value && form.value.id) {
      await $fetch(`/api/schedules/${form.value.id}`, {
        method: 'PUT',
        body: payload
      })
      toast.add({
        title: 'Sucesso',
        description: 'Agendamento atualizado',
        color: 'success'
      })
    } else {
      await $fetch('/api/schedules', {
        method: 'POST',
        body: payload
      })
      toast.add({
        title: 'Sucesso',
        description: 'Agendamento criado e notificação enviada',
        color: 'success'
      })
    }

    isOpen.value = false
    refresh()
  } catch (err: any) {
    toast.add({
      title: 'Erro',
      description: err.data?.statusMessage || 'Erro ao salvar agendamento',
      color: 'error'
    })
  } finally {
    isSaving.value = false
  }
}

const deleteSchedule = async (id: number) => {
  if (!confirm('Tem certeza que deseja excluir este agendamento?')) return

  try {
    await $fetch(`/api/schedules/${id}`, { method: 'DELETE' })
    toast.add({
      title: 'Sucesso',
      description: 'Agendamento removido',
      color: 'success'
    })
    refresh()
  } catch {
    toast.add({
      title: 'Erro',
      description: 'Falha ao remover',
      color: 'error'
    })
  }
}

// ─────────────────────────────────────────────
// Formatters
// ─────────────────────────────────────────────
const formatDateFull = (date: string | Date) =>
  format(new Date(date), 'dd MMM yyyy', { locale: ptBR })

const getStatusColor = (status: ScheduleStatus) => {
  switch (status) {
    case 'completed':
      return 'success'
    case 'confirmed':
      return 'info'
    case 'pending':
      return 'warning'
    case 'cancelled':
      return 'error'
    default:
      return 'neutral'
  }
}

const getStatusLabel = (status: ScheduleStatus) => {
  switch (status) {
    case 'completed':
      return 'Concluído'
    case 'confirmed':
      return 'Confirmado'
    case 'pending':
      return 'Pendente'
    case 'cancelled':
      return 'Cancelado'
    default:
      return status
  }
}

const getTypeLabel = (type: ScheduleType) => {
  switch (type) {
    case 'concrete_delivery':
      return 'Entrega Concreto'
    case 'pump_service':
      return 'Serviço Bomba'
    case 'site_visit':
      return 'Visita Técnica'
    case 'other':
      return 'Outro'
    default:
      return type
  }
}

const getTypeIcon = (type: ScheduleType) => {
  switch (type) {
    case 'concrete_delivery':
      return 'i-lucide-truck'
    case 'pump_service':
      return 'i-lucide-pipette'
    case 'site_visit':
      return 'i-heroicons-map-pin'
    default:
      return 'i-heroicons-calendar'
  }
}
</script>

<template>
  <div class="p-8 space-y-8">
    <!-- Page Header -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-black text-zinc-900 dark:text-white">
          Agendamentos
        </h1>
        <p class="text-sm text-zinc-500 mt-1">
          Gerencie entregas e serviços programados
        </p>
      </div>
      <div class="flex items-center gap-3">
        <UButton
          color="neutral"
          variant="ghost"
          icon="i-heroicons-arrow-path"
          :loading="pending"
          @click="() => refresh()"
        />
        <UButton
          color="primary"
          icon="i-heroicons-plus"
          @click="openCreate"
        >
          Novo Agendamento
        </UButton>
      </div>
    </div>

    <!-- Main Content -->
    <UCard>
      <template #header>
        <div class="flex items-center justify-between gap-4">
          <h3
            class="text-sm font-black uppercase tracking-widest text-zinc-400 shrink-0"
          >
            Lista de Programações
          </h3>
          <div class="flex items-center gap-2 flex-wrap justify-end">
            <UInput
              v-model="searchTerm"
              size="sm"
              placeholder="Buscar título ou cliente..."
              icon="i-heroicons-magnifying-glass"
              class="w-44 lg:w-64"
            />
          </div>
        </div>
      </template>

      <UTable
        :data="filteredSchedules"
        :columns="columns"
        :loading="pending"
      >
        <!-- Date Column -->
        <template #date-cell="{ row }">
          <div class="flex flex-col">
            <span class="font-bold text-zinc-900 dark:text-white">
              {{ formatDateFull(row.original.date) }}
            </span>
            <span
              v-if="row.original.startTime"
              class="text-xs text-zinc-400 font-medium"
            >
              {{ row.original.startTime }} {{ row.original.endTime ? `- ${row.original.endTime}` : '' }}
            </span>
          </div>
        </template>

        <!-- Title Column -->
        <template #title-cell="{ row }">
          <div class="flex items-center gap-2">
            <span class="font-bold text-zinc-700 dark:text-zinc-200">
              {{ row.original.title }}
            </span>
            <UIcon
              v-if="row.original.whatsappSent"
              name="i-simple-icons-whatsapp"
              class="w-4 h-4 text-green-500"
            />
          </div>
        </template>

        <!-- Type Column -->
        <template #type-cell="{ row }">
          <div
            class="flex items-center gap-2 text-xs font-bold text-zinc-500 uppercase tracking-tighter"
          >
            <UIcon
              :name="getTypeIcon(row.original.type)"
              class="w-4 h-4"
            />
            {{ getTypeLabel(row.original.type) }}
          </div>
        </template>

        <!-- Status Column -->
        <template #status-cell="{ row }">
          <UBadge
            :color="getStatusColor(row.original.status)"
            variant="soft"
            size="sm"
          >
            {{ getStatusLabel(row.original.status) }}
          </UBadge>
        </template>

        <!-- Actions Column -->
        <template #actions-cell="{ row }">
          <div class="flex justify-end gap-2">
            <UButton
              color="neutral"
              variant="ghost"
              icon="i-heroicons-pencil-square"
              size="sm"
              @click="openEdit(row.original)"
            />
            <UButton
              color="error"
              variant="ghost"
              icon="i-heroicons-trash"
              size="sm"
              @click="deleteSchedule(row.original.id)"
            />
          </div>
        </template>
      </UTable>

      <!-- Empty State -->
      <div
        v-if="!pending && filteredSchedules.length === 0"
        class="flex flex-col items-center justify-center py-16 text-zinc-400"
      >
        <UIcon
          name="i-heroicons-calendar"
          class="w-12 h-12 mb-3"
        />
        <p class="text-sm font-bold">
          Nenhum agendamento encontrado
        </p>
        <UButton
          color="primary"
          variant="link"
          class="mt-2"
          @click="openCreate"
        >
          Criar o primeiro agendamento
        </UButton>
      </div>
    </UCard>

    <!-- Create/Edit Slideover -->
    <USlideover
      v-model:open="isOpen"
    >
      <template #header>
        <div class="flex items-center justify-between gap-1.5 w-full">
          <div>
            <h2 class="text-lg font-black text-zinc-900 dark:text-white leading-none">
              {{ isEditing ? 'Editar Agendamento' : 'Novo Agendamento' }}
            </h2>
            <p class="text-xs text-zinc-500 mt-1">
              Preencha os dados abaixo
            </p>
          </div>
          <UButton
            color="neutral"
            variant="ghost"
            icon="i-heroicons-x-mark"
            @click="isOpen = false"
          />
        </div>
      </template>

      <template #body>
        <div class="space-y-6">
          <div class="grid grid-cols-1 gap-4">
            <UFormField label="Título *">
              <UInput
                v-model="form.title"
                placeholder="Ex: Entrega Obra Central"
                class="w-full"
              />
            </UFormField>

            <UFormField label="Descrição (Opcional)">
              <UTextarea
                v-model="form.description"
                placeholder="Detalhes adicionais..."
                class="w-full"
              />
            </UFormField>

            <div class="grid grid-cols-2 gap-4">
              <UFormField label="Tipo">
                <USelect
                  v-model="form.type"
                  :items="[
                    { label: 'Entrega Concreto', value: 'concrete_delivery' },
                    { label: 'Serviço Bomba', value: 'pump_service' },
                    { label: 'Visita Técnica', value: 'site_visit' },
                    { label: 'Outro', value: 'other' }
                  ]"
                  value-key="value"
                  label-key="label"
                />
              </UFormField>
              <UFormField label="Status">
                <USelect
                  v-model="form.status"
                  :items="[
                    { label: 'Pendente', value: 'pending' },
                    { label: 'Confirmado', value: 'confirmed' },
                    { label: 'Concluído', value: 'completed' },
                    { label: 'Cancelado', value: 'cancelled' }
                  ]"
                  value-key="value"
                  label-key="label"
                />
              </UFormField>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <UFormField label="Data">
                <UInput
                  v-model="form.date"
                  type="date"
                  class="w-full"
                />
              </UFormField>
              <div class="grid grid-cols-2 gap-2">
                <UFormField label="Início">
                  <UInput
                    v-model="form.startTime"
                    type="time"
                    class="w-full"
                  />
                </UFormField>
                <UFormField label="Fim">
                  <UInput
                    v-model="form.endTime"
                    type="time"
                    class="w-full"
                  />
                </UFormField>
              </div>
            </div>

            <UFormField label="Cliente">
              <UInput
                v-model="form.customerName"
                placeholder="Nome do cliente"
                class="w-full"
              />
            </UFormField>

            <UFormField label="Telefone (WhatsApp)">
              <UInput
                v-model="form.customerPhone"
                placeholder="(00) 00000-0000"
                class="w-full"
              />
            </UFormField>

            <UFormField label="Localização">
              <UInput
                v-model="form.location"
                placeholder="Endereço da entrega"
                icon="i-heroicons-map-pin"
                class="w-full"
              />
            </UFormField>
          </div>
        </div>
      </template>

      <template #footer>
        <div class="flex items-center justify-end gap-3 w-full">
          <UButton
            color="neutral"
            variant="ghost"
            @click="isOpen = false"
          >
            Cancelar
          </UButton>
          <UButton
            color="primary"
            :loading="isSaving"
            @click="saveSchedule"
          >
            Salvar Agendamento
          </UButton>
        </div>
      </template>
    </USlideover>
  </div>
</template>
