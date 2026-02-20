<script setup lang="ts">
import { z } from 'zod'
import type { FormSubmitEvent } from '#ui/types'

const props = defineProps<{
  modelValue: boolean
  product?: any // Product to edit, null if creating
}>()

const emit = defineEmits(['update:modelValue', 'refresh'])

const isOpen = computed({
  get: () => props.modelValue,
  set: value => emit('update:modelValue', value)
})

const user = useCookie<{ id: number, name: string, email: string, role: string, companyId: number }>('auth_user')
const toast = useToast()

// Schema for form validation
const schema = z.object({
  name: z.string().min(3, 'Nome deve ter pelo menos 3 caracteres'),
  description: z.string().optional(),
  type: z.string().default('other'),
  unit: z.string().default('un'),
  price: z.number().min(0, 'Preço deve ser positivo'), // Input as Reais
  sku: z.string().optional(),
  fck: z.number().int().optional(),
  slump: z.number().int().optional(),
  stoneSize: z.string().optional(),
  active: z.boolean().default(true)
})

type Schema = z.output<typeof schema>

const state = reactive({
  name: '',
  description: '',
  type: 'other',
  unit: 'un',
  price: 0,
  sku: '',
  fck: undefined as number | undefined,
  slump: undefined as number | undefined,
  stoneSize: '',
  active: true
})

// Options
const typeOptions = [
  { label: 'Concreto', value: 'concrete' },
  { label: 'Bomba', value: 'pump' },
  { label: 'Aditivo', value: 'additive' },
  { label: 'Locação', value: 'rental' },
  { label: 'Outro', value: 'other' }
]

const unitOptions = [
  { label: 'Unidade (un)', value: 'un' },
  { label: 'Metro Cúbico (m³)', value: 'm3' },
  { label: 'Hora (hr)', value: 'hr' },
  { label: 'Quilo (kg)', value: 'kg' },
  { label: 'Tonelada (ton)', value: 'ton' }
]

// Initialize form when product changes
watch(() => props.product, (newProduct) => {
  if (newProduct) {
    state.name = newProduct.name
    state.description = newProduct.description || ''
    state.type = newProduct.type
    state.unit = newProduct.unit
    state.price = newProduct.price / 100 // Convert cents to Reais
    state.sku = newProduct.sku || ''
    state.fck = newProduct.fck
    state.slump = newProduct.slump
    state.stoneSize = newProduct.stoneSize || ''
    state.active = newProduct.active
  } else {
    // Reset form
    Object.assign(state, {
      name: '',
      description: '',
      type: 'other',
      unit: 'un',
      price: 0,
      sku: '',
      fck: undefined,
      slump: undefined,
      stoneSize: '',
      active: true
    })
  }
}, { immediate: true })

async function onSubmit(event: FormSubmitEvent<Schema>) {
  try {
    const payload = {
      ...event.data,
      price: Math.round(event.data.price * 100) // Convert Reais to cents
    }

    if (props.product) {
      // Update
      await $fetch(`/api/products/${props.product.id}`, {
        method: 'PUT',
        body: payload
      })
      toast.add({ title: 'Produto atualizado com sucesso!', color: 'success' })
    } else {
      // Create
      await $fetch('/api/products', {
        method: 'POST',
        body: { ...payload, companyId: user.value?.companyId }
      })
      toast.add({ title: 'Produto criado com sucesso!', color: 'success' })
    }

    emit('refresh')
    isOpen.value = false
  } catch (error: any) {
    console.error(error)
    toast.add({ title: 'Erro ao salvar produto', description: error.message, color: 'error' })
  }
}
</script>

