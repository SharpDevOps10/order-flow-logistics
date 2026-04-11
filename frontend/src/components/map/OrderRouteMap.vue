<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import L from 'leaflet'

const props = defineProps<{
  pickupLat: number
  pickupLng: number
  pickupLabel: string
  deliveryLat: number
  deliveryLng: number
  deliveryLabel: string
}>()

const mapEl = ref<HTMLElement | null>(null)
let map: L.Map | null = null

function makePickupIcon() {
  return L.divIcon({
    className: '',
    html: `<div style="
      width:32px;height:32px;border-radius:50%;
      background:#f97316;border:2px solid #fff;
      box-shadow:0 2px 6px rgba(0,0,0,0.25);
      display:flex;align-items:center;justify-content:center;
    ">
      <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="white" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
        <polyline stroke-linecap="round" stroke-linejoin="round" points="9 22 9 12 15 12 15 22"/>
      </svg>
    </div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  })
}

function makeDeliveryIcon() {
  return L.divIcon({
    className: '',
    html: `<div style="
      width:32px;height:32px;border-radius:50%;
      background:#3b82f6;border:2px solid #fff;
      box-shadow:0 2px 6px rgba(0,0,0,0.25);
      display:flex;align-items:center;justify-content:center;
    ">
      <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="white" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
        <path stroke-linecap="round" stroke-linejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>
      </svg>
    </div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  })
}

onMounted(() => {
  if (!mapEl.value) return

  map = L.map(mapEl.value, { zoomControl: true })

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 18,
  }).addTo(map)

  const pickup = L.latLng(props.pickupLat, props.pickupLng)
  const delivery = L.latLng(props.deliveryLat, props.deliveryLng)

  L.marker(pickup, { icon: makePickupIcon() })
    .bindPopup(`<b>Pickup</b><br>${props.pickupLabel}`)
    .addTo(map)

  L.marker(delivery, { icon: makeDeliveryIcon() })
    .bindPopup(`<b>Delivery</b><br>${props.deliveryLabel}`)
    .addTo(map)

  L.polyline([pickup, delivery], {
    color: '#3b82f6',
    weight: 3,
    opacity: 0.7,
    dashArray: '8 6',
  }).addTo(map)

  map.fitBounds(L.latLngBounds([pickup, delivery]), { padding: [40, 40] })
})

onUnmounted(() => {
  map?.remove()
  map = null
})
</script>

<template>
  <div ref="mapEl" class="w-full rounded-xl overflow-hidden border border-gray-100" style="height: 260px;" />
</template>
