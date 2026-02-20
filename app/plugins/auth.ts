export default defineNuxtPlugin(() => {
  const { clearUser } = useAuth()
  const route = useRoute()

  // Intercept all $fetch errors globally (ofetch)
  const originalFetch = globalThis.$fetch

  if (import.meta.client) {
    globalThis.$fetch = originalFetch.create({
      onResponseError({ response }) {
        if (response.status === 401 && route.path !== '/login') {
          clearUser()
          navigateTo('/login')
        }
      }
    })
  }
})