<template>
  <UModal
    v-model:open="isOpen"
    :title="product ? 'Editar Produto' : 'Novo Produto'"
    :ui="{ body: 'p-0 sm:p-0' }"
  >
    <template #body>
      <UForm
        id="product-form"
        :schema="schema"
        :state="state"
        class="p-6 space-y-6"
        @submit="onSubmit"
      >
        <!-- Identificação -->
        <div class="grid grid-cols-12 gap-4">
          <div class="col-span-12 sm:col-span-8">
            <UFormGroup
              label="Nome do Produto"
              name="name"
              required
            >
              <UInput
                v-model="state.name"
                placeholder="Ex: Concreto FCK 25"
                icon="i-heroicons-cube"
              />
            </UFormGroup>
          </div>
          <div class="col-span-12 sm:col-span-4">
            <UFormGroup
              label="SKU / Código"
              name="sku"
            >
              <UInput
                v-model="state.sku"
                placeholder="Ex: CONC-001"
                icon="i-heroicons-qr-code"
              />
            </UFormGroup>
          </div>
        </div>

        <USeparator />

        <!-- Comercial -->
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <UFormGroup
            label="Tipo"
            name="type"
            required
          >
            <USelect
              v-model="state.type"
              :items="typeOptions"
              label-key="label"
              value-key="value"
              icon="i-heroicons-tag"
            />
          </UFormGroup>

          <UFormGroup
            label="Unidade"
            name="unit"
            required
          >
            <USelect
              v-model="state.unit"
              :items="unitOptions"
              label-key="label"
              value-key="value"
              icon="i-heroicons-scale"
            />
          </UFormGroup>

          <UFormGroup
            label="Preço Unitário"
            name="price"
            required
          >
            <UInput
              v-model.number="state.price"
              type="number"
              step="0.01"
              placeholder="0.00"
            >
              <template #leading>
                R$
              </template>
            </UInput>
          </UFormGroup>
        </div>

        <!-- Especificações do Concreto (Condicional) -->
        <div
          v-if="state.type === 'concrete'"
          class="rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 p-4 space-y-4"
        >
          <div class="flex items-center gap-2 text-sm font-medium text-gray-900 dark:text-white">
            <UIcon
              name="i-heroicons-beaker"
              class="w-5 h-5 text-primary-500"
            />
            <span>Especificações Técnicas</span>
          </div>

          <div class="grid grid-cols-3 gap-4">
            <UFormGroup
              label="FCK (MPa)"
              name="fck"
            >
              <UInput
                v-model.number="state.fck"
                type="number"
                placeholder="25"
              />
            </UFormGroup>

            <UFormGroup
              label="Slump (cm)"
              name="slump"
            >
              <UInput
                v-model.number="state.slump"
                type="number"
                placeholder="12"
              />
            </UFormGroup>

            <UFormGroup
              label="Pedra"
              name="stoneSize"
            >
              <UInput
                v-model="state.stoneSize"
                placeholder="Brita 1"
              />
            </UFormGroup>
          </div>
        </div>

        <!-- Detalhes Finais -->
        <div class="space-y-4">
          <UFormGroup
            label="Descrição Detalhada"
            name="description"
          >
            <UTextarea
              v-model="state.description"
              placeholder="Adicione detalhes sobre a aplicação, restrições ou observações..."
              :rows="3"
            />
          </UFormGroup>

          <div class="flex items-center justify-between p-4 rounded-lg border border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/20">
            <div class="space-y-0.5">
              <label class="text-sm font-medium text-gray-900 dark:text-white">Status do Produto</label>
              <p class="text-xs text-gray-500">
                Produtos inativos não aparecem para seleção em orçamentos.
              </p>
            </div>
            <UCheckbox v-model="state.active" />
          </div>
        </div>
      </UForm>
    </template>

    <template #footer>
      <div class="flex justify-end gap-2 w-full">
        <UButton
          color="neutral"
          variant="ghost"
          @click="isOpen = false"
        >
          Cancelar
        </UButton>
        <UButton
          type="submit"
          form="product-form"
          color="primary"
          variant="solid"
          :loading="false"
        >
          Salvar Produto
        </UButton>
      </div>
    </template>
  </UModal>
</template>
