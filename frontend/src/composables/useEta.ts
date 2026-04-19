import { computed, ref, type Ref } from 'vue'
import type { OptimizedRoute, RouteWaypoint } from '@/types/routing.types'
import { CourierStatsApi, type CourierSpeedStats } from '@/api/courier-stats.api'

type LatLng = { lat: number; lng: number }

const R_KM = 6371
const toRad = (deg: number) => deg * (Math.PI / 180)

const haversineKm = (a: LatLng, b: LatLng): number => {
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R_KM * Math.asin(Math.sqrt(s))
}

export interface WaypointEta {
  distanceKm: number
  minutes: number
  arrivalAt: Date
}

export const useEta = (
  routes: Ref<OptimizedRoute[]>,
  courierPos: Ref<LatLng | null>,
) => {
  const stats = ref<CourierSpeedStats | null>(null)
  const statsLoading = ref(false)

  const fetchStats = async () => {
    statsLoading.value = true
    try {
      stats.value = await CourierStatsApi.getMySpeed()
    } catch {
      stats.value = null
    } finally {
      statsLoading.value = false
    }
  }

  const speedKmh = computed(() => stats.value?.avgSpeedKmh ?? 25)

  const etaByWaypoint = computed<Map<RouteWaypoint, WaypointEta>>(() => {
    const map = new Map<RouteWaypoint, WaypointEta>()
    const now = Date.now()

    let cumulativeKm = 0
    let lastPos: LatLng | null = courierPos.value
    let lastActiveWp: RouteWaypoint | null = null

    for (const route of routes.value) {
      let firstActiveInRoute = true
      for (const wp of route.waypoints) {
        if (wp.completed) continue

        let segKm: number
        if (firstActiveInRoute) {
          const ref = lastActiveWp ?? lastPos
          segKm = ref ? haversineKm(ref, wp) : 0
        } else {
          segKm = wp.distanceFromPrevKm
        }

        cumulativeKm += segKm
        const minutes = (cumulativeKm / speedKmh.value) * 60
        map.set(wp, {
          distanceKm: cumulativeKm,
          minutes,
          arrivalAt: new Date(now + minutes * 60 * 1000),
        })

        lastActiveWp = wp
        firstActiveInRoute = false
      }
    }

    return map
  })

  return {
    stats,
    statsLoading,
    speedKmh,
    etaByWaypoint,
    fetchStats,
  }
}
