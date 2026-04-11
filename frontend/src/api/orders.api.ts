import type { Order, CreateOrderDto } from '@/types/order.types'
import type { OrderStatus } from '@/types/order.types'
import { axiosInstance } from './axios.instance'

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

  create: async (dto: CreateOrderDto): Promise<Order> => {
    const { data } = await axiosInstance.post<Order>('/orders', dto)
    return data
  },

  updateStatus: async (id: string, status: OrderStatus): Promise<Order> => {
    const { data } = await axiosInstance.patch<Order>(`/orders/${id}/status`, { status })
    return data
  },

  assignCourier: async (id: string, courierId: string): Promise<Order> => {
    const { data } = await axiosInstance.patch<Order>(`/orders/${id}/assign-courier`, {
      courierId,
    })
    return data
  },
}
