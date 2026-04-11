import { createRouter, createWebHistory } from 'vue-router'
import { routes } from './routes'
import { UserRole } from '@/types/auth.types'
import { jwtDecode } from 'jwt-decode'
import type { CurrentUser } from '@/types/auth.types'

declare module 'vue-router' {
  interface RouteMeta {
    role?: UserRole
    public?: boolean
  }
}

const ROLE_HOME: Record<UserRole, string> = {
  [UserRole.Client]: '/client/marketplace',
  [UserRole.Supplier]: '/supplier/organizations',
  [UserRole.Courier]: '/courier/deliveries',
  [UserRole.Admin]: '/admin/pending',
}

const getRole = (): UserRole | null => {
  const token = localStorage.getItem('access_token')
  if (!token) return null
  try {
    const decoded = jwtDecode<CurrentUser>(token)
    return decoded.role
  } catch {
    return null
  }
}

const router = createRouter({
  history: createWebHistory(),
  routes,
})

router.beforeEach((to) => {
  const role = getRole()
  const isAuthRoute = to.path === '/login' || to.path === '/register'
  const isPublic = to.matched.some((r) => r.meta.public)

  if (!role && !isAuthRoute && !isPublic) {
    return '/login'
  }

  if (role && isAuthRoute) {
    return ROLE_HOME[role]
  }

  const requiredRole = to.matched.find((r) => r.meta.role)?.meta.role as UserRole | undefined

  if (requiredRole && role !== requiredRole) {
    return role ? ROLE_HOME[role] : '/login'
  }
})

export default router
