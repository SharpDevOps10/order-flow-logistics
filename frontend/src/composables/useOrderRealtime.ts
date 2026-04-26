import { onMounted, onBeforeUnmount } from 'vue'
import { io, type Socket } from 'socket.io-client'
import { useOrdersStore } from '@/stores/orders.store'
import type { Order, OrderStatus } from '@/types/order.types'

interface OrderUpdatedPayload {
  id: number
  organizationId: number
  clientId: number
  status: OrderStatus
  courierId: number | null
  courierName?: string | null
}

interface OrderRemovedPayload {
  id: number
  organizationId: number
  clientId: number
}

export const useOrderRealtime = () => {
  const store = useOrdersStore()
  let socket: Socket | null = null

  const connect = () => {
    const token = localStorage.getItem('access_token')
    if (!token) return

    socket = io('/orders', {
      auth: { token },
      transports: ['websocket', 'polling'],
      autoConnect: true,
    })

    socket.on('order:created', (order: Order) => {
      store.prependOrder(order)
    })

    socket.on('order:updated', (payload: OrderUpdatedPayload) => {
      store.upsertOrderPartial({
        id: payload.id,
        status: payload.status,
        courierId: payload.courierId,
        ...(payload.courierName !== undefined && {
          courierName: payload.courierName,
        }),
      })
    })

    socket.on('order:removed', (payload: OrderRemovedPayload) => {
      store.removeOrderById(payload.id)
    })
  }

  const disconnect = () => {
    socket?.disconnect()
    socket = null
  }

  onMounted(connect)
  onBeforeUnmount(disconnect)
}
