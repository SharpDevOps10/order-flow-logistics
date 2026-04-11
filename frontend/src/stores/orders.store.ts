import { ref } from 'vue'
import { defineStore } from 'pinia'
import { OrdersApi } from '@/api/orders.api'
import type { Order, CreateOrderDto } from '@/types/order.types'
import type { OrderStatus } from '@/types/order.types'

const extractErrorMessage = (error: unknown): string => {
  if (error && typeof error === 'object' && 'response' in error) {
    const axiosError = error as { response?: { data?: { message?: string } } }
    return axiosError.response?.data?.message ?? 'An error occurred'
  }
  return 'An error occurred'
}

export const useOrdersStore = defineStore('orders', () => {
  const orders = ref<Order[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  const fetchMy = async () => {
    loading.value = true
    error.value = null
    try {
      orders.value = await OrdersApi.getMy()
    } catch (e: unknown) {
      error.value = extractErrorMessage(e)
    } finally {
      loading.value = false
    }
  }

  const fetchSupplier = async () => {
    loading.value = true
    error.value = null
    try {
      orders.value = await OrdersApi.getSupplier()
    } catch (e: unknown) {
      error.value = extractErrorMessage(e)
    } finally {
      loading.value = false
    }
  }

  const fetchCourier = async () => {
    loading.value = true
    error.value = null
    try {
      orders.value = await OrdersApi.getCourier()
    } catch (e: unknown) {
      error.value = extractErrorMessage(e)
    } finally {
      loading.value = false
    }
  }

  const create = async (dto: CreateOrderDto) => {
    loading.value = true
    error.value = null
    try {
      const order = await OrdersApi.create(dto)
      orders.value.push(order)
      return order
    } catch (e: unknown) {
      error.value = extractErrorMessage(e)
      throw e
    } finally {
      loading.value = false
    }
  }

  const updateStatus = async (id: string, status: OrderStatus) => {
    loading.value = true
    error.value = null
    try {
      const updated = await OrdersApi.updateStatus(id, status)
      const idx = orders.value.findIndex((o) => o.id === id)
      if (idx !== -1) orders.value[idx] = updated
      return updated
    } catch (e: unknown) {
      error.value = extractErrorMessage(e)
      throw e
    } finally {
      loading.value = false
    }
  }

  const assignCourier = async (id: string, courierId: string) => {
    loading.value = true
    error.value = null
    try {
      const updated = await OrdersApi.assignCourier(id, courierId)
      const idx = orders.value.findIndex((o) => o.id === id)
      if (idx !== -1) orders.value[idx] = updated
      return updated
    } catch (e: unknown) {
      error.value = extractErrorMessage(e)
      throw e
    } finally {
      loading.value = false
    }
  }

  return {
    orders,
    loading,
    error,
    fetchMy,
    fetchSupplier,
    fetchCourier,
    create,
    updateStatus,
    assignCourier,
  }
})
