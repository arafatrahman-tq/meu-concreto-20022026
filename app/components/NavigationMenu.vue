<script setup lang="ts">
defineProps<{
  isCollapsed?: boolean
}>()

interface MenuItem {
  label: string
  to: string
  icon: string
  exact?: boolean
}

interface MenuGroup {
  label: string
  items: MenuItem[]
}

const groups: MenuGroup[] = [
  {
    label: 'Início',
    items: [
      {
        label: 'Dashboard',
        to: '/',
        icon: 'i-heroicons-squares-2x2',
        exact: true
      }
    ]
  },
  {
    label: 'Comercial',
    items: [
      {
        label: 'Orçamentos',
        to: '/orcamentos',
        icon: 'i-heroicons-document-text'
      },
      {
        label: 'Vendas',
        to: '/vendas',
        icon: 'i-heroicons-shopping-cart'
      },
      {
        label: 'Clientes',
        to: '/clientes',
        icon: 'i-heroicons-identification'
      }
    ]
  },
  {
    label: 'Operacional',
    items: [
      {
        label: 'Agendamentos',
        to: '/agendamentos',
        icon: 'i-heroicons-calendar-days'
      },
      {
        label: 'Produtos',
        to: '/produtos',
        icon: 'i-lucide-package'
      },
      {
        label: 'Vendedores',
        to: '/vendedores',
        icon: 'i-heroicons-user-group'
      }
    ]
  },
  {
    label: 'Financeiro',
    items: [
      {
        label: 'Transações',
        to: '/transacoes',
        icon: 'i-heroicons-arrows-right-left'
      }
    ]
  },
  {
    label: 'Gestão',
    items: [
      {
        label: 'Empresas',
        to: '/empresas',
        icon: 'i-heroicons-building-office-2'
      },
      {
        label: 'Usuários',
        to: '/usuarios',
        icon: 'i-heroicons-users'
      }
    ]
  },
  {
    label: 'Configurações',
    items: [
      {
        label: 'Formas de Pagamento',
        to: '/formas-de-pagamento',
        icon: 'i-heroicons-credit-card'
      },
      {
        label: 'Ajustes',
        to: '/configuracoes',
        icon: 'i-heroicons-cog-6-tooth'
      }
    ]
  }
]
</script>

<template>
  <div class="flex flex-col gap-6 py-2 px-2">
    <div
      v-for="group in groups"
      :key="group.label"
      class="space-y-1"
    >
      <p
        v-if="!isCollapsed"
        class="px-3 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 dark:text-zinc-600 mb-2.5"
      >
        {{ group.label }}
      </p>
      <div
        v-else
        class="h-px bg-zinc-100 dark:bg-zinc-800 my-4 first:hidden"
      />

      <NuxtLink
        v-for="item in group.items"
        :key="item.to"
        :to="item.to"
        :exact="item.exact"
        class="flex items-center px-3 py-2 rounded-xl text-sm font-bold transition-all duration-200 group relative"
        active-class="bg-primary-500 text-white shadow-lg shadow-primary-500/30"
        inactive-class="text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/50 hover:text-zinc-900 dark:hover:text-white"
        :class="isCollapsed ? 'justify-center' : 'gap-3'"
      >
        <UTooltip
          :text="item.label"
          :disabled="!isCollapsed"
          side="right"
          :content="{ sideOffset: 16, align: 'center' }"
        >
          <div class="flex items-center gap-3">
            <UIcon
              :name="item.icon"
              class="w-5 h-5 shrink-0 transition-all duration-200 group-hover:scale-110"
            />
            <span
              v-if="!isCollapsed"
              class="truncate"
            >{{ item.label }}</span>
          </div>
        </UTooltip>
        <div
          v-if="item.exact && !isCollapsed"
          class="absolute left-0 w-1 h-4 bg-white/40 rounded-full opacity-0 group-active:opacity-100 transition-opacity"
        />
      </NuxtLink>
    </div>
  </div>
</template>
