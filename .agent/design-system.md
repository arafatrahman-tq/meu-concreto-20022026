# Meu Concreto — Design System

> Este documento é a fonte de verdade para todo agente ou desenvolvedor que implementar novas páginas, componentes ou funcionalidades na aplicação. **Toda nova implementação DEVE seguir estas diretrizes.**

---

## 1. Paleta de Cores

### Primária (Brand)

| Token         | Valor                       | Uso                                    |
| ------------- | --------------------------- | -------------------------------------- |
| `primary`     | `green` (Tailwind / NuxtUI) | CTAs, links ativos, badges de destaque |
| `primary-50`  | `#f0fdf4`                   | Backgrounds sutis                      |
| `primary-100` | `#dcfce7`                   | Hover states, selected backgrounds     |
| `primary-500` | `#22c55e`                   | Ícones ativos, bordas de destaque      |
| `primary-600` | `#16a34a`                   | Botões primários                       |
| `primary-700` | `#15803d`                   | Hover em botões primários              |

### Neutros (Base)

| Token            | Tailwind                      | Uso                      |
| ---------------- | ----------------------------- | ------------------------ |
| `neutral`        | `zinc`                        | Textos, bordas, fundos   |
| Fundo geral      | `zinc-50` / dark: `zinc-950`  | Layout raiz              |
| Fundo sidebar    | `white` / dark: `zinc-950`    | Painel lateral           |
| Fundo cards      | `white` / dark: `zinc-900`    | UCard, widgets           |
| Bordas           | `zinc-200` / dark: `zinc-800` | Divisórias, rings        |
| Texto primário   | `zinc-900` / dark: `white`    | Headings, labels         |
| Texto secundário | `zinc-500` / dark: `zinc-400` | Subtítulos, metadados    |
| Texto muted      | `zinc-400` / dark: `zinc-600` | Placeholders, timestamps |

### Status / Semântico

| Cor               | Token       | Uso                             |
| ----------------- | ----------- | ------------------------------- |
| Sucesso / Receita | `green-500` | Transações positivas, status OK |
| Alerta / Pendente | `amber-500` | Status pendente, avisos         |
| Erro / Despesa    | `red-500`   | Transações negativas, erros     |
| Info / Neutro     | `blue-500`  | Informações contextuais         |

---

## 2. Tipografia

```text
Font family: Bahnschrift (primary) — sistema Windows, sem import externo
Fallback chain: "DIN Alternate", "Franklin Gothic Medium", "Arial Narrow", Arial, sans-serif
```

> **Nota para o agente:** Bahnschrift é uma fonte do sistema Windows (disponível nativamente desde Win10). Em macOS usa "DIN Alternate"; em Linux usa "Franklin Gothic Medium" ou "Arial Narrow". Não adicionar import de Google Fonts para esta fonte.

| Estilo        | Classes Tailwind                                             | Uso                   |
| ------------- | ------------------------------------------------------------ | --------------------- |
| Page Title    | `text-2xl font-black text-zinc-900`                          | H1 de cada página     |
| Section Title | `text-sm font-black uppercase tracking-widest text-zinc-400` | Labels de seção       |
| Card Title    | `text-sm font-bold text-zinc-900`                            | Títulos de cards      |
| KPI Value     | `text-3xl font-black text-zinc-900`                          | Valores principais    |
| KPI Label     | `text-xs font-bold text-zinc-500 uppercase tracking-widest`  | Rótulos de KPIs       |
| Body          | `text-sm text-zinc-700`                                      | Conteúdo geral        |
| Caption       | `text-xs text-zinc-400`                                      | Timestamps, metadados |
| Badge         | `text-[10px] font-black uppercase tracking-[0.15em]`         | Status badges         |

---

## 3. Layout & Espaçamento

### Grid Sistema

