import {
  ref,
  computed,
  watch,
  onMounted,
  onBeforeUnmount,
  type Ref,
} from 'vue'
import { io, type Socket } from 'socket.io-client'
import { OrdersApi, type OrderEtaContextResponse } from '@/api/orders.api'
import type { Order } from '@/types/order.types'
import { OrderStatus } from '@/types/order.types'

type LatLng = { lat: number; lng: number }

interface CourierPosUpdate {
  orderId: number
  lat: number
  lng: number
  at: number
  firstSegmentKm?: number
  firstSegmentDurationSec?: number
  avgSpeedKmh?: number
  isFallbackSpeed?: boolean
}

interface ComputedEta {
  available: true
  distanceKm: number
  minutes: number
  arrivalAt: Date
  isFallbackSpeed: boolean
  isPositionLive: boolean
}

interface UnavailableEta {
  available: false
  reason: 'order-not-in-transit' | 'no-route' | 'loading'
}

type EtaResult = ComputedEta | UnavailableEta

const POSITION_LIVE_THRESHOLD_MS = 60_000

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

const isActiveStatus = (s: OrderStatus): boolean =>
  s === OrderStatus.ReadyForDelivery || s === OrderStatus.PickedUp

export const useClientOrderEtas = (orders: Ref<Order[]>) => {
  const contexts = ref<Map<number, OrderEtaContextResponse>>(new Map())
  const livePositions = ref<
    Map<
      number,
      {
        lat: number
        lng: number
        at: number
        firstSegmentKm?: number
        firstSegmentDurationSec?: number
        avgSpeedKmh?: number
        isFallbackSpeed?: boolean
      }
    >
  >(new Map())
  let socket: Socket | null = null

  const fetchContext = async (orderId: number) => {
    try {
      const ctx = await OrdersApi.getEtaContext(orderId)
      const next = new Map(contexts.value)
      next.set(orderId, ctx)
      contexts.value = next
    } catch {
      const next = new Map(contexts.value)
      next.delete(orderId)
      contexts.value = next
    }
  }

  const dropContext = (orderId: number) => {
    if (!contexts.value.has(orderId) && !livePositions.value.has(orderId)) return
    const nextCtx = new Map(contexts.value)
    nextCtx.delete(orderId)
    contexts.value = nextCtx
    const nextPos = new Map(livePositions.value)
    nextPos.delete(orderId)
    livePositions.value = nextPos
  }

  watch(
    orders,
    (next, prev) => {
      const activeIds = new Set(
        next.filter((o) => isActiveStatus(o.status)).map((o) => o.id),
      )
      for (const o of next) {
        if (isActiveStatus(o.status) && !contexts.value.has(o.id)) {
          void fetchContext(o.id)
        }
      }
      const prevIds = new Set((prev ?? []).map((o) => o.id))
      for (const o of next) {
        if (
          isActiveStatus(o.status) &&
          prevIds.has(o.id) &&
          contexts.value.has(o.id)
        ) {
          const prevOrder = prev?.find((p) => p.id === o.id)
          if (
            prevOrder &&
            (prevOrder.status !== o.status || prevOrder.courierId !== o.courierId)
          ) {
            void fetchContext(o.id)
          }
        }
      }
      for (const id of contexts.value.keys()) {
        if (!activeIds.has(id)) dropContext(id)
      }
    },
    { immediate: true, deep: true },
  )

  onMounted(() => {
    const token = localStorage.getItem('access_token')
    if (!token) return
    socket = io('/orders', {
      auth: { token },
      transports: ['websocket', 'polling'],
    })
    socket.on('courier:position', (payload: CourierPosUpdate) => {
      const ctx = contexts.value.get(payload.orderId)
      if (!ctx) return
      const next = new Map(livePositions.value)
      next.set(payload.orderId, {
        lat: payload.lat,
        lng: payload.lng,
        at: payload.at,
        ...(payload.firstSegmentKm !== undefined && {
          firstSegmentKm: payload.firstSegmentKm,
        }),
        ...(payload.firstSegmentDurationSec !== undefined && {
          firstSegmentDurationSec: payload.firstSegmentDurationSec,
        }),
        ...(payload.avgSpeedKmh !== undefined && {
          avgSpeedKmh: payload.avgSpeedKmh,
        }),
        ...(payload.isFallbackSpeed !== undefined && {
          isFallbackSpeed: payload.isFallbackSpeed,
        }),
      })
      livePositions.value = next
    })
  })

  onBeforeUnmount(() => {
    socket?.disconnect()
    socket = null
  })

  const now = ref(Date.now())
  let nowTimer: ReturnType<typeof setInterval> | null = null
  onMounted(() => {
    nowTimer = setInterval(() => {
      now.value = Date.now()
    }, 1000)
  })
  onBeforeUnmount(() => {
    if (nowTimer) clearInterval(nowTimer)
  })

  const etaByOrder = computed<Map<number, EtaResult>>(() => {
    const result = new Map<number, EtaResult>()
    const currentNow = now.value
    void currentNow

    for (const order of orders.value) {
      if (!isActiveStatus(order.status)) continue
      const ctx = contexts.value.get(order.id)
      if (!ctx) {
        result.set(order.id, { available: false, reason: 'loading' })
        continue
      }
      if (!ctx.available) {
        result.set(order.id, { available: false, reason: ctx.reason })
        continue
      }

      const livePos = livePositions.value.get(order.id)
      const courierPos: LatLng | null =
        livePos ?? ctx.courierPos ?? null

      if (!courierPos) {
        result.set(order.id, { available: false, reason: 'no-route' })
        continue
      }

      let cumulativeKm = 0
      let cumulativeSec = 0
      let allSegmentsHaveDuration = true
      let lastActiveWp: LatLng | null = null
      let found = false
      let firstSegmentSeen = false

      outer: for (const route of ctx.routes) {
        let firstActive = true
        for (const wp of route.waypoints) {
          if (wp.completed) continue
          let segKm: number
          let segSec: number | null = null
          if (firstActive) {
            if (!firstSegmentSeen && lastActiveWp === null) {
              const liveKm = livePos?.firstSegmentKm
              const liveSec = livePos?.firstSegmentDurationSec
              const ctxKm = ctx.firstSegmentKm
              const ctxSec = ctx.firstSegmentDurationSec
              if (liveKm !== undefined) {
                segKm = liveKm
                segSec = liveSec ?? null
              } else if (ctxKm !== null && ctxKm !== undefined) {
                segKm = ctxKm
                segSec = ctxSec ?? null
              } else {
                const from = lastActiveWp ?? courierPos
                segKm = haversineKm(from, wp)
              }
            } else {
              const from = lastActiveWp ?? courierPos
              segKm = haversineKm(from, wp)
            }
            firstSegmentSeen = true
          } else {
            segKm = wp.distanceFromPrevKm
            segSec = wp.durationFromPrevSec ?? null
          }
          cumulativeKm += segKm
          if (segSec !== null) {
            cumulativeSec += segSec
          } else {
            allSegmentsHaveDuration = false
          }
          firstActive = false
          lastActiveWp = { lat: wp.lat, lng: wp.lng }
          if (wp.type === 'DELIVERY' && wp.orderId === order.id) {
            found = true
            break outer
          }
        }
      }

      if (!found) {
        result.set(order.id, { available: false, reason: 'no-route' })
        continue
      }

      const speed = livePos?.avgSpeedKmh ?? ctx.avgSpeedKmh
      const isFallbackSpeed =
        livePos?.isFallbackSpeed ?? ctx.isFallbackSpeed
      const minutes = allSegmentsHaveDuration
        ? cumulativeSec / 60
        : (cumulativeKm / speed) * 60
      const isPositionLive =
        livePos !== undefined && now.value - livePos.at < POSITION_LIVE_THRESHOLD_MS

      result.set(order.id, {
        available: true,
        distanceKm: Math.round(cumulativeKm * 100) / 100,
        minutes,
        arrivalAt: new Date(now.value + minutes * 60_000),
        isFallbackSpeed,
        isPositionLive,
      })
    }

    return result
  })

  return { etaByOrder }
}
