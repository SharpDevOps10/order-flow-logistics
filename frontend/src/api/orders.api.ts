import type {
  Order,
  OrderWithItems,
  CreateOrderDto,
  AssignCourierDto,
} from '@/types/order.types'
import type { OrderStatus } from '@/types/order.types'
import type { OptimizedRoute } from '@/types/routing.types'
import { axiosInstance } from './axios.instance'

export type OrderEtaContextResponse =
  | {
      available: true
      orderId: number
      courierId: number
      courierPos: { lat: number; lng: number } | null
      routes: OptimizedRoute[]
      avgSpeedKmh: number
      isFallbackSpeed: boolean
    }
  | {
      available: false
      reason: 'order-not-in-transit' | 'no-route'
    }

export type OrderEtaResponse =
  | {
      available: true
      distanceKm: number
      minutes: number
      arrivalAt: string
      stopsAhead: number
      avgSpeedKmh: number
      isFallbackSpeed: boolean
    }
  | {
      available: false
      reason: 'order-not-in-transit' | 'courier-offline' | 'no-route' | 'order-not-in-route'
    }

export interface PricingBreakdownItem {
  label: string
  amount: number
  detail?: string
}

export interface PricingBreakdown {
  distanceKm: number
  distanceSource: 'osrm' | 'haversine'
  base: number
  distanceFee: number
  rushMultiplier: number
  rushLabel: string | null
  loadMultiplier: number
  systemLoadRatio: number
  activeOrders: number
  availableCouriers: number
  subtotal: number
  afterRush: number
  finalFee: number
  items: PricingBreakdownItem[]
}

export const OrdersApi = {
  getMy: async (): Promise<Order[]> => {
    const { data } = await axiosInstance.get<Order[]>('/orders/my')
    return data
  },

  getSupplier: async (): Promise<Order[]> => {
    const { data } = await axiosInstance.get<Order[]>('/orders/supplier')
    return data
  },

  getCourier: async (): Promise<Order[]> => {
    const { data } = await axiosInstance.get<Order[]>('/orders/courier')
    return data
  },

  create: async (dto: CreateOrderDto): Promise<OrderWithItems> => {
    const { data } = await axiosInstance.post<OrderWithItems>('/orders', dto)
    return data
  },

  updateStatus: async (id: number, status: OrderStatus): Promise<Order> => {
    const { data } = await axiosInstance.patch<Order>(`/orders/${id}/status`, { status })
    return data
  },

  assignCourier: async (id: number, dto: AssignCourierDto): Promise<Order> => {
    const { data } = await axiosInstance.patch<Order>(`/orders/${id}/assign-courier`, dto)
    return data
  },

  cancel: async (id: number): Promise<Order> => {
    const { data } = await axiosInstance.delete<Order>(`/orders/${id}`)
    return data
  },

  pickup: async (id: number): Promise<Order> => {
    const { data } = await axiosInstance.post<Order>(`/orders/${id}/pickup`)
    return data
  },

  deliver: async (id: number): Promise<Order> => {
    const { data } = await axiosInstance.post<Order>(`/orders/${id}/deliver`)
    return data
  },

  getEta: async (id: number): Promise<OrderEtaResponse> => {
    const { data } = await axiosInstance.get<OrderEtaResponse>(`/orders/${id}/eta`)
    return data
  },

  getEtaContext: async (id: number): Promise<OrderEtaContextResponse> => {
    const { data } = await axiosInstance.get<OrderEtaContextResponse>(
      `/orders/${id}/eta-context`,
    )
    return data
  },

  quoteDelivery: async (params: {
    organizationId: number
    lat?: string
    lng?: string
  }): Promise<PricingBreakdown> => {
    const { data } = await axiosInstance.post<PricingBreakdown>('/orders/quote', params)
    return data
  },
}
