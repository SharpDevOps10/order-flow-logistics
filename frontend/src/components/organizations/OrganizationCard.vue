<script setup lang="ts">
import { onMounted, ref } from 'vue'
import type { Organization } from '@/types/organization.types'
import AppBadge from '@/components/common/AppBadge.vue'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

interface Props {
  organization: Organization
}

const props = defineProps<Props>()

const mapContainer = ref<HTMLDivElement>()
const mapInitialized = ref(false)

onMounted(() => {
  if (!mapContainer.value || !props.organization.lat || !props.organization.lng) return

  // Fix Leaflet default icon path
  delete (L.Icon.Default.prototype as any)._getIconUrl
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  })

  // Initialize map
  const map = L.map(mapContainer.value, {
    center: [Number(props.organization.lat), Number(props.organization.lng)],
    zoom: 15,
  })

  // Add tile layer
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors',
    maxZoom: 19,
  }).addTo(map)

  // Add marker
  L.marker([Number(props.organization.lat), Number(props.organization.lng)])
    .addTo(map)
    .bindPopup(props.organization.address || 'Location')

  mapInitialized.value = true
})
</script>

<template>
  <div class="bg-white border border-gray-100 rounded-2xl p-6 hover:shadow-md transition-shadow flex flex-col gap-5">

    <!-- Header -->
    <div class="flex items-start justify-between gap-3">
      <div class="flex-1 min-w-0">
        <h3 class="text-lg font-semibold text-gray-900 truncate">{{ props.organization.name }}</h3>
        <p v-if="props.organization.region" class="text-sm text-gray-500 mt-1 flex items-center gap-1.5">
          <svg class="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path stroke-linecap="round" stroke-linejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          {{ props.organization.region }}
        </p>
      </div>
      <AppBadge :variant="props.organization.isApproved ? 'green' : 'yellow'">
        {{ props.organization.isApproved ? 'Approved' : 'Pending' }}
      </AppBadge>
    </div>

    <!-- Address and Map -->
    <div v-if="props.organization.lat && props.organization.lng" class="flex flex-col gap-3 -mx-6 -mb-6">
      <!-- Address -->
      <div class="px-6 flex items-start gap-2 text-sm">
        <svg class="w-4 h-4 flex-shrink-0 text-blue-500 mt-0.5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 110-5 2.5 2.5 0 010 5z" />
        </svg>
        <span class="text-gray-700">{{ props.organization.address }}</span>
      </div>

      <!-- Map -->
      <div
        ref="mapContainer"
        class="h-48 bg-gray-100 rounded-b-2xl border-t border-gray-100 leaflet-container"
      />
    </div>

    <!-- Footer: meta + actions -->
    <div class="flex items-center justify-between gap-3 pt-1 border-t border-gray-50">
      <span class="text-sm text-gray-400">ID: {{ props.organization.id }}</span>
      <div class="flex items-center gap-2">
        <slot />
      </div>
    </div>

  </div>
</template>
