<script setup lang="ts">
import { onMounted, onUnmounted, watch } from 'vue'
import L from 'leaflet'
import type { OptimizedRoute } from '@/types/routing.types'

const props = defineProps<{
  routes: OptimizedRoute[]
  courierPos?: { lat: number; lng: number } | null
}>()

let map: L.Map | null = null
let layerGroup: L.LayerGroup | null = null
let courierMarker: L.Marker | null = null

function buildCourierIcon() {
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

const routeColor = (i: number) => ROUTE_COLORS[i % ROUTE_COLORS.length]

function buildPickupIcon(completed = false, themeColor = '#f97316') {
  const bg = completed ? '#9ca3af' : themeColor
  const opacity = completed ? '0.6' : '1'
  return L.divIcon({
    className: '',
    html: `<div style="
      width:32px;height:32px;border-radius:50%;
      background:${bg};border:2px solid #fff;
      box-shadow:0 2px 6px rgba(0,0,0,0.25);
      display:flex;align-items:center;justify-content:center;
      opacity:${opacity};
    ">
      <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="white" stroke-width="2">
        ${completed
          ? '<path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/>'
          : '<path stroke-linecap="round" stroke-linejoin="round" d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline stroke-linecap="round" stroke-linejoin="round" points="9 22 9 12 15 12 15 22"/>'}
      </svg>
    </div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  })
}

function buildStopIcon(label: number, color: string) {
  return L.divIcon({
    className: '',
    html: `<div style="
      width:28px;height:28px;border-radius:50%;
      background:${color};border:2px solid #fff;
      box-shadow:0 2px 6px rgba(0,0,0,0.25);
      display:flex;align-items:center;justify-content:center;
      color:#fff;font-size:11px;font-weight:700;font-family:sans-serif;
    ">${label}</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  })
}

function renderRoutes() {
  if (!map || !layerGroup) return
  layerGroup.clearLayers()

  const allLatLngs: L.LatLng[] = []

  let globalStopOffset = 0

  props.routes.forEach((route, routeIndex) => {
    const latlngs: L.LatLng[] = []
    const deliveries = route.waypoints.filter((wp) => wp.type === 'DELIVERY')
    const themeColor = routeColor(routeIndex)

    route.waypoints.forEach((wp) => {
      const ll = L.latLng(wp.lat, wp.lng)
      allLatLngs.push(ll)

      const localStop = wp.type === 'DELIVERY' ? deliveries.indexOf(wp) + 1 : 0
      const globalStop = localStop > 0 ? globalStopOffset + localStop : 0
      const arrivingColor = wp.completed ? '#9ca3af' : themeColor

      const popupContent = `
        <div style="font-family:sans-serif;min-width:160px">
          <p style="font-size:11px;font-weight:600;color:${arrivingColor};margin:0 0 4px">
            ${wp.type === 'PICKUP' ? (wp.completed ? 'Pickup · done' : 'Pickup') : `Stop ${globalStop}`}
            · Route ${routeIndex + 1}
            ${wp.orderId ? `· Order #${wp.orderId}` : ''}
          </p>
          <p style="font-size:12px;font-weight:500;color:#111;margin:0 0 2px">${wp.address}</p>
          <p style="font-size:11px;color:#888;margin:0;font-family:monospace">${wp.lat.toFixed(5)}, ${wp.lng.toFixed(5)}</p>
          ${!wp.completed && wp.type === 'DELIVERY' && localStop > 1 ? `<p style="font-size:11px;color:#6b7280;margin:4px 0 0">↑ ${wp.distanceFromPrevKm} km from prev</p>` : ''}
        </div>
      `

      let marker: L.Marker
      if (wp.type === 'PICKUP') {
        marker = L.marker(ll, { icon: buildPickupIcon(wp.completed, themeColor) })
      } else {
        marker = L.marker(ll, { icon: buildStopIcon(globalStop, arrivingColor) })
      }
      marker.bindPopup(popupContent)
      layerGroup!.addLayer(marker)

      if (!wp.completed) latlngs.push(ll)
    })

    if (route.geometry && route.geometry.length > 0) {
      route.geometry.forEach((segment) => {
        if (segment.length < 2) return
        const coords = segment.map(([lat, lng]) => L.latLng(lat, lng))
        L.polyline(coords, {
          color: themeColor,
          weight: 4,
          opacity: 0.85,
        }).addTo(layerGroup!)
      })
    } else {
      for (let i = 0; i < latlngs.length - 1; i++) {
        L.polyline([latlngs[i], latlngs[i + 1]], {
          color: themeColor,
          weight: 4,
          opacity: 0.85,
        }).addTo(layerGroup!)
      }
    }

    globalStopOffset += deliveries.length
  })

  if (allLatLngs.length > 0) {
    map.fitBounds(L.latLngBounds(allLatLngs), { padding: [40, 40] })
  }
}

onMounted(() => {
  map = L.map('route-map', { zoomControl: true })

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 18,
  }).addTo(map)

  layerGroup = L.layerGroup().addTo(map)

  if (props.routes.length > 0) renderRoutes()
})

onUnmounted(() => {
  map?.remove()
  map = null
})

watch(() => props.routes, renderRoutes, { deep: true })

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
      courierMarker = L.marker(ll, { icon: buildCourierIcon(), zIndexOffset: 1000 }).addTo(map)
    } else {
      courierMarker.setLatLng(ll)
    }
  },
  { deep: true, immediate: true },
)
</script>

<template>
  <div id="route-map" class="w-full rounded-2xl overflow-hidden border border-gray-100 shadow-sm" style="height: 420px;" />
</template>
