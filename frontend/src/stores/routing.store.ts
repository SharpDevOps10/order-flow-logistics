import { ref } from 'vue'
import { defineStore } from 'pinia'
import { RoutingApi } from '@/api/routing.api'
import type { OptimizedRoute } from '@/types/routing.types'

const extractErrorMessage = (error: unknown): string => {
  if (error && typeof error === 'object' && 'response' in error) {
    const axiosError = error as { response?: { data?: { message?: string } } }
    return axiosError.response?.data?.message ?? 'An error occurred'
  }
  return 'An error occurred'
}

export const useRoutingStore = defineStore('routing', () => {
  const routes = ref<OptimizedRoute[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  const fetchRoute = async () => {
    loading.value = true
    error.value = null
    try {
      routes.value = await RoutingApi.getRoute()
    } catch (e: unknown) {
      error.value = extractErrorMessage(e)
    } finally {
      loading.value = false
    }
  }

  return { routes, loading, error, fetchRoute }
})
