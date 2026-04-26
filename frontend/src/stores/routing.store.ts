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
  const firstSegmentKm = ref<number | null>(null)
  const firstSegmentDurationSec = ref<number | null>(null)
  const firstSegmentAt = ref<number | null>(null)
  const liveAvgSpeedKmh = ref<number | null>(null)
  const liveIsFallbackSpeed = ref<boolean | null>(null)

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

  const setFirstSegment = (
    km: number,
    at: number,
    avgSpeedKmh?: number,
    isFallbackSpeed?: boolean,
    durationSec?: number,
  ) => {
    firstSegmentKm.value = km
    firstSegmentAt.value = at
    if (durationSec !== undefined) firstSegmentDurationSec.value = durationSec
    if (avgSpeedKmh !== undefined) liveAvgSpeedKmh.value = avgSpeedKmh
    if (isFallbackSpeed !== undefined) liveIsFallbackSpeed.value = isFallbackSpeed
  }

  return {
    routes,
    loading,
    error,
    firstSegmentKm,
    firstSegmentDurationSec,
    firstSegmentAt,
    liveAvgSpeedKmh,
    liveIsFallbackSpeed,
    fetchRoute,
    setFirstSegment,
  }
})
