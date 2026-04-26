import { ref, computed, watch } from 'vue'
import { defineStore } from 'pinia'
import type { Product } from '@/types/product.types'

export interface CartItem {
  product: Product
  quantity: number
}

const STORAGE_KEY = 'orderflow.cart.v1'

interface PersistedState {
  items: CartItem[]
  organizationId: number | null
}

const loadPersisted = (): PersistedState => {
  if (typeof window === 'undefined') return { items: [], organizationId: null }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return { items: [], organizationId: null }
    const parsed = JSON.parse(raw) as Partial<PersistedState>
    if (!Array.isArray(parsed.items)) return { items: [], organizationId: null }
    return {
      items: parsed.items,
      organizationId:
        typeof parsed.organizationId === 'number' ? parsed.organizationId : null,
    }
  } catch {
    return { items: [], organizationId: null }
  }
}

export const useCartStore = defineStore('cart', () => {
  const persisted = loadPersisted()

  const items = ref<CartItem[]>(persisted.items)
  const organizationId = ref<number | null>(persisted.organizationId)

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

  watch(
    [items, organizationId],
    ([nextItems, nextOrgId]) => {
      if (typeof window === 'undefined') return
      try {
        if (nextItems.length === 0 && nextOrgId === null) {
          window.localStorage.removeItem(STORAGE_KEY)
        } else {
          window.localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify({ items: nextItems, organizationId: nextOrgId }),
          )
        }
      } catch {
        // ignore — storage may be full or disabled
      }
    },
    { deep: true },
  )

  return { items, organizationId, total, itemCount, isEmpty, addItem, removeItem, updateQuantity, clear }
})
