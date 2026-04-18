import { onBeforeUnmount, onMounted } from 'vue'
import { io, type Socket } from 'socket.io-client'
import { useAuthStore } from '@/stores/auth.store'
import { useToast } from '@/composables/useToast'
import { useRoutingStore } from '@/stores/routing.store'
import { useOrdersStore } from '@/stores/orders.store'

interface ServerToClientEvents {
  'order:assigned': (payload: { orderId: number }) => void
  'order:reassigned_away': (payload: {
    orderId: number
    reason: 'optimization'
  }) => void
}

interface ClientToServerEvents {
  'courier:location': (payload: { lat: number; lng: number }) => void
}

/** How often to broadcast the courier's current location (ms). */
const LOCATION_INTERVAL_MS = 60_000

export const useCourierSocket = () => {
  const authStore = useAuthStore()
  const toast = useToast()
  const routingStore = useRoutingStore()
  const ordersStore = useOrdersStore()

  let socket: Socket<ServerToClientEvents, ClientToServerEvents> | null = null
  let geoWatchId: number | null = null
  let lastPos: { lat: number; lng: number } | null = null
  let locationTimer: ReturnType<typeof setInterval> | null = null

  const connect = () => {
    if (socket || !authStore.accessToken) return

    socket = io('http://localhost:3000', {
      auth: { token: authStore.accessToken },
      transports: ['websocket'],
    })

    socket.on('connect', () => {
      // eslint-disable-next-line no-console
      console.log('[CourierSocket] connected')
    })

    socket.on('disconnect', (reason) => {
      // eslint-disable-next-line no-console
      console.log('[CourierSocket] disconnected:', reason)
    })

    socket.on('order:assigned', ({ orderId }) => {
      toast.success(`New delivery assigned: order #${orderId}`)
      routingStore.fetchRoute()
      ordersStore.fetchCourier()
    })

    socket.on('order:reassigned_away', ({ orderId }) => {
      toast.info(
        `Order #${orderId} was reassigned to another courier for route optimization`,
      )
      routingStore.fetchRoute()
      ordersStore.fetchCourier()
    })
  }

  const startLocationBroadcast = () => {
    if (!('geolocation' in navigator)) return

    geoWatchId = navigator.geolocation.watchPosition(
      (pos) => {
        lastPos = { lat: pos.coords.latitude, lng: pos.coords.longitude }
      },
      (err) => {
        console.warn('[CourierSocket] geolocation error:', err.message)
      },
      { enableHighAccuracy: false, maximumAge: 30_000, timeout: 15_000 },
    )

    locationTimer = setInterval(() => {
      if (lastPos && socket?.connected) {
        socket.emit('courier:location', lastPos)
      }
    }, LOCATION_INTERVAL_MS)
  }

  const disconnect = () => {
    if (locationTimer) {
      clearInterval(locationTimer)
      locationTimer = null
    }
    if (geoWatchId !== null) {
      navigator.geolocation.clearWatch(geoWatchId)
      geoWatchId = null
    }
    if (socket) {
      socket.disconnect()
      socket = null
    }
  }

  onMounted(() => {
    connect()
    startLocationBroadcast()
  })

  onBeforeUnmount(disconnect)

  return { disconnect }
}
