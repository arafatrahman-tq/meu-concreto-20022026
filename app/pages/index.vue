<script setup lang="ts">
definePageMeta({ layout: "default" });

useSeoMeta({ title: "Dashboard | Meu Concreto" });

const { user, companies, activeCompanyId, companyId, switchCompany } =
  useAuth();

const canFilter = computed(() => {
  const role = user.value?.role?.toLowerCase() || "";
  return ["admin", "manager", "administrador", "gerente"].includes(role);
});

// ─── Filtros de Período ──────────────────────────────────────────
const selectedPeriod = ref("month");
const periodOptions = [
  { label: "Hoje", value: "today", icon: "i-heroicons-clock" },
  { label: "Esta Semana", value: "week", icon: "i-heroicons-calendar-days" },
  { label: "Este Mês", value: "month", icon: "i-heroicons-calendar" },
  { label: "Este Ano", value: "year", icon: "i-heroicons-rectangle-stack" },
  { label: "Tudo", value: "all", icon: "i-heroicons-globe-alt" },
];

// ─── Fetch paralelo — escopo da empresa ativa ─────────────────────
interface Sale {
  id: number;
  customerName: string;
  total: number;
  status: "pending" | "confirmed" | "in_progress" | "completed" | "cancelled";
  date: string | number | Date;
  paymentMethod?: string | null;
  seller?: { id: number; name: string } | null;
}

interface Transaction {
  id: number;
  description: string;
  amount: number;
  type: "income" | "expense";
  status: "pending" | "paid" | "cancelled";
  date: string | number | Date;
  paymentMethod?: string | null;
}

interface Quote {
  id: number;
  status: string;
  createdAt: string | number | Date;
}

interface Product {
  id: number;
  active: boolean;
}

const [
  { data: salesData, pending: salesPending },
  { data: txData, pending: txPending },
  { data: quotesData },
  { data: productsData },
] = await Promise.all([
  useFetch<{ sales: Sale[] }>(() => `/api/sales?companyId=${companyId.value}`, {
    default: () => ({ sales: [] }),
  }),
  useFetch<{ transactions: Transaction[] }>(
    () => `/api/transactions?companyId=${companyId.value}`,
    {
      default: () => ({ transactions: [] }),
    },
  ),
  useFetch<{ quotes: Quote[] }>(
    () => `/api/quotes?companyId=${companyId.value}`,
    {
      default: () => ({ quotes: [] }),
    },
  ),
  useFetch<{ products: Product[] }>(
    () => `/api/products?companyId=${companyId.value}`,
    {
      default: () => ({ products: [] }),
    },
  ),
]);

// ─── Helpers ──────────────────────────────────────────────────────
const formatCurrency = (cents: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    cents / 100,
  );

// Drizzle serializes timestamp columns as ISO strings via JSON.
// Normalize any date value (ISO string | Date | unix seconds) → ms timestamp.
const toMs = (v: string | number | Date | null | undefined): number => {
  if (!v) return 0;
  const n =
    typeof v === "number" ? (v < 1e10 ? v * 1000 : v) : new Date(v).getTime();
  return n;
};

const now = new Date();

const ranges = computed(() => {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  const today = d.getTime();
  const tomorrow = today + 86400000;
  const yesterday = today - 86400000;

  if (selectedPeriod.value === "today") {
    return {
      start: today,
      end: tomorrow,
      prevStart: yesterday,
      prevEnd: today,
    };
  }
  if (selectedPeriod.value === "week") {
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Seg
    const monday = new Date(now);
    monday.setHours(0, 0, 0, 0);
    monday.setDate(diff);
    const start = monday.getTime();
    const prevStart = start - 7 * 86400000;
    return { start, end: start + 7 * 86400000, prevStart, prevEnd: start };
  }
  if (selectedPeriod.value === "month") {
    const start = new Date(d.getFullYear(), d.getMonth(), 1).getTime();
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime();
    const prevStart = new Date(d.getFullYear(), d.getMonth() - 1, 1).getTime();
    return { start, end, prevStart, prevEnd: start };
  }
  if (selectedPeriod.value === "year") {
    const start = new Date(d.getFullYear(), 0, 1).getTime();
    const end = new Date(d.getFullYear() + 1, 0, 1).getTime();
    const prevStart = new Date(d.getFullYear() - 1, 0, 1).getTime();
    return { start, end, prevStart, prevEnd: start };
  }
  return { start: 0, end: tomorrow, prevStart: 0, prevEnd: 0 }; // All
});

