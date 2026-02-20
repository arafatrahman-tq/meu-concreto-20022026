export default defineNuxtRouteMiddleware((to) => {
  const { isLoggedIn } = useAuth()

  // If the user attempts to access any page EXCEPT /login without being logged in
  if (!isLoggedIn.value && to.path !== '/login') {
    return navigateTo('/login')
  }

  // If the user attempts to access /login while already logged in
  if (isLoggedIn.value && to.path === '/login') {
    return navigateTo('/')
  }
})
