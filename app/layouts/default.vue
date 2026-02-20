<script setup lang="ts">
const title = 'Meu Concreto'
const description = 'Sistema de gestão para concreteiras.'

useSeoMeta({
  title,
  description,
  ogTitle: title,
  ogDescription: description
})

const { user, companies, activeCompany, clearUser, switchCompany } = useAuth()
const router = useRouter()

const isCollapsed = useCookie('mc_sidebar_collapsed', { default: () => false })

// ── Notifications ────────────────────────────────────────────────────────────
const {
  notifications: notifList,
  unreadCount,
  loading: notifLoading,
  markAsRead,
  markAllAsRead,
  startPolling,
  stopPolling
} = useNotifications()

onMounted(() => startPolling(60_000))
onUnmounted(() => stopPolling())

const notifOpen = ref(false)

// Relative time helper
const timeAgo = (date: Date | string) => {
  const s = Math.floor((Date.now() - new Date(date).getTime()) / 1000)
  if (s < 60) return 'agora'
  if (s < 3600) return `${Math.floor(s / 60)}min`
  if (s < 86400) return `${Math.floor(s / 3600)}h`
  return `${Math.floor(s / 86400)}d`
}

const notifIconColor: Record<string, string> = {
  sale: 'text-primary-500',
  quote: 'text-blue-500',
  quote_updated: 'text-amber-500',
  transaction: 'text-violet-500',
  user: 'text-teal-500',
  product: 'text-orange-500'
}

const handleNotifClick = async (notif: (typeof notifList.value)[0]) => {
  await markAsRead(notif.id)
  if (notif.link) await router.push(notif.link)
  notifOpen.value = false
}

const userInitials = computed(() => {
  if (!user.value?.name) return 'U'
  return user.value.name
    .split(' ')
    .slice(0, 2)
    .map(w => w[0])
    .join('')
    .toUpperCase()
})

const companySwitcherItems = computed(() =>
  (companies.value ?? []).map(c => ({
    label: c.name,
    icon:
      c.id === activeCompany.value?.id
        ? 'i-heroicons-check'
        : 'i-heroicons-building-office-2',
    onSelect: () => switchCompany(c.id)
  }))
)

const handleLogout = async () => {
  await $fetch('/api/auth/logout', { method: 'POST' }).catch(() => {})
  clearUser()
  await router.push('/login')
}
</script>

