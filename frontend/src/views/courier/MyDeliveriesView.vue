<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useOrdersStore } from '@/stores/orders.store'
import { useRoutingStore } from '@/stores/routing.store'
import { useToast } from '@/composables/useToast'
import { OrderStatus } from '@/types/order.types'
import { OrdersApi } from '@/api/orders.api'
import AppButton from '@/components/common/AppButton.vue'
import AppBadge from '@/components/common/AppBadge.vue'
import AppSpinner from '@/components/common/AppSpinner.vue'

const store = useOrdersStore()
const routingStore = useRoutingStore()
const router = useRouter()
const toast = useToast()

const formatDate = (dateStr: string | null): string => {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const statusBadgeVariant = (status: OrderStatus): 'green' | 'blue' | 'default' => {
  if (status === OrderStatus.ReadyForDelivery) return 'green'
  if (status === OrderStatus.PickedUp) return 'blue'
  return 'default'
}

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

const handleDeliver = async (orderId: number) => {
  try {
    await OrdersApi.deliver(orderId)
    toast.success(`Order #${orderId} delivered`)
    await Promise.all([store.fetchCourier(), routingStore.fetchRoute()])
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed to mark as delivered'
    toast.error(msg)
  }
}

onMounted(async () => {
  await store.fetchCourier()
  if (store.error) toast.error(store.error)
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
          {{ store.orders.length }} deliveries
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
      <div
        v-for="order in store.orders"
        :key="order.id"
        class="bg-white border border-gray-100 rounded-2xl p-5 flex flex-col gap-4"
      >

                <div class="flex items-start justify-between gap-3">
          <div>
            <div class="flex items-center gap-2">
              <span class="text-base font-semibold text-gray-900">Order #{{ order.id }}</span>
              <AppBadge :variant="statusBadgeVariant(order.status)">{{ order.status }}</AppBadge>
            </div>
            <p class="text-xs text-gray-400 mt-1">{{ formatDate(order.createdAt) }}</p>
          </div>
          <p class="text-lg font-bold text-gray-900 flex-shrink-0">
            ₴{{ order.totalAmount.toFixed(2) }}
          </p>
        </div>

                <div class="grid grid-cols-2 gap-3">
          <div class="bg-gray-50 rounded-xl px-4 py-3">
            <p class="text-xs text-gray-400 mb-1">Delivery address</p>
            <p class="text-sm text-gray-700 font-medium">{{ order.deliveryAddress }}</p>
          </div>
          <div class="bg-gray-50 rounded-xl px-4 py-3">
            <p class="text-xs text-gray-400 mb-1">Coordinates</p>
            <p class="text-sm text-gray-700 font-medium font-mono">
              {{ order.lat && order.lng
                ? `${Number(order.lat).toFixed(4)}, ${Number(order.lng).toFixed(4)}`
                : 'Not provided' }}
            </p>
          </div>
        </div>

                <div class="flex items-center justify-end gap-2">
          <AppButton
            v-if="order.status === OrderStatus.ReadyForDelivery"
            size="sm"
            variant="secondary"
            @click="handlePickup(order.id)"
          >
            Mark as Picked Up
          </AppButton>
          <AppButton
            v-if="order.status === OrderStatus.PickedUp"
            size="sm"
            @click="handleDeliver(order.id)"
          >
            Mark as Delivered
          </AppButton>
        </div>

      </div>

            <div
        class="bg-orange-50 border border-orange-100 rounded-2xl p-5 flex items-center justify-between gap-4"
      >
        <div>
          <p class="text-sm font-semibold text-orange-800">Ready to start?</p>
          <p class="text-xs text-orange-600 mt-0.5">View your optimized delivery route</p>
        </div>
        <AppButton @click="router.push({ name: 'route-map' })">
          Open Route Map
        </AppButton>
      </div>
    </div>

  </div>
</template>
