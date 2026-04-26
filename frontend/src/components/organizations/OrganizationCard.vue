<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, ref } from 'vue'
import type { Organization } from '@/types/organization.types'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

interface Props {
  organization: Organization
  showApprovalStatus?: boolean
  clickable?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  showApprovalStatus: false,
  clickable: false,
})

const emit = defineEmits<{
  click: []
}>()

const handleClick = () => {
  if (props.clickable) emit('click')
}

const handleKeydown = (event: KeyboardEvent) => {
  if (!props.clickable) return
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault()
    emit('click')
  }
}

const mapContainer = ref<HTMLDivElement>()
let mapInstance: L.Map | null = null

const avatarPalette = [
  'from-blue-500 to-indigo-500',
  'from-emerald-500 to-teal-500',
  'from-amber-500 to-orange-500',
  'from-pink-500 to-rose-500',
  'from-purple-500 to-fuchsia-500',
  'from-sky-500 to-cyan-500',
]
const avatarGradient = computed(
  () => avatarPalette[props.organization.id % avatarPalette.length],
)
const initial = computed(
  () => props.organization.name.trim().charAt(0).toUpperCase() || '?',
)

const hasCoords = computed(
  () => !!props.organization.lat && !!props.organization.lng,
)

const addressLine = computed(() => {
  const parts: string[] = []
  if (props.organization.address) parts.push(props.organization.address)
  if (props.organization.region) parts.push(props.organization.region)
  return parts.join(' · ')
})

const visibleCategories = computed(() =>
  (props.organization.categories ?? []).slice(0, 3),
)
const extraCategories = computed(() => {
  const total = props.organization.categories?.length ?? 0
  return Math.max(0, total - 3)
})

onMounted(() => {
  if (!mapContainer.value || !hasCoords.value) return

  delete (L.Icon.Default.prototype as { _getIconUrl?: unknown })._getIconUrl
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  })

  mapInstance = L.map(mapContainer.value, {
    center: [Number(props.organization.lat), Number(props.organization.lng)],
    zoom: 14,
    zoomControl: false,
    attributionControl: false,
    dragging: false,
    scrollWheelZoom: false,
    doubleClickZoom: false,
    touchZoom: false,
    boxZoom: false,
    keyboard: false,
  })

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
  }).addTo(mapInstance)

  L.marker([Number(props.organization.lat), Number(props.organization.lng)]).addTo(
    mapInstance,
  )
})

onBeforeUnmount(() => {
  mapInstance?.remove()
  mapInstance = null
})
</script>

<template>
  <article
    class="bg-white border border-gray-100 rounded-2xl overflow-hidden flex flex-col hover:shadow-lg hover:border-gray-200 hover:-translate-y-0.5 transition-all duration-200"
    :class="props.clickable ? 'cursor-pointer focus-within:ring-2 focus-within:ring-blue-500 focus:outline-none' : ''"
    :tabindex="props.clickable ? 0 : -1"
    :role="props.clickable ? 'button' : undefined"
    @click="handleClick"
    @keydown="handleKeydown"
  >
    <div
      class="relative h-24 bg-gradient-to-br flex items-center px-5 overflow-hidden"
      :class="avatarGradient"
    >
      <span class="absolute -right-4 -bottom-6 text-[7rem] font-black text-white/15 leading-none select-none">
        {{ initial }}
      </span>
      <div class="flex items-center gap-3 flex-1 min-w-0 relative">
        <div class="w-12 h-12 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center text-white text-xl font-bold flex-shrink-0">
          {{ initial }}
        </div>
        <div class="min-w-0">
          <h3 class="text-lg font-bold text-white truncate" :title="props.organization.name">
            {{ props.organization.name }}
          </h3>
          <p
            v-if="props.organization.productCount !== undefined"
            class="text-xs text-white/80 mt-0.5"
          >
            {{ props.organization.productCount }}
            {{ props.organization.productCount === 1 ? 'product' : 'products' }}
          </p>
        </div>
      </div>
      <span
        v-if="props.showApprovalStatus"
        class="absolute top-2 right-2 inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold shadow-sm"
        :class="props.organization.isApproved
          ? 'bg-white/95 text-emerald-700'
          : 'bg-white/95 text-amber-700'"
      >
        {{ props.organization.isApproved ? 'Approved' : 'Pending' }}
      </span>
    </div>

    <div class="p-4 flex flex-col gap-3 flex-1">
      <p
        v-if="addressLine"
        class="text-sm text-gray-600 flex items-start gap-1.5"
        :title="addressLine"
      >
        <svg class="w-4 h-4 flex-shrink-0 text-gray-400 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
          <path stroke-linecap="round" stroke-linejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        <span class="line-clamp-2">{{ addressLine }}</span>
      </p>

      <div v-if="visibleCategories.length" class="flex flex-wrap gap-1.5">
        <span
          v-for="c in visibleCategories"
          :key="c"
          class="inline-flex items-center px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 text-xs font-medium"
        >
          {{ c }}
        </span>
        <span
          v-if="extraCategories > 0"
          class="inline-flex items-center px-2 py-0.5 rounded-full bg-gray-50 text-gray-500 text-xs font-medium"
        >
          +{{ extraCategories }}
        </span>
      </div>

      <div
        v-if="hasCoords"
        ref="mapContainer"
        class="h-28 rounded-xl border border-gray-100 leaflet-container pointer-events-none"
      />

      <div class="flex items-center justify-end gap-2 mt-auto pt-2">
        <slot />
      </div>
    </div>
  </article>
</template>
