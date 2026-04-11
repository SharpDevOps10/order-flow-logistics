<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRoutingStore } from '@/stores/routing.store'
import { useToast } from '@/composables/useToast'
import type { RouteWaypoint } from '@/types/routing.types'
import AppButton from '@/components/common/AppButton.vue'
import AppSpinner from '@/components/common/AppSpinner.vue'
import AppBadge from '@/components/common/AppBadge.vue'
import RouteMap from '@/components/map/RouteMap.vue'

const store = useRoutingStore()
const toast = useToast()

const totalDistance = computed(() =>
  store.routes.reduce((sum, r) => sum + r.totalDistanceKm, 0),
)

const totalStops = computed(() =>
  store.routes.reduce((sum, r) => sum + r.waypoints.filter((w) => w.type === 'DELIVERY').length, 0),
)

const isNoOrdersError = computed(() =>
  store.error?.toLowerCase().includes('no ready') ||
  store.error?.toLowerCase().includes('no_ready'),
)

const isMissingCoordsError = computed(() =>
  store.error?.toLowerCase().includes('coordinates'),
)

const waypointLabel = (wp: RouteWaypoint, index: number): string => {
  if (wp.type === 'PICKUP') return 'Pickup'
  return `Stop ${index}`
}

onMounted(async () => {
  await store.fetchRoute()
  if (store.error && !isNoOrdersError.value) toast.error(store.error)
})
</script>

<template>
  <div>

    <!-- Header -->
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

    <!-- Loading -->
    <div v-if="store.loading" class="flex items-center justify-center py-20">
      <AppSpinner size="lg" />
    </div>

    <!-- No orders -->
    <div v-else-if="isNoOrdersError" class="text-center py-20">
      <p class="text-4xl mb-3">📍</p>
      <p class="text-base font-semibold text-gray-900 mb-1">No deliveries to route</p>
      <p class="text-sm text-gray-400">You have no Ready for Delivery orders assigned</p>
    </div>

    <!-- Missing coordinates error -->
    <div v-else-if="isMissingCoordsError" class="bg-yellow-50 border border-yellow-100 rounded-2xl p-6 text-center">
      <p class="text-2xl mb-3">⚠️</p>
      <p class="text-base font-semibold text-yellow-800 mb-1">Coordinates missing</p>
      <p class="text-sm text-yellow-700">
        Some orders or organizations are missing coordinates. Ask the supplier to update organization location and clients to provide delivery coordinates.
      </p>
    </div>

    <!-- Generic error -->
    <div
      v-else-if="store.error"
      class="bg-red-50 border border-red-100 rounded-2xl p-6 text-center"
    >
      <p class="text-sm text-red-600">{{ store.error }}</p>
      <AppButton variant="ghost" size="sm" class="mt-3" @click="store.fetchRoute()">
        Try again
      </AppButton>
    </div>

    <!-- Route content -->
    <div v-else-if="store.routes.length" class="flex flex-col gap-6">

      <!-- Summary bar -->
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
      </div>

      <!-- Interactive map -->
      <RouteMap :routes="store.routes" />

      <!-- One card per organization route -->
      <div
        v-for="(route, routeIndex) in store.routes"
        :key="routeIndex"
        class="bg-white border border-gray-100 rounded-2xl p-5 flex flex-col gap-1"
      >
        <!-- Route header -->
        <div class="flex items-center justify-between mb-4">
          <p class="text-sm font-semibold text-gray-900">
            Route {{ routeIndex + 1 }}
          </p>
          <span class="text-xs text-gray-500 bg-gray-50 border border-gray-100 px-2.5 py-1 rounded-full">
            {{ route.totalDistanceKm }} km total
          </span>
        </div>

        <!-- Waypoints -->
        <div class="flex flex-col">
          <div
            v-for="(wp, wpIndex) in route.waypoints"
            :key="wpIndex"
            class="flex gap-4"
          >
            <!-- Dot column: dot + continuous line below -->
            <div class="flex flex-col items-center flex-shrink-0 w-8">
              <div
                class="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                :class="wp.type === 'PICKUP'
                  ? 'bg-orange-500 text-white ring-2 ring-orange-200'
                  : 'bg-blue-100 text-blue-700 ring-2 ring-blue-200 text-xs font-bold'"
              >
                <!-- Pickup: store icon -->
                <svg v-if="wp.type === 'PICKUP'" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                  <polyline stroke-linecap="round" stroke-linejoin="round" points="9 22 9 12 15 12 15 22" />
                </svg>
                <!-- Delivery: stop number -->
                <span v-else>{{ wpIndex }}</span>
              </div>
              <!-- Line with direction arrow -->
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

            <!-- Content column: info + distance below -->
            <div
              class="flex-1 flex flex-col"
              :class="wpIndex < route.waypoints.length - 1 ? 'pb-0' : 'pb-1'"
            >
              <!-- Waypoint info -->
              <div class="pb-2">
                <div class="flex items-center gap-2 mb-0.5">
                  <AppBadge :variant="wp.type === 'PICKUP' ? 'orange' : 'blue'">
                    {{ waypointLabel(wp, wpIndex) }}
                  </AppBadge>
                  <span v-if="wp.orderId" class="text-xs text-gray-400">
                    Order #{{ wp.orderId }}
                  </span>
                </div>
                <p class="text-sm font-medium text-gray-800">{{ wp.address }}</p>
                <p class="text-xs text-gray-400 font-mono mt-0.5">
                  {{ wp.lat.toFixed(5) }}, {{ wp.lng.toFixed(5) }}
                </p>
              </div>

              <!-- Distance label — aligned with the line -->
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
