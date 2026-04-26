<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { useOrdersStore } from '@/stores/orders.store'
import { useRoutingStore } from '@/stores/routing.store'
import { useToast } from '@/composables/useToast'
import { OrderStatus } from '@/types/order.types'
import type { Order } from '@/types/order.types'
import { OrdersApi } from '@/api/orders.api'
import AppButton from '@/components/common/AppButton.vue'
import AppSpinner from '@/components/common/AppSpinner.vue'

const UNDO_DURATION = 5000

const store = useOrdersStore()
const routingStore = useRoutingStore()
const router = useRouter()
const toast = useToast()

const expandedItems = ref<Set<number>>(new Set())

const toggleItems = (orderId: number) => {
  if (expandedItems.value.has(orderId)) {
    expandedItems.value.delete(orderId)
  } else {
    expandedItems.value.add(orderId)
  }
}

const currencyFormatter = new Intl.NumberFormat('uk-UA', {
  style: 'currency',
  currency: 'UAH',
  minimumFractionDigits: 2,
})
const formatPrice = (value: number) => currencyFormatter.format(value)

const formatDateTime = (dateStr: string | null): string => {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const formatRelative = (dateStr: string | null): string => {
  if (!dateStr) return ''
  const diffMs = Date.now() - new Date(dateStr).getTime()
  const sec = Math.floor(diffMs / 1000)
  if (sec < 60) return 'just now'
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min} min ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  const day = Math.floor(hr / 24)
  if (day < 7) return `${day}d ago`
  return formatDateTime(dateStr)
}

const statusLabel: Record<OrderStatus, string> = {
  [OrderStatus.Pending]: 'Pending',
  [OrderStatus.Accepted]: 'Accepted',
  [OrderStatus.ReadyForDelivery]: 'Ready for pickup',
  [OrderStatus.PickedUp]: 'In delivery',
  [OrderStatus.Delivered]: 'Delivered',
}

const statusBadgeClass = (status: OrderStatus): string => {
  if (status === OrderStatus.ReadyForDelivery)
    return 'bg-amber-50 text-amber-700 border border-amber-100'
  if (status === OrderStatus.PickedUp)
    return 'bg-blue-50 text-blue-700 border border-blue-100'
  return 'bg-gray-50 text-gray-700 border border-gray-100'
}

const totalItemCount = (order: Order): number =>
  (order.items ?? []).reduce((sum, i) => sum + i.quantity, 0)

const orderCountLabel = computed(() => {
  const n = store.orders.length
  return n === 1 ? '1 delivery' : `${n} deliveries`
})

const handlePickup = async (orderId: number) => {
  try {
    await OrdersApi.pickup(orderId)
    toast.success(`Order #${orderId} marked as picked up`)
    await Promise.all([store.fetchCourier(), routingStore.fetchRoute()])
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed to mark as picked up'
    toast.error(msg)
  }
}

interface PendingDeliver {
  orderId: number
  timerId: ReturnType<typeof setTimeout>
}
let pendingDeliver: PendingDeliver | null = null
const optimisticDelivered = ref<Set<number>>(new Set())

const flushPendingDeliver = async () => {
  if (!pendingDeliver) return
  const { orderId, timerId } = pendingDeliver
  clearTimeout(timerId)
  pendingDeliver = null
  try {
    await OrdersApi.deliver(orderId)
    await Promise.all([store.fetchCourier(), routingStore.fetchRoute()])
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed to mark as delivered'
    toast.error(msg)
    optimisticDelivered.value.delete(orderId)
  }
}

const handleDeliver = (order: Order) => {
  if (pendingDeliver) void flushPendingDeliver()

  const orderId = order.id
  optimisticDelivered.value.add(orderId)

  const undo = () => {
    if (!pendingDeliver || pendingDeliver.orderId !== orderId) return
    clearTimeout(pendingDeliver.timerId)
    pendingDeliver = null
    optimisticDelivered.value.delete(orderId)
  }

  const timerId = setTimeout(() => {
    if (!pendingDeliver || pendingDeliver.orderId !== orderId) return
    const target = pendingDeliver
    pendingDeliver = null
    OrdersApi.deliver(orderId)
      .then(() =>
        Promise.all([store.fetchCourier(), routingStore.fetchRoute()]),
      )
      .catch((e: unknown) => {
        const msg =
          e instanceof Error ? e.message : 'Failed to mark as delivered'
        toast.error(msg)
        optimisticDelivered.value.delete(target.orderId)
      })
  }, UNDO_DURATION)

  toast.success(`Order #${orderId} marked as delivered`, {
    duration: UNDO_DURATION,
    action: { label: 'Undo', onClick: undo },
  })

  pendingDeliver = { orderId, timerId }
}

onMounted(async () => {
  await store.fetchCourier()
  if (store.error) toast.error(store.error)
})