- **Sidebar**: `w-72` (288px) — fixa, visível em `lg+`
- **Header**: `h-20` — sticky, `backdrop-blur-xl`
- **Content padding**: `p-8` em desktop, `p-4` em mobile
- **Gap padrão entre cards**: `gap-6`
- **Grid KPIs**: `grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6`
- **Grid dashboard**: `grid-cols-1 lg:grid-cols-3 gap-6`

### Border Radius

| Elemento         | Classe         |
| ---------------- | -------------- |
| Cards principais | `rounded-2xl`  |
| Botões           | `rounded-xl`   |
| Badges / Pills   | `rounded-full` |
| Inputs           | `rounded-xl`   |
| Ícone containers | `rounded-xl`   |
| Avatares         | `rounded-full` |

### Sombras

| Nível      | Classe                 | Uso                           |
| ---------- | ---------------------- | ----------------------------- |
| Elevação 0 | `ring-1 ring-zinc-200` | Cards base (via UCard config) |
| Elevação 1 | `shadow-sm`            | Cards interativos             |
| Elevação 2 | `shadow-lg`            | Modais, dropdowns             |
| Sidebar    | `shadow-2xl`           | Painel lateral                |

---

## 4. Componentes Padrão

### UCard

Sempre usar `UCard` do NuxtUI para containers de conteúdo. O `ring-1` já é aplicado via `app.config.ts`.

**Header padrão de card/tabela** — label à esquerda, controles à direita (`flex items-center justify-between`):

```vue
<UCard>
  <template #header>
    <div class="flex items-center justify-between gap-4">
      <h3 class="text-sm font-black uppercase tracking-widest text-zinc-400 shrink-0">Título</h3>
      <!-- controles: search, filtros, badge, botão -->
      <div class="flex items-center gap-2 flex-wrap justify-end">
        <UInput size="sm" placeholder="Buscar..." class="w-44 lg:w-56" />
        <UBadge color="success" variant="soft">Status</UBadge>
      </div>
    </div>
  </template>
  <!-- conteúdo -->
</UCard>
```

> **Regra:** Nunca usar `flex-col / sm:flex-row` no header de cards — sempre `flex items-center justify-between` direto.

### KPI Card

Padrão para todos os cards de métricas:

```vue
<!-- Estrutura obrigatória para KPI cards -->
<div class="rounded-2xl bg-white dark:bg-zinc-900 ring-1 ring-zinc-200 dark:ring-zinc-800 p-6 flex flex-col gap-4">
  <!-- Ícone + label -->
  <div class="flex items-center justify-between">
    <span class="text-xs font-black uppercase tracking-widest text-zinc-400">LABEL</span>
    <div class="w-9 h-9 rounded-xl bg-primary-50 dark:bg-primary-500/10 flex items-center justify-center">
      <UIcon name="i-heroicons-..." class="w-5 h-5 text-primary-500" />
    </div>
  </div>
  <!-- Valor principal -->
  <span class="text-3xl font-black text-zinc-900 dark:text-white">R$ 0,00</span>
  <!-- Delta / tendência -->
  <div class="flex items-center gap-1.5 text-xs font-bold text-green-500">
    <UIcon name="i-heroicons-arrow-trending-up" class="w-4 h-4" />
    <span>+2,45% vs. mês anterior</span>
  </div>
</div>
```

### Status Badges

Usar `UBadge` com variante `soft`. **NuxtUI v4 usa nomes semânticos**, não cores Tailwind diretamente:

| Status                                   | Color (NuxtUI v4) |
| ---------------------------------------- | ----------------- |
| `active` / `completed` / `paid`          | `success`         |
| `pending` / `draft` / `sent`             | `warning`         |
| `cancelled` / `rejected`                 | `error`           |
| `in_progress` / `approved` / `confirmed` | `info`            |
| `expired` / genérico                     | `neutral`         |

```vue
<UBadge color="success" variant="soft" size="sm">Pago</UBadge>
<UBadge color="warning" variant="soft" size="sm">Pendente</UBadge>
<UBadge color="error" variant="soft" size="sm">Cancelado</UBadge>
<UBadge color="info" variant="soft" size="sm">Em Andamento</UBadge>
```