// ─── KPI: Faturamento Filtrado ───────────────────────────────────
const sales = computed<Sale[]>(() => salesData.value?.sales ?? []);
const transactions = computed<Transaction[]>(
  () => txData.value?.transactions ?? [],
);
const quotes = computed<Quote[]>(() => quotesData.value?.quotes ?? []);
const products = computed<Product[]>(() => productsData.value?.products ?? []);

const salesFiltered = computed(() =>
  sales.value.filter(
    (s) =>
      toMs(s.date) >= ranges.value.start &&
      toMs(s.date) < ranges.value.end &&
      s.status !== "cancelled",
  ),
);
const salesPrevious = computed(() =>
  sales.value.filter(
    (s) =>
      toMs(s.date) >= ranges.value.prevStart &&
      toMs(s.date) < ranges.value.prevEnd &&
      s.status !== "cancelled",
  ),
);

const revenueFiltered = computed(() =>
  salesFiltered.value.reduce((acc: number, s) => acc + (s.total ?? 0), 0),
);
const revenuePrevious = computed(() =>
  salesPrevious.value.reduce((acc: number, s) => acc + (s.total ?? 0), 0),
);
const revenueTrend = computed(() => {
  if (selectedPeriod.value === "all" || !revenuePrevious.value) return null;
  return (
    ((revenueFiltered.value - revenuePrevious.value) / revenuePrevious.value) *
    100
  );
});

// ─── KPI: Orçamentos Ativos ───────────────────────────────────────
const activeQuotes = computed(() =>
  quotes.value.filter((q) => ["draft", "sent"].includes(q.status)),
);
const quotesFiltered = computed(() =>
  quotes.value.filter(
    (q) =>
      toMs(q.createdAt) >= ranges.value.start &&
      toMs(q.createdAt) < ranges.value.end,
  ),
);
const quotesPrevious = computed(() =>
  quotes.value.filter(
    (q: any) =>
      toMs(q.createdAt) >= ranges.value.prevStart &&
      toMs(q.createdAt) < ranges.value.prevEnd,
  ),
);
const quotesTrend = computed(() => {
  if (selectedPeriod.value === "all" || !quotesPrevious.value.length)
    return null;
  return (
    ((quotesFiltered.value.length - quotesPrevious.value.length) /
      quotesPrevious.value.length) *
    100
  );
});

// ─── KPI: Vendas no Período ───────────────────────────────────────
const salesCountTrend = computed(() => {
  if (selectedPeriod.value === "all" || !salesPrevious.value.length)
    return null;
  return (
    ((salesFiltered.value.length - salesPrevious.value.length) /
      salesPrevious.value.length) *
    100
  );
});

const revenueTrendLabel = computed(() => {
  if (selectedPeriod.value === "all") return "";
  const map: any = {
    today: "vs. ontem",
    week: "vs. sem. ant.",
    month: "vs. mês ant.",
    year: "vs. ano ant.",
  };
  return map[selectedPeriod.value] || "";
});

// ─── KPI: Saldo do Período (Receitas - Despesas) ──────────────────
const txFiltered = computed(() =>
  transactions.value.filter(
    (t: any) =>
      toMs(t.date) >= ranges.value.start &&
      toMs(t.date) < ranges.value.end &&
      t.status !== "cancelled",
  ),
);
const incomeFiltered = computed(() =>
  txFiltered.value
    .filter((t: any) => t.type === "income")
    .reduce((acc: number, t: any) => acc + t.amount, 0),
);
const expenseFiltered = computed(() =>
  txFiltered.value
    .filter((t: any) => t.type === "expense")
    .reduce((acc: number, t: any) => acc + t.amount, 0),
);
const balanceFiltered = computed(
  () => incomeFiltered.value - expenseFiltered.value,
);

