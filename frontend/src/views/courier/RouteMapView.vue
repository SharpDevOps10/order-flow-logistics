<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, toRef, watch } from 'vue'
import { useRoutingStore } from '@/stores/routing.store'
import { useSimulationStore } from '@/stores/simulation.store'
import { useToast } from '@/composables/useToast'
import { useEta } from '@/composables/useEta'
import type { RouteWaypoint } from '@/types/routing.types'
import AppButton from '@/components/common/AppButton.vue'
import AppSpinner from '@/components/common/AppSpinner.vue'
import AppBadge from '@/components/common/AppBadge.vue'
import RouteMap from '@/components/map/RouteMap.vue'

const store = useRoutingStore()
const sim = useSimulationStore()
const toast = useToast()

const showSimulation = import.meta.env.DEV

const courierPos = computed(() => (sim.enabled ? sim.currentPos : null))
const { stats, speedKmh, etaByWaypoint, fetchStats } = useEta(
  toRef(store, 'routes'),
  courierPos,
)

const formatArrival = (wp: RouteWaypoint): string => {
  const eta = etaByWaypoint.value.get(wp)
  if (!eta) return ''
  const mins = Math.max(0, Math.round(eta.minutes))
  const hh = eta.arrivalAt.getHours().toString().padStart(2, '0')
  const mm = eta.arrivalAt.getMinutes().toString().padStart(2, '0')
  return `~${mins} min · ${hh}:${mm}`
}

const handleStart = () => {
  if (!sim.hasRoute) sim.loadRoute(store.routes)
  sim.start()
}

const totalDistance = computed(() =>
  store.routes.reduce((sum, r) => sum + r.totalDistanceKm, 0),
)

const totalStops = computed(() =>
  store.routes.reduce((sum, r) => sum + r.waypoints.filter((w) => w.type === 'DELIVERY').length, 0),
)

const isNoOrdersError = computed(() =>
  store.error?.toLowerCase().includes('no active deliveries') ||
  store.error?.toLowerCase().includes('no ready'),
)

const isMissingCoordsError = computed(() =>
  store.error?.toLowerCase().includes('coordinates'),
)

const ROUTE_COLORS = [
  '#2563eb',
  '#059669',
  '#dc2626',
  '#9333ea',
  '#ea580c',
  '#0891b2',
  '#db2777',
  '#65a30d',
]

const routeColor = (i: number): string => ROUTE_COLORS[i % ROUTE_COLORS.length]

const routeOffsets = computed(() => {
  const offsets: number[] = []
  let acc = 0
  for (const r of store.routes) {
    offsets.push(acc)
    acc += r.waypoints.filter((w) => w.type === 'DELIVERY').length
  }
  return offsets
})

const globalStopNumber = (
  wp: RouteWaypoint,
  route: { waypoints: RouteWaypoint[] },
  routeIndex: number,
): number => {
  const deliveries = route.waypoints.filter((w) => w.type === 'DELIVERY')
  return routeOffsets.value[routeIndex] + deliveries.indexOf(wp) + 1
}

const waypointLabel = (
  wp: RouteWaypoint,
  route: { waypoints: RouteWaypoint[] },
  routeIndex: number,
): string => {
  if (wp.type === 'PICKUP') return wp.completed ? 'Pickup · done' : 'Pickup'
  return `Stop ${globalStopNumber(wp, route, routeIndex)}`
}

onMounted(async () => {
  await Promise.all([store.fetchRoute(), fetchStats()])
  if (store.error && !isNoOrdersError.value) toast.error(store.error)
  if (store.routes.length) sim.loadRoute(store.routes)
})

watch(
  () => store.routes,
  (routes) => {
    if (routes.length) sim.loadRoute(routes)
  },
  { deep: true },
)

onBeforeUnmount(() => {
  sim.disable()
})
</script>

