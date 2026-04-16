<script setup lang="ts">
import { onMounted, onUnmounted, watch } from 'vue'
import L from 'leaflet'
import type { OptimizedRoute } from '@/types/routing.types'

const props = defineProps<{
  routes: OptimizedRoute[]
}>()

let map: L.Map | null = null
let layerGroup: L.LayerGroup | null = null

/** Colors rotated per segment (pickup→stop1, stop1→stop2, …). */
const SEGMENT_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444',
  '#ec4899', '#14b8a6', '#f97316', '#6366f1', '#84cc16',
]

const segmentColor = (i: number) => SEGMENT_COLORS[i % SEGMENT_COLORS.length]

function buildPickupIcon() {
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

  props.routes.forEach((route) => {
    const latlngs: L.LatLng[] = []

    route.waypoints.forEach((wp, wpIndex) => {
      const ll = L.latLng(wp.lat, wp.lng)
      latlngs.push(ll)
      allLatLngs.push(ll)

      // Marker for stop N takes the color of the segment that arrives at it (segment N-1).
      const arrivingColor = wpIndex > 0 ? segmentColor(wpIndex - 1) : '#f97316'

      const popupContent = `
        <div style="font-family:sans-serif;min-width:160px">
          <p style="font-size:11px;font-weight:600;color:${arrivingColor};margin:0 0 4px">
            ${wp.type === 'PICKUP' ? 'Pickup' : `Stop ${wpIndex}`}
            ${wp.orderId ? `· Order #${wp.orderId}` : ''}
          </p>
          <p style="font-size:12px;font-weight:500;color:#111;margin:0 0 2px">${wp.address}</p>
          <p style="font-size:11px;color:#888;margin:0;font-family:monospace">${wp.lat.toFixed(5)}, ${wp.lng.toFixed(5)}</p>
          ${wpIndex > 0 ? `<p style="font-size:11px;color:#6b7280;margin:4px 0 0">↑ ${wp.distanceFromPrevKm} km from prev</p>` : ''}
        </div>
      `

      let marker: L.Marker
      if (wp.type === 'PICKUP') {
        marker = L.marker(ll, { icon: buildPickupIcon() })
      } else {
        marker = L.marker(ll, { icon: buildStopIcon(wpIndex, arrivingColor) })
      }
      marker.bindPopup(popupContent)
      layerGroup!.addLayer(marker)
    })

    // Draw each segment with its own color.
    if (route.geometry && route.geometry.length > 0) {
      route.geometry.forEach((segment, i) => {
        if (segment.length < 2) return
        const coords = segment.map(([lat, lng]) => L.latLng(lat, lng))
        L.polyline(coords, {
          color: segmentColor(i),
          weight: 4,
          opacity: 0.85,
        }).addTo(layerGroup!)
      })
    } else {
      // Fallback: straight lines between consecutive waypoints, one color per segment.
      for (let i = 0; i < latlngs.length - 1; i++) {
        L.polyline([latlngs[i], latlngs[i + 1]], {
          color: segmentColor(i),
          weight: 4,
          opacity: 0.85,
        }).addTo(layerGroup!)
      }
    }
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
</script>

<template>
  <div id="route-map" class="w-full rounded-2xl overflow-hidden border border-gray-100 shadow-sm" style="height: 420px;" />
</template>