// ─── Sparklines: receita diária dos últimos 7 dias ────────────────
const last7DaysRevenue = computed(() => {
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    d.setHours(0, 0, 0, 0);
    return { start: d.getTime(), end: d.getTime() + 86400_000 };
  });
  return days.map(({ start, end }) =>
    sales.value
      .filter(
        (s: any) =>
          toMs(s.date) >= start &&
          toMs(s.date) < end &&
          s.status !== "cancelled",
      )
      .reduce((acc: number, s: any) => acc + (s.total ?? 0), 0),
  );
});

// ─── Cash Flow Chart (últimos 6 meses) ────────────────────────────
const cashFlowMonths = computed(() => {
  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    const start = d.getTime();
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime();
    const label = d.toLocaleDateString("pt-BR", { month: "short" });
    const income = transactions.value
      .filter(
        (t: any) =>
          t.type === "income" &&
          toMs(t.date) >= start &&
          toMs(t.date) < end &&
          t.status !== "cancelled",
      )
      .reduce((acc: number, t: any) => acc + t.amount, 0);
    const expense = transactions.value
      .filter(
        (t: any) =>
          t.type === "expense" &&
          toMs(t.date) >= start &&
          toMs(t.date) < end &&
          t.status !== "cancelled",
      )
      .reduce((acc: number, t: any) => acc + t.amount, 0);
    return { label, income, expense };
  });
});

const chartMax = computed(() =>
  Math.max(...cashFlowMonths.value.flatMap((m) => [m.income, m.expense]), 1),
);

const barHeight = (val: number) => Math.max(4, (val / chartMax.value) * 120);

// ─── Quick stats ──────────────────────────────────────────────────
const pendingSales = computed(
  () => salesFiltered.value.filter((s: any) => s.status === "pending").length,
);
const activeProducts = computed(
  () => products.value.filter((p: any) => p.active).length,
);

// ─── Listas recentes ──────────────────────────────────────────────
const recentTransactions = computed(() =>
  [...txFiltered.value]
    .sort((a: any, b: any) => toMs(b.date) - toMs(a.date))
    .slice(0, 6),
);

const recentSales = computed(() =>
  [...salesFiltered.value]
    .sort((a: any, b: any) => toMs(b.date) - toMs(a.date))
    .slice(0, 5),
);

// ─── Top Vendedores ───────────────────────────────────────────────
const topSellers = computed(() => {
  const sellerMap = new Map<
    number,
    { name: string; total: number; count: number }
  >();

  salesFiltered.value.forEach((s) => {
    if (!s.seller) return;
    const current = sellerMap.get(s.seller.id) || {
      name: s.seller.name,
      total: 0,
      count: 0,
    };
    current.total += s.total;
    current.count += 1;
    sellerMap.set(s.seller.id, current);
  });

  return Array.from(sellerMap.values())
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);
});
</script>