onBeforeUnmount(() => {
  void flushPendingDeliver()
})
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <div>
        <h1 class="text-3xl font-bold text-gray-900">My Deliveries</h1>
        <p class="text-sm text-gray-400 mt-1">Orders assigned to you for delivery</p>
      </div>
      <div class="flex items-center gap-3">
        <span
          v-if="!store.loading && store.orders.length"
          class="text-sm bg-orange-50 text-orange-700 border border-orange-100 px-3 py-1 rounded-full font-medium"
        >
          {{ orderCountLabel }}
        </span>
        <AppButton
          v-if="store.orders.length"
          variant="secondary"
          size="sm"
          @click="router.push({ name: 'route-map' })"
        >
          View route
        </AppButton>
      </div>
    </div>

    <div v-if="store.loading" class="flex items-center justify-center py-20">
      <AppSpinner size="lg" />
    </div>

    <div
      v-else-if="store.error"
      class="bg-red-50 border border-red-100 rounded-2xl p-6 text-center"
    >
      <p class="text-sm text-red-600">{{ store.error }}</p>
      <AppButton variant="ghost" size="sm" class="mt-3" @click="store.fetchCourier()">
        Try again
      </AppButton>
    </div>

    <div v-else-if="!store.orders.length" class="text-center py-20">
      <p class="text-4xl mb-3">🚚</p>
      <p class="text-base font-semibold text-gray-900 mb-1">No deliveries assigned</p>
      <p class="text-sm text-gray-400">You have no active deliveries right now</p>
    </div>

    <div v-else class="flex flex-col gap-4">
      <article
        v-for="order in store.orders"
        :key="order.id"
        class="bg-white border border-gray-100 rounded-2xl p-5 flex flex-col gap-4 transition-opacity"
        :class="{ 'opacity-50': optimisticDelivered.has(order.id) }"
      >
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0 flex-1">
            <h2 class="text-lg font-bold text-gray-900 truncate">
              {{ order.deliveryAddress }}
            </h2>
            <p class="text-xs text-gray-400 mt-0.5 flex items-center gap-1.5 flex-wrap">
              <span>Order #{{ order.id }}</span>
              <span class="text-gray-300">·</span>
              <span :title="formatDateTime(order.createdAt)">
                {{ formatRelative(order.createdAt) }}
              </span>
              <span class="text-gray-300">·</span>
              <span
                class="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold"
                :class="statusBadgeClass(order.status)"
              >
                {{ statusLabel[order.status] }}
              </span>
            </p>
          </div>
          <div class="flex-shrink-0 text-right">
            <p class="text-xs text-gray-400 uppercase tracking-wide">Your fee</p>
            <p class="text-2xl font-bold text-emerald-600 whitespace-nowrap">
              {{ formatPrice(order.deliveryFee) }}
            </p>
          </div>
        </div>

        <div v-if="order.items && order.items.length" class="bg-gray-50 rounded-xl px-4 py-3">
          <button
            class="flex items-center justify-between w-full text-left"
            @click="toggleItems(order.id)"
          >
            <div class="flex items-center gap-2">
              <svg
                class="w-3.5 h-3.5 text-gray-400 transition-transform duration-200"
                :class="expandedItems.has(order.id) ? 'rotate-90' : ''"
                fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"
              >
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
              </svg>
              <p class="text-sm font-medium text-gray-700">
                {{ totalItemCount(order) }} {{ totalItemCount(order) === 1 ? 'item' : 'items' }} to deliver
              </p>
            </div>
            <p class="text-xs text-gray-500">
              {{ expandedItems.has(order.id) ? 'Hide' : 'Show items' }}
            </p>
          </button>

          <ul v-if="expandedItems.has(order.id)" class="mt-3 flex flex-col gap-2 pt-3 border-t border-gray-200">
            <li v-for="item in order.items" :key="item.id" class="flex items-center gap-3 text-sm">
              <span class="inline-flex items-center justify-center w-6 h-6 rounded-md bg-white border border-gray-200 text-xs font-semibold text-gray-600 flex-shrink-0">
                {{ item.quantity }}
              </span>
              <span class="flex-1 truncate text-gray-700">
                {{ item.productName ?? `Product #${item.productId}` }}
              </span>
            </li>
          </ul>
        </div>

        <div class="bg-gray-50 rounded-xl px-4 py-3">
          <p class="text-xs text-gray-400 mb-1">Delivery address</p>
          <p class="text-sm text-gray-700 font-medium" :title="order.deliveryAddress">
            {{ order.deliveryAddress }}
          </p>
        </div>

        <div class="flex items-center justify-end gap-2 pt-1 border-t border-gray-50">
          <AppButton
            v-if="order.status === OrderStatus.ReadyForDelivery"
            size="sm"
            variant="secondary"
            @click="handlePickup(order.id)"
          >
            Mark as Picked Up
          </AppButton>
          <AppButton
            v-if="order.status === OrderStatus.PickedUp && !optimisticDelivered.has(order.id)"
            size="sm"
            @click="handleDeliver(order)"
          >
            Mark as Delivered
          </AppButton>
          <span
            v-if="optimisticDelivered.has(order.id)"
            class="text-sm text-gray-500 px-3 py-1.5"
          >
            Delivering...
          </span>
        </div>
      </article>
    </div>
  </div>
</template>
