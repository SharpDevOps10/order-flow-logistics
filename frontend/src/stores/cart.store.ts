import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import type { Product } from '@/types/product.types'

export interface CartItem {
  product: Product
  quantity: number
}

export const useCartStore = defineStore('cart', () => {
  const items = ref<CartItem[]>([])
  const organizationId = ref<number | null>(null)

  const total = computed(() =>
    items.value.reduce((sum, item) => sum + item.product.price * item.quantity, 0),
  )

  const itemCount = computed(() =>
    items.value.reduce((sum, item) => sum + item.quantity, 0),
  )

  const isEmpty = computed(() => items.value.length === 0)

  const addItem = (product: Product, quantity = 1) => {
    if (organizationId.value !== null && organizationId.value !== product.organizationId) {
      items.value = []
    }
    organizationId.value = product.organizationId

    const existing = items.value.find((i) => i.product.id === product.id)
    if (existing) {
      existing.quantity += quantity
    } else {
      items.value.push({ product, quantity })
    }
  }

  const removeItem = (productId: number) => {
    items.value = items.value.filter((i) => i.product.id !== productId)
    if (items.value.length === 0) organizationId.value = null
  }

  const updateQuantity = (productId: number, quantity: number) => {
    const item = items.value.find((i) => i.product.id === productId)
    if (!item) return
    if (quantity <= 0) {
      removeItem(productId)
    } else {
      item.quantity = quantity
    }
  }

  const clear = () => {
    items.value = []
    organizationId.value = null
  }

  return { items, organizationId, total, itemCount, isEmpty, addItem, removeItem, updateQuantity, clear }
})
