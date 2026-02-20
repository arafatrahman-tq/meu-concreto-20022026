// ─────────────────────────────────────────────
// useAuth — persisted session composable (multi-tenant)
// ─────────────────────────────────────────────

export interface AuthCompany {
  id: number
  name: string
  role: string // role within this company
}

export interface AuthUser {
  id: number
  name: string
  email: string
  role: string
  companyId: number | null // primary / legacy company
}

export const useAuth = () => {
  const cookieOpts = {
    maxAge: 60 * 60 * 24 * 7, // 7 days
    sameSite: 'lax' as const
  }

  const user = useCookie<AuthUser | null>('mc_user', {
    default: () => null,
    ...cookieOpts
  })

  const companies = useCookie<AuthCompany[]>('mc_companies', {
    default: () => [],
    ...cookieOpts
  })

  const activeCompanyId = useCookie<number | null>('mc_active_company', {
    default: () => null,
    ...cookieOpts
  })

  const isLoggedIn = computed(() => !!user.value)

  // Active company object resolved from the list
  const activeCompany = computed(
    () =>
      companies.value?.find(c => c.id === activeCompanyId.value)
      ?? companies.value?.[0]
      ?? null
  )

  // Shorthand companyId for all pages — avoids repeating this expression everywhere
  const companyId = computed(
    () => activeCompanyId.value ?? user.value?.companyId ?? 1
  )

  const setUser = (u: AuthUser, comps: AuthCompany[] = []) => {
    user.value = u
    companies.value = comps
    // Set active company on first login or if previous selection is no longer valid
    const stillValid = comps.find(c => c.id === activeCompanyId.value)
    if (!stillValid) {
      activeCompanyId.value = comps[0]?.id ?? u.companyId ?? null
    }
  }

  const switchCompany = (id: number) => {
    activeCompanyId.value = id
  }

  const clearUser = () => {
    user.value = null
    companies.value = []
    activeCompanyId.value = null
  }

  return {
    user,
    companies,
    activeCompanyId,
    activeCompany,
    companyId,
    isLoggedIn,
    setUser,
    clearUser,
    switchCompany
  }
}
