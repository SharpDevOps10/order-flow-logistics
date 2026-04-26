import { ref } from 'vue'
import { defineStore } from 'pinia'
import { OrdersApi } from '@/api/orders.api'
import type { Order, OrderWithItems, CreateOrderDto, AssignCourierDto } from '@/types/order.types'
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

  const create = async (dto: CreateOrderDto): Promise<OrderWithItems> => {
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

  const updateStatus = async (id: number, status: OrderStatus) => {
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

  const assignCourier = async (id: number, dto: AssignCourierDto) => {
    loading.value = true
    error.value = null
    try {
      const updated = await OrdersApi.assignCourier(id, dto)
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

  const cancel = async (id: number) => {
    loading.value = true
    error.value = null
    try {
      await OrdersApi.cancel(id)
      orders.value = orders.value.filter((o) => o.id !== id)
    } catch (e: unknown) {
      error.value = extractErrorMessage(e)
      throw e
    } finally {
      loading.value = false
    }
  }

  const removeLocal = (id: number): { order: Order; index: number } | null => {
    const index = orders.value.findIndex((o) => o.id === id)
    if (index === -1) return null
    const [order] = orders.value.splice(index, 1)
    return { order, index }
  }

  const restoreLocal = (order: Order, index: number) => {
    orders.value.splice(index, 0, order)
  }

  const cancelOnServer = async (id: number) => {
    error.value = null
    try {
      await OrdersApi.cancel(id)
    } catch (e: unknown) {
      error.value = extractErrorMessage(e)
      throw e
    }
  }

  const upsertOrderPartial = (
    patch: Pick<Order, 'id' | 'status' | 'courierId'> &
      Partial<Pick<Order, 'courierName'>>,
  ) => {
    const idx = orders.value.findIndex((o) => o.id === patch.id)
    if (idx === -1) return
    orders.value[idx] = { ...orders.value[idx], ...patch }
  }

  const prependOrder = (order: Order) => {
    if (orders.value.some((o) => o.id === order.id)) return
    orders.value.unshift(order)
  }

  const removeOrderById = (id: number) => {
    orders.value = orders.value.filter((o) => o.id !== id)
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
    cancel,
    removeLocal,
    restoreLocal,
    cancelOnServer,
    upsertOrderPartial,
    prependOrder,
    removeOrderById,
  }
})