### Botões de Ação

```vue
<!-- Primário -->
<UButton color="primary" icon="i-heroicons-plus">Nova Venda</UButton>

<!-- Secundário / Ghost -->
<UButton
  color="neutral"
  variant="ghost"
  icon="i-heroicons-arrow-right"
>Ver Todos</UButton>

<!-- Destrutivo -->
<UButton color="red" variant="soft" icon="i-heroicons-trash">Excluir</UButton>
```

### Ícones

Usar exclusivamente os packs instalados:

- `i-heroicons-*` — ícones de UI geral (navegação, ações, status)
- `i-lucide-*` — ícones de domínio (negócios, documentos, gráficos)
- `i-simple-icons-*` — logos de marcas (pagamentos, tecnologias)

---

## 5. NuxtUI v4 — Referência de API (Correções Críticas)

> **Atenção:** NuxtUI v4 mudou diversas APIs em relação à v3. Sempre usar os padrões abaixo.

### UDropdownMenu — Itens

O handler de clique é `onSelect`, **não** `click` (propriedade v3 removida):

```ts
// ✅ CORRETO — NuxtUI v4
const items = [
  {
    label: "Editar",
    icon: "i-heroicons-pencil-square",
    onSelect: () => openEdit(row),
  },
  {
    label: "Excluir",
    icon: "i-heroicons-trash",
    color: "error" as const,
    onSelect: () => confirmDelete(row),
  },
]

// ❌ ERRADO — API v3
{ label: "Editar", click: () => openEdit(row) }
```

Grupos são arrays de arrays: `items: DropdownMenuItem[][]` — cada array interno é um grupo separado por divisória.

### UInputMenu — Autocomplete Combobox

- `v-model` recebe o **objeto completo** (não string), ou `undefined` para vazio
- `label-key` (não `option-attribute`) define qual campo exibir — padrão: `"label"`
- `v-model:search-term` controla o texto digitado independentemente da seleção
- `ignore-filter` desabilita filtro interno (para busca em API externa)
- `filter-fields` define os campos usados no filtro interno (padrão: `[labelKey]`)

```vue
<!-- ✅ CORRETO -->
<UInputMenu
  v-model="selectedItem"
  v-model:search-term="searchTerm"
  :items="filteredItems"
  label-key="name"
  placeholder="Buscar..."
  open-on-focus
/>

<!-- ❌ ERRADO — 'option-attribute' não existe em v4 -->
<UInputMenu option-attribute="label" ... />
```

### USelect — Seletor Simples

- `value-key` define o campo usado como valor (padrão: `"value"`)
- `label-key` define o campo exibido (padrão: `"label"`)
- `v-model` recebe o valor primitivo (não o objeto), conforme `value-key`

```vue
<USelect
  v-model="form.status"
  :items="STATUS_OPTS"
  value-key="value"
  label-key="label"
/>
```

### USlideover — Largura Customizada

A largura não pode ser sobrescrita apenas com `:ui.content` porque a classe `max-w-md` do variante `side: right` tem precedência em `twMerge`. A forma correta é via `app.config.ts`:

```ts
// app.config.ts ✅
export default defineAppConfig({
  ui: {
    slideover: {
      variants: {
        side: {
          right: {
            content: "max-w-none sm:w-[680px] lg:w-[860px] xl:w-[960px]",
          },
        },
      },
    },
  },
});
```

No componente, usar apenas `:ui="{ content: 'w-full' }"` para garantir 100% em mobile.

### UBadge — Cores Semânticas (v4)

Apenas cores semânticas — **não usar cores Tailwind diretamente** como `color="green"`:

```vue
<!-- ✅ -->
<UBadge color="success" variant="soft">Pago</UBadge>
<UBadge color="warning" variant="soft">Pendente</UBadge>
<UBadge color="error" variant="soft">Cancelado</UBadge>
<UBadge color="info" variant="soft">Em Andamento</UBadge>
<UBadge color="neutral" variant="soft">Expirado</UBadge>

<!-- ❌ — color="green" não é semântico em v4 -->
<UBadge color="green" ...>
```