<template>
  <div>

        <div class="flex items-center justify-between mb-6">
      <div>
        <h1 class="text-3xl font-bold text-gray-900">Route Map</h1>
        <p class="text-sm text-gray-400 mt-1">Optimized delivery route via Dijkstra</p>
      </div>
      <AppButton
        variant="secondary"
        size="sm"
        :loading="store.loading"
        @click="store.fetchRoute()"
      >
        Refresh
      </AppButton>
    </div>

        <div v-if="store.loading" class="flex items-center justify-center py-20">
      <AppSpinner size="lg" />
    </div>

        <div v-else-if="isNoOrdersError" class="text-center py-20">
      <p class="text-4xl mb-3">📍</p>
      <p class="text-base font-semibold text-gray-900 mb-1">No deliveries to route</p>
      <p class="text-sm text-gray-400">You have no active deliveries assigned</p>
    </div>

        <div v-else-if="isMissingCoordsError" class="bg-yellow-50 border border-yellow-100 rounded-2xl p-6 text-center">
      <p class="text-2xl mb-3">⚠️</p>
      <p class="text-base font-semibold text-yellow-800 mb-1">Coordinates missing</p>
      <p class="text-sm text-yellow-700">
        Some orders or organizations are missing coordinates. Ask the supplier to update organization location and clients to provide delivery coordinates.
      </p>
    </div>

        <div
      v-else-if="store.error"
      class="bg-red-50 border border-red-100 rounded-2xl p-6 text-center"
    >
      <p class="text-sm text-red-600">{{ store.error }}</p>
      <AppButton variant="ghost" size="sm" class="mt-3" @click="store.fetchRoute()">
        Try again
      </AppButton>
    </div>

        <div v-else-if="store.routes.length" class="flex flex-col gap-6">

            <div class="bg-white border border-gray-100 rounded-2xl px-6 py-4 flex items-center gap-8">
        <div>
          <p class="text-xs text-gray-400">Total distance</p>
          <p class="text-2xl font-bold text-gray-900">{{ totalDistance.toFixed(2) }} km</p>
        </div>
        <div class="w-px h-10 bg-gray-100" />
        <div>
          <p class="text-xs text-gray-400">Deliveries</p>
          <p class="text-2xl font-bold text-gray-900">{{ totalStops }}</p>
        </div>
        <div class="w-px h-10 bg-gray-100" />
        <div>
          <p class="text-xs text-gray-400">Routes</p>
          <p class="text-2xl font-bold text-gray-900">{{ store.routes.length }}</p>
        </div>
        <div class="w-px h-10 bg-gray-100" />
        <div>
          <p class="text-xs text-gray-400 flex items-center gap-1.5">
            Avg speed
            <span
              v-if="stats?.isFallback"
              class="text-[10px] bg-gray-50 border border-gray-100 text-gray-400 px-1.5 py-0.5 rounded"
              title="Not enough location samples yet — using default"
            >
              default
            </span>
          </p>
          <p class="text-2xl font-bold text-gray-900">{{ speedKmh }} <span class="text-sm font-medium text-gray-400">km/h</span></p>
        </div>
      </div>

            <RouteMap :routes="store.routes" :courier-pos="sim.enabled ? sim.currentPos : null" />

      <div
        v-if="showSimulation"
        class="bg-white border border-dashed border-blue-200 rounded-2xl px-5 py-4 flex items-center gap-4 flex-wrap"
      >
        <div class="flex items-center gap-2">
          <span class="inline-block w-2 h-2 rounded-full" :class="sim.running ? 'bg-blue-500 animate-pulse' : 'bg-gray-300'" />
          <p class="text-xs font-semibold text-gray-700 uppercase tracking-wide">Courier simulation</p>
          <span class="text-[10px] text-gray-400 font-medium bg-gray-50 px-1.5 py-0.5 rounded">dev</span>
        </div>

        <div class="flex items-center gap-2">
          <AppButton
            v-if="!sim.running"
            size="sm"
            variant="primary"
            :disabled="!sim.hasRoute || sim.finished"
            @click="handleStart"
          >
            {{ sim.finished ? 'Finished' : 'Start' }}
          </AppButton>
          <AppButton v-else size="sm" variant="secondary" @click="sim.pause()">Pause</AppButton>
          <AppButton size="sm" variant="ghost" :disabled="!sim.hasRoute" @click="sim.reset()">Reset</AppButton>
          <AppButton v-if="sim.enabled" size="sm" variant="ghost" @click="sim.disable()">Off</AppButton>
        </div>

        <div class="flex items-center gap-3 flex-1 min-w-[220px]">
          <label class="text-xs text-gray-500">Speed</label>
          <input
            v-model.number="sim.speedKmh"
            type="range"
            min="10"
            max="300"
            step="10"
            class="flex-1 accent-blue-600"
          />
          <span class="text-xs font-mono text-gray-700 w-16 text-right">{{ sim.speedKmh }} km/h</span>
        </div>

        <p v-if="sim.currentPos" class="text-xs text-gray-400 font-mono w-full">
          pos: {{ sim.currentPos.lat.toFixed(5) }}, {{ sim.currentPos.lng.toFixed(5) }}
        </p>
      </div>

            <div
        v-for="(route, routeIndex) in store.routes"
        :key="routeIndex"
        class="bg-white border border-gray-100 rounded-2xl p-5 flex flex-col gap-1"
      >
                <div class="flex items-center justify-between mb-4">
          <p class="text-sm font-semibold text-gray-900 flex items-center gap-2">
            <span class="inline-block w-2.5 h-2.5 rounded-full" :style="{ background: routeColor(routeIndex) }" />
            Route {{ routeIndex + 1 }}
          </p>
          <span class="text-xs text-gray-500 bg-gray-50 border border-gray-100 px-2.5 py-1 rounded-full">
            {{ route.totalDistanceKm }} km total
          </span>
        </div>

                <div class="flex flex-col">
          <div
            v-for="(wp, wpIndex) in route.waypoints"
            :key="wpIndex"
            class="flex gap-4"
          >
                        <div class="flex flex-col items-center flex-shrink-0 w-8">
              <div
                class="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold"
                :class="wp.type === 'PICKUP' && wp.completed
                  ? 'bg-gray-300 text-white ring-2 ring-gray-200'
                  : ''"
                :style="wp.type === 'PICKUP' && wp.completed
                  ? {}
                  : { background: routeColor(routeIndex), color: '#fff', boxShadow: `0 0 0 2px ${routeColor(routeIndex)}33` }"
              >
                                <svg v-if="wp.type === 'PICKUP' && wp.completed" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                                <svg v-else-if="wp.type === 'PICKUP'" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                  <polyline stroke-linecap="round" stroke-linejoin="round" points="9 22 9 12 15 12 15 22" />
                </svg>
                                <span v-else>{{ globalStopNumber(wp, route, routeIndex) }}</span>
              </div>
                            <div
                v-if="wpIndex < route.waypoints.length - 1"
                class="relative w-0.5 flex-1 mt-1"
                :class="wp.type === 'PICKUP' ? 'bg-orange-200' : 'bg-gray-200'"
              >
                <svg
                  class="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-5 h-5"
                  :class="wp.type === 'PICKUP' ? 'text-orange-400' : 'text-gray-400'"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M12 16.5l-6-6h12z" />
                </svg>
              </div>
            </div>

                        <div
              class="flex-1 flex flex-col"
              :class="wpIndex < route.waypoints.length - 1 ? 'pb-0' : 'pb-1'"
            >
                            <div class="pb-2">
                <div class="flex items-center gap-2 mb-0.5">
                  <AppBadge :variant="wp.type === 'PICKUP' ? (wp.completed ? 'default' : 'orange') : 'blue'">
                    {{ waypointLabel(wp, route, routeIndex) }}
                  </AppBadge>
                  <span v-if="wp.orderId" class="text-xs text-gray-400">
                    Order #{{ wp.orderId }}
                  </span>
                </div>
                <p class="text-sm font-medium text-gray-800">{{ wp.address }}</p>
                <p class="text-xs text-gray-400 font-mono mt-0.5">
                  {{ wp.lat.toFixed(5) }}, {{ wp.lng.toFixed(5) }}
                </p>
                <p
                  v-if="!wp.completed && etaByWaypoint.get(wp)"
                  class="text-xs text-gray-500 mt-1 flex items-center gap-1"
                >
                  <svg class="w-3 h-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="9" />
                    <path stroke-linecap="round" stroke-linejoin="round" d="M12 7v5l3 2" />
                  </svg>
                  ETA: {{ formatArrival(wp) }}
                </p>
              </div>

                            <div
                v-if="wpIndex < route.waypoints.length - 1"
                class="flex-1 flex items-center pb-3"
              >
                <span class="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 bg-gray-100 border border-gray-200 rounded-full px-2.5 py-1">
                  <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                  {{ route.waypoints[wpIndex + 1].distanceFromPrevKm }} km
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

    </div>

  </div>
</template>