<template>
  <UApp>
    <div
      class="flex h-screen bg-zinc-50 dark:bg-zinc-950 overflow-hidden font-sans group"
    >
      <!-- Painel Lateral (Desktop) -->
      <aside
        :class="[
          'hidden lg:flex flex-col border-r border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-2xl relative z-30 transition-all duration-300',
          isCollapsed ? 'w-22' : 'w-72'
        ]"
      >
        <div
          :class="[
            'pb-10 border-b border-zinc-100 dark:border-zinc-900 group flex items-center',
            isCollapsed ? 'p-4 justify-center' : 'p-8 justify-between'
          ]"
        >
          <NuxtLink
            v-if="!isCollapsed"
            to="/"
          >
            <AppLogo />
          </NuxtLink>
          <div
            v-else
            class="w-8 h-8 rounded-lg bg-primary-500 flex items-center justify-center shrink-0 shadow-lg shadow-primary-500/30 overflow-hidden relative"
          >
            <div
              class="absolute inset-0 bg-linear-to-br from-white/20 to-transparent"
            />
            <UIcon
              name="i-lucide-anvil"
              class="w-4 h-4 text-white relative z-10"
            />
          </div>

          <UButton
            v-if="!isCollapsed"
            :icon="
              isCollapsed
                ? 'i-heroicons-chevron-right'
                : 'i-heroicons-chevron-left'
            "
            variant="ghost"
            color="neutral"
            class="hidden lg:flex transition-transform duration-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 shrink-0"
            size="sm"
            @click="isCollapsed = !isCollapsed"
          />
        </div>
        <div
          v-if="isCollapsed"
          class="flex justify-center py-2"
        >
          <UButton
            icon="i-heroicons-chevron-right"
            variant="ghost"
            color="neutral"
            size="xs"
            @click="isCollapsed = !isCollapsed"
          />
        </div>

        <!-- Company Switcher -->
        <div
          v-if="companies && companies.length > 0"
          class="px-4 pt-4 pb-2"
        >
          <UDropdownMenu
            :items="[companySwitcherItems]"
            :content="{ align: 'start', sideOffset: 4 }"
            :ui="{ content: 'w-64' }"
          >
            <button
              class="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-900 ring-1 ring-zinc-200 dark:ring-zinc-800 hover:ring-primary-500/40 hover:bg-primary-50 dark:hover:bg-primary-500/5 transition-all group/company"
            >
              <div
                class="w-7 h-7 rounded-lg bg-primary-100 dark:bg-primary-500/20 flex items-center justify-center shrink-0"
              >
                <UIcon
                  name="i-heroicons-building-office-2"
                  class="w-4 h-4 text-primary-600 dark:text-primary-400"
                />
              </div>
              <div
                v-if="!isCollapsed"
                class="flex flex-col min-w-0 flex-1 text-left"
              >
                <span
                  class="text-xs font-black text-zinc-700 dark:text-zinc-200 truncate leading-tight"
                >
                  {{ activeCompany?.name ?? "Selecionar Empresa" }}
                </span>
                <span
                  class="text-[10px] font-bold text-zinc-400 uppercase tracking-widest leading-none mt-0.5"
                >
                  {{ activeCompany?.role ?? "—" }}
                </span>
              </div>
              <UIcon
                v-if="!isCollapsed"
                name="i-heroicons-chevron-up-down"
                class="w-4 h-4 text-zinc-400 group-hover/company:text-primary-500 shrink-0"
              />
            </button>
          </UDropdownMenu>
        </div>

        <nav class="flex-1 overflow-y-auto p-4 custom-scrollbar">
          <NavigationMenu :is-collapsed="isCollapsed" />
        </nav>

        <div
          :class="[
            'border-t border-zinc-100 dark:border-zinc-900 bg-zinc-50/50 dark:bg-zinc-900/30 transition-all duration-300',
            isCollapsed ? 'p-3' : 'p-6'
          ]"
        >
          <div
            :class="[
              'flex items-center rounded-2xl group transition-all duration-300 shadow-sm border border-transparent hover:border-zinc-100 dark:hover:border-zinc-700 hover:bg-white dark:hover:bg-zinc-800',
              isCollapsed ? 'p-2 justify-center' : 'p-3 gap-4'
            ]"
          >
            <UDropdownMenu
              :items="[
                [
                  {
                    label: 'Sair',
                    icon: 'i-heroicons-arrow-right-start-on-rectangle',
                    color: 'error' as const,
                    onSelect: handleLogout
                  }
                ]
              ]"
              :content="{
                align: isCollapsed ? 'center' : 'start',
                side: isCollapsed ? 'right' : 'top',
                sideOffset: 12
              }"
              :ui="{ content: 'w-48' }"
            >
              <button class="relative shrink-0 focus:outline-none">
                <UAvatar
                  :alt="user?.name ?? 'Usuário'"
                  :text="userInitials"
                  size="sm"
                  class="ring-2 ring-primary-500/20"
                />
                <div
                  v-if="!isCollapsed"
                  class="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 border-2 border-white dark:border-zinc-900 rounded-full"
                />
              </button>
            </UDropdownMenu>

            <div
              v-if="!isCollapsed"
              class="flex flex-col min-w-0 flex-1"
            >
              <span
                class="text-xs font-black text-zinc-900 dark:text-white truncate"
              >
                {{ user?.name ?? "Usuário" }}
              </span>
              <span
                class="text-[10px] font-bold text-zinc-400 truncate uppercase tracking-widest leading-none"
              >
                {{ user?.role ?? "Meu Concreto" }}
              </span>
            </div>

            <UButton
              v-if="!isCollapsed"
              icon="i-heroicons-arrow-right-start-on-rectangle"
              variant="ghost"
              color="error"
              size="xs"
              class="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
              title="Sair"
              @click="handleLogout"
            />
          </div>
        </div>
      </aside>

      <!-- Área de Conteúdo Principal -->
      <main class="flex-1 flex flex-col relative overflow-hidden h-full">
        <!-- Header Superior -->
        <header
          class="h-20 flex items-center justify-between px-8 border-b border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-xl sticky top-0 z-20"
        >
          <div class="flex items-center gap-6">
            <!-- Mobile Menu Trigger -->
            <UButton
              icon="i-heroicons-bars-3-bottom-left"
              variant="ghost"
              color="neutral"
              class="lg:hidden"
            />

            <!-- Mobile Company Switcher (hidden on desktop where sidebar handles it) -->
            <UDropdownMenu
              v-if="companies && companies.length > 0"
              :items="[companySwitcherItems]"
              :content="{ align: 'start', sideOffset: 6 }"
              :ui="{ content: 'w-56' }"
              class="lg:hidden"
            >
              <button
                class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-zinc-100 dark:bg-zinc-900 ring-1 ring-zinc-200 dark:ring-zinc-800 hover:ring-primary-500/40 transition-all"
              >
                <div
                  class="w-5 h-5 rounded-md bg-primary-100 dark:bg-primary-500/20 flex items-center justify-center shrink-0"
                >
                  <UIcon
                    name="i-heroicons-building-office-2"
                    class="w-3 h-3 text-primary-600 dark:text-primary-400"
                  />
                </div>
                <span
                  class="text-xs font-black text-zinc-700 dark:text-zinc-200 truncate max-w-24"
                >
                  {{ activeCompany?.name ?? "Empresa" }}
                </span>
                <UIcon
                  name="i-heroicons-chevron-up-down"
                  class="w-3 h-3 text-zinc-400 shrink-0"
                />
              </button>
            </UDropdownMenu>

            <div
              class="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs font-bold text-zinc-500 dark:text-zinc-400 shadow-inner"
            >
              <UIcon
                name="i-heroicons-cpu-chip"
                class="w-4 h-4 text-primary-500"
              />
              <span>SISTEMA ATIVO</span>
              <div class="w-1 h-1 bg-green-500 rounded-full animate-ping" />
            </div>
          </div>

          <div class="flex items-center gap-6">
            <div
              class="hidden xl:flex items-center gap-1.5 px-3 py-1 text-xs font-bold text-zinc-400"
            >
              <UIcon
                name="i-heroicons-clock"
                class="w-4 h-4"
              />
              <span>18 FEV, 2026</span>
            </div>

            <div
              class="h-6 w-px bg-zinc-200 dark:bg-zinc-800 hidden md:block"
            />

            <div class="flex items-center gap-2">
              <UTooltip
                text="Alternar Tema"
                :content="{ sideOffset: 8 }"
              >
                <UColorModeButton
                  class="hover:bg-primary-500/10 hover:text-primary-500 transition-colors rounded-xl"
                />
              </UTooltip>

              <!-- ── Notifications Bell ── -->
              <div class="relative">
                <UTooltip
                  text="Notificações"
                  :disabled="notifOpen"
                  :content="{ sideOffset: 8 }"
                >
                  <UButton
                    icon="i-heroicons-bell"
                    color="neutral"
                    variant="ghost"
                    class="hover:bg-primary-500/10 hover:text-primary-500 transition-colors rounded-xl p-2.5 relative"
                    @click="notifOpen = !notifOpen"
                  >
                    <span
                      v-if="unreadCount > 0"
                      class="absolute top-1.5 right-1.5 min-w-4 h-4 px-1 flex items-center justify-center bg-primary-500 text-white text-[10px] font-black rounded-full border-2 border-white dark:border-zinc-950 leading-none"
                    >{{ unreadCount > 99 ? "99+" : unreadCount }}</span>
                    <span
                      v-else
                      class="absolute top-2 right-2 w-2 h-2 bg-zinc-300 dark:bg-zinc-700 rounded-full"
                    />
                  </UButton>
                </UTooltip>

                <!-- Click-outside overlay -->
                <div
                  v-if="notifOpen"
                  class="fixed inset-0 z-40"
                  @click="notifOpen = false"
                />

                <!-- Notification Panel -->
                <Transition
                  enter-active-class="transition duration-150 ease-out"
                  enter-from-class="opacity-0 translate-y-1 scale-95"
                  enter-to-class="opacity-100 translate-y-0 scale-100"
                  leave-active-class="transition duration-100 ease-in"
                  leave-from-class="opacity-100 translate-y-0 scale-100"
                  leave-to-class="opacity-0 translate-y-1 scale-95"
                >
                  <div
                    v-if="notifOpen"
                    class="absolute right-0 top-full mt-2 w-80 sm:w-96 z-50 rounded-2xl bg-white dark:bg-zinc-900 ring-1 ring-zinc-200 dark:ring-zinc-800 shadow-xl dark:shadow-zinc-900/60 overflow-hidden origin-top-right"
                  >
                    <!-- Panel Header -->
                    <div
                      class="flex items-center justify-between px-4 py-3 border-b border-zinc-100 dark:border-zinc-800"
                    >
                      <div class="flex items-center gap-2">
                        <span
                          class="text-xs font-black uppercase tracking-widest text-zinc-400"
                        >Notificações</span>
                        <span
                          v-if="unreadCount > 0"
                          class="px-1.5 py-0.5 text-[10px] font-black rounded-full bg-primary-500 text-white leading-none"
                        >{{ unreadCount }}</span>
                      </div>
                      <button
                        v-if="unreadCount > 0"
                        class="text-[10px] font-bold text-primary-500 hover:text-primary-600 transition-colors uppercase tracking-widest"
                        @click="markAllAsRead"
                      >
                        Marcar tudo como lido
                      </button>
                    </div>

                    <!-- Loading skeleton -->
                    <div
                      v-if="notifLoading && notifList.length === 0"
                      class="p-3 space-y-2"
                    >
                      <USkeleton
                        v-for="i in 3"
                        :key="i"
                        class="h-14 rounded-xl"
                      />
                    </div>

                    <!-- Empty state -->
                    <div
                      v-else-if="notifList.length === 0"
                      class="flex flex-col items-center justify-center py-10 text-zinc-400"
                    >
                      <UIcon
                        name="i-heroicons-bell-slash"
                        class="w-8 h-8 mb-2 opacity-40"
                      />
                      <p class="text-xs font-bold">
                        Nenhuma notificação ainda
                      </p>
                    </div>

                    <!-- Notification List -->
                    <ul
                      v-else
                      class="max-h-80 overflow-y-auto divide-y divide-zinc-100 dark:divide-zinc-800 custom-scrollbar"
                    >
                      <li
                        v-for="notif in notifList"
                        :key="notif.id"
                        class="group relative flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors"
                        :class="
                          notif.readAt
                            ? 'hover:bg-zinc-50 dark:hover:bg-zinc-800/50'
                            : 'bg-primary-50/60 dark:bg-primary-500/5 hover:bg-primary-50 dark:hover:bg-primary-500/10'
                        "
                        @click="handleNotifClick(notif)"
                      >
                        <!-- Unread indicator -->
                        <div
                          v-if="!notif.readAt"
                          class="absolute left-1.5 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-primary-500 shrink-0"
                        />

                        <!-- Icon -->
                        <div
                          class="mt-0.5 w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ring-1 ring-zinc-200 dark:ring-zinc-700 bg-zinc-50 dark:bg-zinc-800"
                        >
                          <UIcon
                            :name="notif.icon ?? 'i-heroicons-bell'"
                            class="w-4 h-4"
                            :class="
                              notifIconColor[notif.type] ?? 'text-zinc-400'
                            "
                          />
                        </div>

                        <!-- Content -->
                        <div class="flex-1 min-w-0">
                          <p
                            class="text-xs font-bold text-zinc-900 dark:text-white truncate"
                            :class="{ 'font-black': !notif.readAt }"
                          >
                            {{ notif.title }}
                          </p>
                          <p
                            v-if="notif.body"
                            class="text-[11px] text-zinc-500 dark:text-zinc-400 truncate mt-0.5"
                          >
                            {{ notif.body }}
                          </p>
                        </div>

                        <!-- Time -->
                        <span
                          class="text-[10px] font-bold text-zinc-400 shrink-0 mt-0.5"
                        >
                          {{ timeAgo(notif.createdAt) }}
                        </span>
                      </li>
                    </ul>

                    <!-- Panel Footer -->
                    <div
                      class="px-4 py-2.5 border-t border-zinc-100 dark:border-zinc-800"
                    >
                      <NuxtLink
                        to="/configuracoes"
                        class="text-[10px] font-black uppercase tracking-widest text-zinc-400 hover:text-primary-500 transition-colors"
                        @click="notifOpen = false"
                      >
                        Gerenciar preferências →
                      </NuxtLink>
                    </div>
                  </div>
                </Transition>
              </div>

              <UTooltip
                text="Suporte via WhatsApp"
                :content="{ sideOffset: 8 }"
              >
                <UButton
                  icon="i-simple-icons-whatsapp"
                  color="neutral"
                  variant="ghost"
                  class="hover:bg-primary-500/10 hover:text-green-500 transition-colors rounded-xl p-2.5"
                  to="https://wa.me/5514998485689"
                  target="_blank"
                />
              </UTooltip>
            </div>
          </div>
        </header>

        <!-- Container do Conteúdo Dinâmico -->
        <div
          class="flex-1 overflow-y-auto overflow-x-hidden p-0 custom-scrollbar scroll-smooth"
        >
          <div class="min-h-full transition-all duration-300">
            <slot />
          </div>

          <!-- Footer Minimalista -->
          <footer
            class="h-20 flex items-center justify-between px-10 border-t border-zinc-200 dark:border-zinc-900 bg-white/50 dark:bg-zinc-900/10 text-zinc-400 mt-20"
          >
            <span class="text-[10px] font-black uppercase tracking-[0.2em]">© 2026 MEU.CONCRETO OS</span>
            <div
              class="flex items-center gap-6 text-[10px] font-black tracking-widest"
            >
              <a
                href="https://wa.me/5514998485689"
                target="_blank"
                class="hover:text-primary-500 transition-colors"
              >SUPORTE</a>
              <a
                href="#"
                class="hover:text-primary-500 transition-colors"
              >DOCUMENTAÇÃO</a>
            </div>
          </footer>
        </div>
      </main>
    </div>
  </UApp>
</template>

<style>
.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: #d4d4d8;
  border-radius: 10px;
}
.dark .custom-scrollbar::-webkit-scrollbar-thumb {
  background: #27272a;
}
</style>
