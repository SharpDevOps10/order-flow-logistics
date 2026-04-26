<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import L from 'leaflet'
import type { OptimizedRoute } from '@/types/routing.types'

const props = defineProps<{
  pickupLat: number
  pickupLng: number
  pickupLabel: string
  deliveryLat: number
  deliveryLng: number
  deliveryLabel: string
  orderId?: number
  route?: OptimizedRoute | null
  courierPos?: { lat: number; lng: number } | null
}>()

const mapEl = ref<HTMLElement | null>(null)
let map: L.Map | null = null
let layerGroup: L.LayerGroup | null = null
let courierMarker: L.Marker | null = null

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

function makeCourierIcon() {
  return L.divIcon({
    className: '',
    html: `<div style="position:relative;width:22px;height:22px">
      <span style="
        position:absolute;inset:0;border-radius:50%;
        background:#2563eb;opacity:0.25;
        animation:courier-pulse 1.6s ease-out infinite;
      "></span>
      <span style="
        position:absolute;inset:4px;border-radius:50%;
        background:#2563eb;border:2px solid #fff;
        box-shadow:0 2px 6px rgba(0,0,0,0.35);
      "></span>
    </div>
    <style>@keyframes courier-pulse{0%{transform:scale(0.8);opacity:0.5}100%{transform:scale(1.8);opacity:0}}</style>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  })
}

function findOwnDeliveryIndex(route: OptimizedRoute, orderId: number): number {
  return route.waypoints.findIndex(
    (wp) => wp.type === 'DELIVERY' && wp.orderId === orderId,
  )
}

function renderRoute() {
  if (!map || !layerGroup) return
  layerGroup.clearLayers()

  const pickup = L.latLng(props.pickupLat, props.pickupLng)
  const delivery = L.latLng(props.deliveryLat, props.deliveryLng)

  L.marker(pickup, { icon: makePickupIcon() })
    .bindPopup(`<b>Pickup</b><br>${props.pickupLabel}`)
    .addTo(layerGroup)

  L.marker(delivery, { icon: makeDeliveryIcon() })
    .bindPopup(`<b>Delivery</b><br>${props.deliveryLabel}`)
    .addTo(layerGroup)

  const allLatLngs: L.LatLng[] = [pickup, delivery]

  const route = props.route
  const orderId = props.orderId
  let realGeometryRendered = false

  if (route && orderId !== undefined && route.geometry && route.geometry.length > 0) {
    const targetIdx = findOwnDeliveryIndex(route, orderId)
    if (targetIdx > 0) {
      const segments = route.geometry.slice(0, targetIdx)
      const firstActiveIdx = route.waypoints.findIndex((wp) => !wp.completed)
      const firstActive = route.waypoints[firstActiveIdx]
      const beforeOwnDelivery = firstActive && firstActive.type === 'PICKUP' && props.courierPos

      if (beforeOwnDelivery) {
        L.polyline(
          [
            L.latLng(props.courierPos!.lat, props.courierPos!.lng),
            L.latLng(firstActive.lat, firstActive.lng),
          ],
          { color: '#2563eb', weight: 3, opacity: 0.6, dashArray: '8 6' },
        ).addTo(layerGroup)
        allLatLngs.push(L.latLng(props.courierPos!.lat, props.courierPos!.lng))
      }

      for (const segment of segments) {
        if (segment.length < 2) continue
        const coords = segment.map(([lat, lng]) => L.latLng(lat, lng))
        L.polyline(coords, {
          color: '#2563eb',
          weight: 4,
          opacity: 0.85,
        }).addTo(layerGroup)
        for (const c of coords) allLatLngs.push(c)
      }
      realGeometryRendered = true
    }
  }

  if (!realGeometryRendered) {
    L.polyline([pickup, delivery], {
      color: '#3b82f6',
      weight: 3,
      opacity: 0.7,
      dashArray: '8 6',
    }).addTo(layerGroup)
  }

  if (props.courierPos) {
    const ll = L.latLng(props.courierPos.lat, props.courierPos.lng)
    courierMarker = L.marker(ll, { icon: makeCourierIcon(), zIndexOffset: 1000 }).addTo(map)
    allLatLngs.push(ll)
  } else {
    courierMarker = null
  }

  map.fitBounds(L.latLngBounds(allLatLngs), { padding: [40, 40] })
}

onMounted(() => {
  if (!mapEl.value) return

  map = L.map(mapEl.value, { zoomControl: true })

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 18,
  }).addTo(map)

  layerGroup = L.layerGroup().addTo(map)
  renderRoute()
})

onUnmounted(() => {
  map?.remove()
  map = null
  layerGroup = null
  courierMarker = null
})

watch(
  () => [props.route, props.orderId],
  () => renderRoute(),
  { deep: true },
)

watch(
  () => props.courierPos,
  (pos) => {
    if (!map) return
    if (!pos) {
      if (courierMarker) {
        courierMarker.remove()
        courierMarker = null
      }
      return
    }
    const ll = L.latLng(pos.lat, pos.lng)
    if (!courierMarker) {
      courierMarker = L.marker(ll, { icon: makeCourierIcon(), zIndexOffset: 1000 }).addTo(map)
    } else {
      courierMarker.setLatLng(ll)
    }
  },
  { deep: true },
)
</script>

<template>
  <div ref="mapEl" class="w-full rounded-xl overflow-hidden border border-gray-100" style="height: 260px;" />
</template>