### UFormField — Wrapper de Inputs

`UFormField` aceita `label` e envolve o input filho. Para full-width em grid, usar `class="col-span-full"`:

```vue
<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
  <UFormField label="Nome *" class="col-span-full">
    <UInput v-model="form.name" class="w-full" />
  </UFormField>
  <UFormField label="Telefone">
    <UInput v-model="form.phone" class="w-full" />
  </UFormField>
</div>
```

---

## 6. Navegação Lateral

Ordem dos itens no `NavigationMenu` (não alterar sem motivo):

```text
1. Dashboard        /              i-heroicons-squares-2x2
2. Orçamentos       /orcamentos     i-heroicons-document-text
3. Vendas           /vendas         i-heroicons-shopping-cart
4. Produtos         /produtos       i-lucide-package
5. Transações       /transacoes     i-heroicons-arrows-right-left
6. Empresas         /empresas       i-heroicons-building-office-2
7. Usuários         /usuarios       i-heroicons-users
--- separator ---
8. Configurações    /configuracoes  i-heroicons-cog-6-tooth
```

### Item ativo

```vue
<!-- Item ativo usa fundo primary com texto branco -->
<NuxtLink
  class="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all"
  active-class="bg-primary-500 text-white shadow-lg shadow-primary-500/20"
  exact-active-class="bg-primary-500 text-white"
  inactive-class="text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-white"
>
```

---

## 7. Formatação de Dados

### Moeda (BRL)

```ts
// Sempre usar para valores monetários — valores em centavos no banco
const formatCurrency = (cents: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    cents / 100,
  );
```

### Datas

```ts
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const formatDate = (date: Date | number) =>
  format(new Date(date), "dd MMM yyyy", { locale: ptBR });

const formatDateTime = (date: Date | number) =>
  format(new Date(date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
```

### Números

```ts
const formatNumber = (n: number) => new Intl.NumberFormat("pt-BR").format(n);
```

---

## 8. Padrões de Página

### Estrutura obrigatória de cada página

```vue
<script setup lang="ts">
// 1. Definir layout se não for o default
definePageMeta({ layout: "default" });

// 2. SEO
useSeoMeta({ title: "Página | Meu Concreto" });

// 3. Fetch de dados
const { data, pending, error } = await useFetch("/api/resource");
</script>

<template>
  <div class="p-8 space-y-8">
    <!-- Page Header -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-black text-zinc-900 dark:text-white">
          Título da Página
        </h1>
        <p class="text-sm text-zinc-500 mt-1">Subtítulo descritivo</p>
      </div>
      <UButton color="primary" icon="i-heroicons-plus">Ação Principal</UButton>
    </div>

    <!-- Conteúdo -->
  </div>
</template>
```

### Estados de loading

```vue
<!-- Skeleton para KPI cards -->
<USkeleton class="h-36 rounded-2xl" v-if="pending" />

<!-- Skeleton para tabelas -->
<div v-if="pending" class="space-y-3">
  <USkeleton v-for="i in 5" :key="i" class="h-14 rounded-xl" />
</div>

<!-- Estado vazio -->
<div class="flex flex-col items-center justify-center py-16 text-zinc-400">
  <UIcon name="i-heroicons-inbox" class="w-12 h-12 mb-3" />
  <p class="text-sm font-bold">Nenhum registro encontrado</p>
</div>
```

---

## 9. Sparlines / Mini Gráficos (SVG inline)

Para mini gráficos nos KPI cards, usar SVG inline simples — **sem bibliotecas externas**:

```vue
<!-- Sparkline ascendente -->
<svg viewBox="0 0 80 32" class="w-20 h-8 text-green-500" fill="none">
  <polyline
    :points="sparklinePoints(data)"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
</svg>

<!-- Função auxiliar (composable) -->
const sparklinePoints = (values: number[]) => { const max = Math.max(...values)
const min = Math.min(...values) return values.map((v, i) => { const x = (i /
(values.length - 1)) * 80 const y = 32 - ((v - min) / (max - min || 1)) * 28 + 2
return `${x},${y}` }).join(' ') }
```

