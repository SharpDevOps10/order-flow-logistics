import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { jwtDecode } from 'jwt-decode'
import { AuthApi } from '@/api/auth.api'
import type { CurrentUser, SignUpDto, SignInDto } from '@/types/auth.types'

const extractErrorMessage = (error: unknown): string => {
  if (error && typeof error === 'object' && 'response' in error) {
    const axiosError = error as { response?: { data?: { message?: string } } }
    return axiosError.response?.data?.message ?? 'An error occurred'
  }
  return 'An error occurred'
}

export const useAuthStore = defineStore('auth', () => {
  const accessToken = ref<string | null>(localStorage.getItem('access_token'))
  const loading = ref(false)
  const error = ref<string | null>(null)

  const user = computed<CurrentUser | null>(() => {
    if (!accessToken.value) return null
    try {
      return jwtDecode<CurrentUser>(accessToken.value)
    } catch {
      return null
    }
  })

  const role = computed(() => user.value?.role ?? null)
  const isAuthenticated = computed(() => !!accessToken.value)

  const setTokens = (tokens: { access_token: string; refresh_token: string }) => {
    accessToken.value = tokens.access_token
    localStorage.setItem('access_token', tokens.access_token)
    localStorage.setItem('refresh_token', tokens.refresh_token)
  }

  const clearTokens = () => {
    accessToken.value = null
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
  }

  const signUp = async (dto: SignUpDto) => {
    loading.value = true
    error.value = null
    try {
      const tokens = await AuthApi.signUp(dto)
      setTokens(tokens)
    } catch (e: unknown) {
      error.value = extractErrorMessage(e)
      throw e
    } finally {
      loading.value = false
    }
  }

  const signIn = async (dto: SignInDto) => {
    loading.value = true
    error.value = null
    try {
      const tokens = await AuthApi.signIn(dto)
      setTokens(tokens)
    } catch (e: unknown) {
      error.value = extractErrorMessage(e)
      throw e
    } finally {
      loading.value = false
    }
  }

  const logout = async () => {
    try {
      await AuthApi.logout()
    } finally {
      clearTokens()
    }
  }

  return { accessToken, loading, error, user, role, isAuthenticated, signUp, signIn, logout }
})
