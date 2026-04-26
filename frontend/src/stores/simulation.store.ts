import { computed, ref, watch } from 'vue'
import { defineStore } from 'pinia'
import type { OptimizedRoute } from '@/types/routing.types'

type LatLng = { lat: number; lng: number }

const R_KM = 6371
const toRad = (deg: number) => deg * (Math.PI / 180)

const haversineKm = (a: LatLng, b: LatLng): number => {
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const s = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R_KM * Math.asin(Math.sqrt(s))
}

const interpolate = (a: LatLng, b: LatLng, t: number): LatLng => ({
  lat: a.lat + (b.lat - a.lat) * t,
  lng: a.lng + (b.lng - a.lng) * t,
})

const flattenRoutes = (routes: OptimizedRoute[]): LatLng[] => {
  const points: LatLng[] = []
  for (const route of routes) {
    if (route.geometry && route.geometry.length > 0) {
      for (const segment of route.geometry) {
        for (const [lat, lng] of segment) {
          const last = points[points.length - 1]
          if (!last || last.lat !== lat || last.lng !== lng) {
            points.push({ lat, lng })
          }
        }
      }
    } else {
      for (const wp of route.waypoints) {
        points.push({ lat: wp.lat, lng: wp.lng })
      }
    }
  }
  return points
}

const routeSignature = (points: LatLng[], routesCount: number): string => {
  if (points.length === 0) return ''
  const first = points[0]
  const last = points[points.length - 1]
  return `${routesCount}:${points.length}:${first.lat.toFixed(5)},${first.lng.toFixed(5)}:${last.lat.toFixed(5)},${last.lng.toFixed(5)}`
}

const STORAGE_KEY = 'courier-sim-state'

type PersistedState = {
  enabled: boolean
  running: boolean
  speedKmh: number
  segmentIndex: number
  progressInSegment: number
  routeSig: string
}

const loadPersisted = (): PersistedState | null => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as PersistedState) : null
  } catch {
    return null
  }
}

const savePersisted = (data: PersistedState) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch {
    // ignore
  }
}

const clearPersisted = () => {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
}

const TICK_MS = 1000

export const useSimulationStore = defineStore('simulation', () => {
  const persisted = loadPersisted()

  const enabled = ref(persisted?.enabled ?? false)
  const running = ref(false)
  const speedKmh = ref(persisted?.speedKmh ?? 40)
  const currentPos = ref<LatLng | null>(null)

  const polyline = ref<LatLng[]>([])
  const segmentIndex = ref(0)
  const progressInSegment = ref(0)
  const currentRouteSig = ref('')

  let timer: ReturnType<typeof setInterval> | null = null

  const totalPoints = computed(() => polyline.value.length)
  const hasRoute = computed(() => totalPoints.value >= 2)
  const finished = computed(() =>
    hasRoute.value && segmentIndex.value >= totalPoints.value - 1,
  )

  const loadRoute = (routes: OptimizedRoute[]) => {
    const points = flattenRoutes(routes)
    const sig = routeSignature(points, routes.length)
    polyline.value = points
    currentRouteSig.value = sig

    const saved = loadPersisted()
    const canRestore =
      saved !== null &&
      saved.routeSig === sig &&
      points.length >= 2 &&
      saved.segmentIndex >= 0 &&
      saved.segmentIndex < points.length - 1

    if (canRestore) {
      segmentIndex.value = saved.segmentIndex
      progressInSegment.value = saved.progressInSegment
      const a = points[segmentIndex.value]
      const b = points[Math.min(segmentIndex.value + 1, points.length - 1)]
      currentPos.value = interpolate(a, b, progressInSegment.value)
      if (saved.enabled && saved.running) start()
    } else {
      segmentIndex.value = 0
      progressInSegment.value = 0
      currentPos.value = points[0] ?? null
    }
  }

  const tick = () => {
    if (!hasRoute.value) return
    if (finished.value) {
      pause()
      return
    }
    let remainingKm = speedKmh.value * (TICK_MS / 1000 / 3600)
    while (remainingKm > 0 && segmentIndex.value < polyline.value.length - 1) {
      const a = polyline.value[segmentIndex.value]
      const b = polyline.value[segmentIndex.value + 1]
      const segKm = haversineKm(a, b)
      const leftKm = segKm * (1 - progressInSegment.value)
      if (remainingKm >= leftKm) {
        remainingKm -= leftKm
        segmentIndex.value++
        progressInSegment.value = 0
      } else {
        progressInSegment.value += remainingKm / segKm
        remainingKm = 0
      }
    }

    const a = polyline.value[segmentIndex.value]
    const b = polyline.value[Math.min(segmentIndex.value + 1, polyline.value.length - 1)]
    currentPos.value = interpolate(a, b, progressInSegment.value)
  }

  const start = () => {
    if (!hasRoute.value || timer) return
    enabled.value = true
    running.value = true
    timer = setInterval(tick, TICK_MS)
  }

  const pause = () => {
    running.value = false
    if (timer) {
      clearInterval(timer)
      timer = null
    }
  }

  const reset = () => {
    pause()
    segmentIndex.value = 0
    progressInSegment.value = 0
    currentPos.value = polyline.value[0] ?? null
  }

  const disable = () => {
    pause()
    enabled.value = false
    currentPos.value = null
    polyline.value = []
    segmentIndex.value = 0
    progressInSegment.value = 0
    currentRouteSig.value = ''
    clearPersisted()
  }

  watch(
    [enabled, running, speedKmh, segmentIndex, progressInSegment, currentRouteSig],
    () => {
      if (!currentRouteSig.value) return
      savePersisted({
        enabled: enabled.value,
        running: running.value,
        speedKmh: speedKmh.value,
        segmentIndex: segmentIndex.value,
        progressInSegment: progressInSegment.value,
        routeSig: currentRouteSig.value,
      })
    },
  )

  return {
    enabled,
    running,
    speedKmh,
    currentPos,
    hasRoute,
    finished,
    loadRoute,
    start,
    pause,
    reset,
    disable,
  }
})