<template>
  <div class="p-8 space-y-8 min-h-full">
    <!-- ─── Page Header ─────────────────────────────────────────── -->
    <div
      class="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
    >
      <div>
        <h1 class="text-2xl font-black text-zinc-900 dark:text-white">
          Visão Geral
        </h1>
        <p class="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
          Acompanhe o desempenho da sua concreteira em tempo real
        </p>
      </div>
      <div class="flex items-center gap-3">
        <UBadge
          color="success"
          variant="soft"
          class="text-[10px] font-black uppercase tracking-widest"
        >
          <span
            class="w-1.5 h-1.5 bg-green-500 rounded-full mr-1.5 animate-pulse"
          />
          Ao vivo
        </UBadge>

        <USelectMenu
          v-if="canFilter"
          :model-value="activeCompanyId ?? undefined"
          :items="companies"
          value-key="id"
          label-key="name"
          class="hidden md:flex min-w-44"
          variant="soft"
          size="sm"
          color="neutral"
          icon="i-heroicons-building-office"
          @update:model-value="(v: number) => (activeCompanyId = v)"
        />

        <USelectMenu
          v-if="canFilter"
          v-model="selectedPeriod"
          :items="periodOptions"
          value-key="value"
          class="min-w-36"
          variant="soft"
          size="sm"
          color="neutral"
          icon="i-heroicons-calendar"
        />

        <UButton color="primary" icon="i-heroicons-plus" size="sm" to="/vendas">
          Nova Venda
        </UButton>
      </div>
    </div>

    <!-- ─── KPI Cards ──────────────────────────────────────────── -->
    <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
      <template v-if="salesPending">
        <USkeleton v-for="i in 4" :key="i" class="h-40 rounded-2xl" />
      </template>
      <template v-else>
        <DashboardKpiCard
          label="Faturamento no Período"
          :value="formatCurrency(revenueFiltered)"
          icon="i-heroicons-banknotes"
          :trend="revenueTrend"
          :sparkline="last7DaysRevenue"
          :trend-label="revenueTrendLabel"
        />
        <DashboardKpiCard
          label="Orçamentos Ativos"
          :value="String(activeQuotes.length)"
          icon="i-heroicons-document-text"
          :trend="quotesTrend"
          icon-color="text-blue-500"
          :trend-label="revenueTrendLabel"
        />
        <DashboardKpiCard
          label="Vendas no Período"
          :value="String(salesFiltered.length)"
          icon="i-heroicons-shopping-cart"
          :trend="salesCountTrend"
          icon-color="text-amber-500"
          :trend-label="revenueTrendLabel"
        />
        <DashboardKpiCard
          label="Saldo do Período"
          :value="formatCurrency(balanceFiltered)"
          icon="i-heroicons-scale"
          :trend="null"
          :icon-color="balanceFiltered >= 0 ? 'text-green-500' : 'text-red-500'"
        />
      </template>
    </div>

    <!-- ─── Linha principal: Gráfico + Info ───────────────────── -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <!-- Gráfico de fluxo de caixa -->
      <UCard class="lg:col-span-2">
        <template #header>
          <div class="flex items-center justify-between">
            <div>
              <h3
                class="text-sm font-black uppercase tracking-widest text-zinc-400"
              >
                Fluxo de Caixa
              </h3>
              <p class="text-xs text-zinc-400 mt-0.5">
                Receitas vs. Despesas — últimos 6 meses
              </p>
            </div>
            <div
              class="flex items-center gap-4 text-xs font-bold text-zinc-400"
            >
              <span class="flex items-center gap-1.5">
                <span
                  class="w-2.5 h-2.5 rounded-sm bg-primary-500 block"
                />Receita
              </span>
              <span class="flex items-center gap-1.5">
                <span class="w-2.5 h-2.5 rounded-sm bg-red-500 block" />Despesa
              </span>
            </div>
          </div>
        </template>

        <div class="flex items-end gap-3 h-44 pt-4">
          <div
            v-for="(m, i) in cashFlowMonths"
            :key="i"
            class="flex-1 flex flex-col items-center gap-2 group"
          >
            <!-- Barras com tooltip -->
            <UTooltip
              class="w-full flex justify-center"
              :content="{ sideOffset: 8, align: 'center' }"
            >
              <template #content>
                <div
                  class="p-3 space-y-3 min-w-48 bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl"
                >
                  <div
                    class="flex items-center justify-between border-b border-zinc-800 pb-2 mb-1"
                  >
                    <p
                      class="text-[10px] font-black uppercase tracking-widest text-zinc-500"
                    >
                      {{ m.label }} — Fluxo de Caixa
                    </p>
                    <UBadge
                      :color="m.income - m.expense >= 0 ? 'success' : 'error'"
                      variant="soft"
                      size="sm"
                      class="text-[8px] font-black"
                    >
                      {{ m.income - m.expense >= 0 ? "POSITIVO" : "NEGATIVO" }}
                    </UBadge>
                  </div>

                  <div class="space-y-1.5">
                    <div class="flex items-center justify-between gap-4">
                      <span
                        class="flex items-center gap-2 text-xs text-zinc-400"
                      >
                        <span
                          class="w-1.5 h-1.5 rounded-full bg-primary-500 inline-block"
                        />
                        Receita
                      </span>
                      <span class="text-xs font-black text-white">
                        {{ formatCurrency(m.income) }}
                      </span>
                    </div>
                    <div class="flex items-center justify-between gap-4">
                      <span
                        class="flex items-center gap-2 text-xs text-zinc-400"
                      >
                        <span
                          class="w-1.5 h-1.5 rounded-full bg-red-500 inline-block"
                        />
                        Despesa
                      </span>
                      <span class="text-xs font-black text-white">
                        {{ formatCurrency(m.expense) }}
                      </span>
                    </div>
                  </div>

                  <div
                    class="pt-2 border-t border-zinc-800/50 flex items-center justify-between"
                  >
                    <span class="text-xs font-bold text-zinc-400">Saldo</span>
                    <span
                      class="text-sm font-black"
                      :class="
                        m.income - m.expense >= 0
                          ? 'text-primary-500'
                          : 'text-red-500'
                      "
                    >
                      {{ formatCurrency(m.income - m.expense) }}
                    </span>
                  </div>
                </div>
              </template>

              <div
                class="flex items-end gap-1 w-full justify-center transition-all duration-300 group-hover:opacity-80 group-hover:-translate-y-0.5"
              >
                <div
                  class="w-4 rounded-t-lg bg-primary-500 dark:bg-primary-500/80 shadow-[0_-4px_12px_rgba(34,197,94,0.15)] transition-all duration-500"
                  :style="{ height: `${barHeight(m.income)}px` }"
                />
                <div
                  class="w-4 rounded-t-lg bg-red-500 dark:bg-red-500/80 shadow-[0_-4px_12px_rgba(239,68,68,0.15)] transition-all duration-500"
                  :style="{ height: `${barHeight(m.expense)}px` }"
                />
              </div>
            </UTooltip>

            <!-- Label mês -->
            <span
              class="text-[10px] font-black text-zinc-400 uppercase tracking-widest group-hover:text-zinc-600 dark:group-hover:text-zinc-200 transition-colors"
            >
              {{ m.label }}
            </span>
          </div>
        </div>
      </UCard>

      <!-- Card de resumo financeiro -->
      <UCard class="flex flex-col">
        <template #header>
          <h3
            class="text-sm font-black uppercase tracking-widest text-zinc-400"
          >
            Resumo no Período
          </h3>
        </template>

        <div class="flex-1 flex flex-col justify-between space-y-5">
          <div class="space-y-5">
            <!-- Receitas -->
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-3">
                <div
                  class="w-9 h-9 rounded-xl bg-green-50 dark:bg-green-500/10 flex items-center justify-center"
                >
                  <UIcon
                    name="i-heroicons-arrow-down-left"
                    class="w-4 h-4 text-green-500"
                  />
                </div>
                <div>
                  <p
                    class="text-xs font-black uppercase tracking-widest text-zinc-400"
                  >
                    Receitas
                  </p>
                  <p class="text-base font-black text-zinc-900 dark:text-white">
                    {{ formatCurrency(incomeFiltered) }}
                  </p>
                </div>
              </div>
            </div>

            <!-- Despesas -->
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-3">
                <div
                  class="w-9 h-9 rounded-xl bg-red-50 dark:bg-red-500/10 flex items-center justify-center"
                >
                  <UIcon
                    name="i-heroicons-arrow-up-right"
                    class="w-4 h-4 text-red-500"
                  />
                </div>
                <div>
                  <p
                    class="text-xs font-black uppercase tracking-widest text-zinc-400"
                  >
                    Despesas
                  </p>
                  <p class="text-base font-black text-zinc-900 dark:text-white">
                    {{ formatCurrency(expenseFiltered) }}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div class="space-y-5">
            <div class="h-px bg-zinc-100 dark:bg-zinc-800" />

            <!-- Saldo -->
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-3">
                <div
                  class="w-9 h-9 rounded-xl flex items-center justify-center"
                  :class="
                    balanceFiltered >= 0
                      ? 'bg-primary-50 dark:bg-primary-500/10'
                      : 'bg-red-50 dark:bg-red-500/10'
                  "
                >
                  <UIcon
                    name="i-heroicons-scale"
                    class="w-4 h-4"
                    :class="
                      balanceFiltered >= 0 ? 'text-primary-500' : 'text-red-500'
                    "
                  />
                </div>
                <div>
                  <p
                    class="text-xs font-black uppercase tracking-widest text-zinc-400"
                  >
                    Saldo
                  </p>
                  <p
                    class="text-base font-black"
                    :class="
                      balanceFiltered >= 0
                        ? 'text-primary-600 dark:text-primary-400'
                        : 'text-red-600 dark:text-red-400'
                    "
                  >
                    {{ formatCurrency(balanceFiltered) }}
                  </p>
                </div>
              </div>
            </div>

            <div class="h-px bg-zinc-100 dark:bg-zinc-800" />

            <!-- Vendas pendentes + Produtos ativos -->
            <div class="grid grid-cols-2 gap-3">
              <div
                class="rounded-xl bg-zinc-50 dark:bg-zinc-800/50 p-3 text-center"
              >
                <p class="text-xl font-black text-amber-500">
                  {{ pendingSales }}
                </p>
                <p
                  class="text-[10px] font-black uppercase tracking-wider text-zinc-400 mt-0.5"
                >
                  Pendentes
                </p>
              </div>
              <div
                class="rounded-xl bg-zinc-50 dark:bg-zinc-800/50 p-3 text-center"
              >
                <p class="text-xl font-black text-primary-500">
                  {{ activeProducts }}
                </p>
                <p
                  class="text-[10px] font-black uppercase tracking-wider text-zinc-400 mt-0.5"
                >
                  Produtos
                </p>
              </div>
            </div>
          </div>
        </div>
      </UCard>
    </div>

    <!-- ─── Listas: Transações + Vendas + Vendedores ──────────── -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 pb-4">
      <template v-if="txPending">
        <div class="space-y-3">
          <USkeleton v-for="i in 6" :key="i" class="h-14 rounded-xl" />
        </div>
        <div class="space-y-3">
          <USkeleton v-for="i in 5" :key="i" class="h-14 rounded-xl" />
        </div>
        <div class="space-y-3">
          <USkeleton v-for="i in 5" :key="i" class="h-14 rounded-xl" />
        </div>
      </template>
      <template v-else>
        <DashboardRecentTransactions
          :transactions="recentTransactions"
          class="h-full"
        />
        <DashboardRecentSales :sales="recentSales" class="h-full" />

        <!-- Top Vendedores -->
        <UCard class="flex flex-col h-full">
          <template #header>
            <div class="flex items-center justify-between">
              <h3
                class="text-sm font-black uppercase tracking-widest text-zinc-400"
              >
                Top Vendedores
              </h3>
              <UBadge color="primary" variant="soft" size="sm">
                No Período
              </UBadge>
            </div>
          </template>

          <div
            v-if="topSellers.length === 0"
            class="flex flex-col items-center justify-center py-10 text-zinc-400 flex-1"
          >
            <UIcon name="i-heroicons-users" class="w-10 h-10 mb-2 opacity-40" />
            <p class="text-sm font-bold">Nenhuma venda com vendedor</p>
          </div>

          <div
            v-else
            class="divide-y divide-zinc-100 dark:divide-zinc-800 -mx-4 -my-3 px-1 flex-1"
          >
            <div
              v-for="(seller, idx) in topSellers"
              :key="seller.name"
              class="flex items-center gap-4 py-3.5 px-3 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors group"
            >
              <!-- Posição -->
              <div
                class="w-8 h-8 rounded-full flex items-center justify-center font-black text-xs shrink-0"
                :class="
                  idx === 0
                    ? 'bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400'
                    : idx === 1
                      ? 'bg-zinc-200 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300'
                      : idx === 2
                        ? 'bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-400'
                        : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400'
                "
              >
                {{ idx + 1 }}º
              </div>

              <!-- Nome e Vendas -->
              <div class="flex-1 min-w-0">
                <p
                  class="text-sm font-bold text-zinc-800 dark:text-zinc-200 truncate"
                >
                  {{ seller.name }}
                </p>
                <p class="text-xs text-zinc-400 mt-0.5">
                  {{ seller.count }} venda{{ seller.count > 1 ? "s" : "" }}
                </p>
              </div>

              <!-- Total -->
              <div class="text-right shrink-0">
                <p
                  class="text-sm font-black text-primary-600 dark:text-primary-400"
                >
                  {{ formatCurrency(seller.total) }}
                </p>
              </div>
            </div>
          </div>
        </UCard>
      </template>
    </div>
  </div>
</template>
