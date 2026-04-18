import type {
  Order,
  OrderWithItems,
  CreateOrderDto,
  AssignCourierDto,
} from '@/types/order.types'
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
}