---

## 10. Responsividade

| Breakpoint | Largura | Comportamento                           |
| ---------- | ------- | --------------------------------------- |
| `sm`       | 640px   | KPI grid passa para 2 colunas           |
| `md`       | 768px   | Header itens extras aparecem            |
| `lg`       | 1024px  | Sidebar visível, grid 3 colunas         |
| `xl`       | 1280px  | KPI grid 4 colunas, mais info no header |

---

## 12. Padrão de Toggles & Automação

Para switches de configuração e automação (especialmente em Configurações), usar a estrutura abaixo para garantir consistência visual.

### Toggle Row (Padrão)

Utilizar um container arredondado com ícone decorativo à esquerda, texto central e switch à direita.

```vue
<div class="flex items-center justify-between gap-4 p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/50">
  <div class="flex items-center gap-3">
    <!-- Icon Container -->
    <div class="w-8 h-8 rounded-lg bg-primary-100 dark:bg-primary-500/10 flex items-center justify-center">
      <UIcon name="i-heroicons-..." class="w-4 h-4 text-primary-500" />
    </div>
    <!-- Label & Desc -->
    <div>
      <p class="text-sm font-medium text-zinc-700 dark:text-zinc-300">Título do Switch</p>
      <p class="text-[10px] text-zinc-400">Descrição curta do que esta opção faz</p>
    </div>
  </div>
  <USwitch v-model="state" color="success" />
</div>
```

### Seção de Conteúdo Expansível

Sempre envolver conteúdos dependentes do switch em um componente `<Transition>` para uma experiência fluida.

```vue
<Transition
  enter-active-class="transition-all duration-300 ease-out"
  enter-from-class="opacity-0 -translate-y-2 max-h-0"
  enter-to-class="opacity-100 translate-y-0 max-h-[800px]"
  leave-active-class="transition-all duration-200 ease-in"
  leave-from-class="opacity-100 translate-y-0 max-h-[800px]"
  leave-to-class="opacity-0 -translate-y-2 max-h-0"
>
  <div v-if="state" class="space-y-3 overflow-hidden">
     <!-- Conteúdo adicional (inputs, listas, etc) -->
  </div>
</Transition>
```

### Listas Dinâmicas (Destinatários/Itens)

Para listas de exclusão/adição, usar o padrão de botões com bordas tracejadas:

- **Input**: `size="sm"` com ícone pertinente.
- **Botão Adicionar**: `variant="ghost" color="neutral"` com bordas `border-2 border-dashed`.
- **Botão Remover**: `variant="ghost" color="error"`.

```vue
<UButton
  color="neutral"
  variant="ghost"
  icon="i-heroicons-plus"
  size="sm"
  class="w-full justify-center border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl py-2"
>
  Adicionar Item
</UButton>
```

---

## 13. Regras Gerais do Agente

1. **Nunca usar cores hardcoded** — sempre usar classes Tailwind ou tokens do design system.
2. **Nunca usar `style=""`** — toda estilização via classes Tailwind.
3. **Sempre suportar dark mode** — todo novo elemento deve ter variante `dark:`.
4. **Sempre usar `UCard`** para containers de conteúdo, nunca `div` simples para cards.
5. **Sempre usar `UButton`** para ações interativas, nunca `<button>` nativo.
6. **Sempre formatar moeda** com `formatCurrency(cents)` — valores no banco são em centavos.
7. **Sempre formatar datas** com `date-fns` e locale `pt-BR`.
8. **Sempre adicionar estados** de `pending`, `error` e vazio em páginas com fetch.
9. **Nunca adicionar bibliotecas de gráficos** — usar SVG inline conforme padrão acima.
10. **Sempre seguir a ordem da navegação** definida na seção 5, sem criar itens extras sem aprovação.
