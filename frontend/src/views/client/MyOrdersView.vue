<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { useOrdersStore } from '@/stores/orders.store'
import { useOrganizationsStore } from '@/stores/organizations.store'
import { useToast } from '@/composables/useToast'
import { OrderStatus } from '@/types/order.types'
import type { Order } from '@/types/order.types'
import { OrdersApi, type OrderEtaResponse } from '@/api/orders.api'
import AppBadge from '@/components/common/AppBadge.vue'
import AppButton from '@/components/common/AppButton.vue'
import AppSpinner from '@/components/common/AppSpinner.vue'
import AppModal from '@/components/common/AppModal.vue'
import OrderRouteMap from '@/components/map/OrderRouteMap.vue'

const store = useOrdersStore()
const orgsStore = useOrganizationsStore()
const router = useRouter()
const toast = useToast()

const expandedRoutes = ref<Set<number>>(new Set())

const toggleRoute = (orderId: number) => {
  if (expandedRoutes.value.has(orderId)) {
    expandedRoutes.value.delete(orderId)
  } else {
    expandedRoutes.value.add(orderId)
  }
}

const getOrgForOrder = (order: Order) => {
  return orgsStore.organizations.find((o) => o.id === order.organizationId) ?? null
}

const canShowRoute = (order: Order): boolean => {
  if (!order.lat || !order.lng) return false
  const org = getOrgForOrder(order)
  return !!(org?.lat && org?.lng)
}

type BadgeVariant = 'yellow' | 'blue' | 'green'

const statusBadgeVariant: Record<OrderStatus, BadgeVariant> = {
  [OrderStatus.Pending]: 'yellow',
  [OrderStatus.Accepted]: 'blue',
  [OrderStatus.ReadyForDelivery]: 'green',
}

const statusLabel: Record<OrderStatus, string> = {
  [OrderStatus.Pending]: 'Pending',
  [OrderStatus.Accepted]: 'Accepted',
  [OrderStatus.ReadyForDelivery]: 'Ready for Delivery',
}

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

const isCancelModalOpen = ref(false)
const selectedOrder = ref<Order | null>(null)
const isCancelling = ref(false)

const openCancelModal = (order: Order) => {
  selectedOrder.value = order
  isCancelModalOpen.value = true
}

const handleCancel = async () => {
  if (!selectedOrder.value) return
  isCancelling.value = true
  try {
    await store.cancel(selectedOrder.value.id)
    toast.success(`Order #${selectedOrder.value.id} cancelled`)
    isCancelModalOpen.value = false
  } catch {
    toast.error(store.error ?? 'Failed to cancel order')
  } finally {
    isCancelling.value = false
  }
}

const etas = ref<Map<number, OrderEtaResponse>>(new Map())
let etaTimer: ReturnType<typeof setInterval> | null = null

const isEtaEligible = (order: Order): boolean =>
  order.status === OrderStatus.ReadyForDelivery ||
  order.status === OrderStatus.PickedUp

const refreshEtas = async () => {
  const eligible = store.orders.filter(isEtaEligible)
  const results = await Promise.all(
    eligible.map(async (o) => {
      try {
        return [o.id, await OrdersApi.getEta(o.id)] as const
      } catch {
        return null
      }
    }),
  )
  const next = new Map<number, OrderEtaResponse>()
  for (const entry of results) {
    if (entry) next.set(entry[0], entry[1])
  }
  etas.value = next
}

const formatEtaLine = (eta: OrderEtaResponse): string => {
  if (!eta.available) return ''
  const arrival = new Date(eta.arrivalAt)
  const hh = arrival.getHours().toString().padStart(2, '0')
  const mm = arrival.getMinutes().toString().padStart(2, '0')
  const mins = Math.max(0, eta.minutes)
  return `arrives in ~${mins} min · ${hh}:${mm}`
}

const etaUnavailableLabel = (reason: string): string => {
  if (reason === 'courier-offline') return 'Courier is offline'
  if (reason === 'no-route') return 'Route unavailable'
  return 'ETA unavailable'
}

onMounted(async () => {
  await Promise.all([store.fetchMy(), orgsStore.fetchAll()])
  if (store.error) toast.error(store.error)
  await refreshEtas()
  etaTimer = setInterval(refreshEtas, 60_000)
})

onBeforeUnmount(() => {
  if (etaTimer) clearInterval(etaTimer)
})
</script>

<template>
  <div>

        <div class="flex items-center justify-between mb-6">
      <div>
        <h1 class="text-3xl font-bold text-gray-900">My Orders</h1>
        <p class="text-sm text-gray-400 mt-1">Track your order history</p>
      </div>
      <div class="flex items-center gap-3">
        <span
          v-if="!store.loading && store.orders.length"
          class="text-sm bg-blue-50 text-blue-700 border border-blue-100 px-3 py-1 rounded-full font-medium"
        >
          {{ store.orders.length }} orders
        </span>
        <AppButton variant="secondary" size="sm" @click="router.push({ name: 'marketplace' })">
          + New order
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
      <AppButton variant="ghost" size="sm" class="mt-3" @click="store.fetchMy()">
        Try again
      </AppButton>
    </div>

        <div v-else-if="!store.orders.length" class="text-center py-20">
      <p class="text-4xl mb-3">📦</p>
      <p class="text-base font-semibold text-gray-900 mb-1">No orders yet</p>
      <p class="text-sm text-gray-400 mb-6">Browse the marketplace and place your first order</p>
      <AppButton @click="router.push({ name: 'marketplace' })">Go to Marketplace</AppButton>
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
              <AppBadge :variant="statusBadgeVariant[order.status]">
                {{ statusLabel[order.status] }}
              </AppBadge>
            </div>
            <p class="text-xs text-gray-400 mt-1">{{ formatDate(order.createdAt) }}</p>
          </div>
          <p class="text-lg font-bold text-gray-900 flex-shrink-0">
            ₴{{ order.totalAmount.toFixed(2) }}
          </p>
        </div>

                <div class="grid grid-cols-2 gap-3 text-sm">
          <div class="bg-gray-50 rounded-xl px-4 py-3">
            <p class="text-xs text-gray-400 mb-1">Delivery address</p>
            <p class="text-gray-700 font-medium truncate">{{ order.deliveryAddress }}</p>
          </div>
          <div class="bg-gray-50 rounded-xl px-4 py-3">
            <p class="text-xs text-gray-400 mb-1">Courier</p>
            <p class="text-gray-700 font-medium">
              {{ order.courierId ? `Assigned (ID: ${order.courierId})` : 'Not assigned yet' }}
            </p>
          </div>
        </div>

        <div
          v-if="isEtaEligible(order) && etas.get(order.id)"
          class="flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-xl px-4 py-2.5"
        >
          <svg class="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="9" />
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 7v5l3 2" />
          </svg>
          <template v-if="etas.get(order.id)!.available">
            <div class="flex-1">
              <p class="text-sm font-medium text-blue-800">
                Your order {{ formatEtaLine(etas.get(order.id)!) }}
              </p>
              <p v-if="(etas.get(order.id) as { stopsAhead?: number }).stopsAhead! > 0" class="text-xs text-blue-600/70 mt-0.5">
                {{ (etas.get(order.id) as { stopsAhead: number }).stopsAhead }} {{ (etas.get(order.id) as { stopsAhead: number }).stopsAhead === 1 ? 'delivery' : 'deliveries' }} ahead of you
                <span v-if="(etas.get(order.id) as { isFallbackSpeed?: boolean }).isFallbackSpeed" class="ml-1 text-[10px] text-blue-500/60">(approximate)</span>
              </p>
            </div>
          </template>
          <template v-else>
            <p class="text-sm text-gray-500">{{ etaUnavailableLabel(etas.get(order.id)!.reason) }}</p>
          </template>
        </div>

                <div v-if="canShowRoute(order)">
          <button
            class="flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 transition-colors"
            @click="toggleRoute(order.id)"
          >
            <svg
              class="w-3.5 h-3.5 transition-transform duration-200"
              :class="expandedRoutes.has(order.id) ? 'rotate-180' : ''"
              fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"
            >
              <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
            {{ expandedRoutes.has(order.id) ? 'Hide route' : 'Show route' }}
          </button>

          <div v-if="expandedRoutes.has(order.id)" class="mt-3">
            <OrderRouteMap
              :pickup-lat="Number(getOrgForOrder(order)!.lat)"
              :pickup-lng="Number(getOrgForOrder(order)!.lng)"
              :pickup-label="getOrgForOrder(order)!.name"
              :delivery-lat="Number(order.lat)"
              :delivery-lng="Number(order.lng)"
              :delivery-label="order.deliveryAddress"
            />
          </div>
        </div>

                <div
          v-if="order.status === OrderStatus.Pending"
          class="flex justify-end pt-1 border-t border-gray-50"
        >
          <AppButton variant="danger" size="sm" @click="openCancelModal(order)">
            Cancel order
          </AppButton>
        </div>

      </div>
    </div>

        <AppModal v-model="isCancelModalOpen" title="Cancel order">
      <div class="flex flex-col gap-3">
        <p class="text-sm text-gray-600">
          Are you sure you want to cancel
          <span class="font-semibold text-gray-900">Order #{{ selectedOrder?.id }}</span>?
        </p>
        <div class="bg-yellow-50 border border-yellow-100 rounded-xl px-4 py-3">
          <p class="text-xs text-yellow-700">
            This action cannot be undone. The order will be permanently removed.
          </p>
        </div>
      </div>

      <template #footer>
        <AppButton variant="secondary" @click="isCancelModalOpen = false">Keep order</AppButton>
        <AppButton variant="danger" :loading="isCancelling" @click="handleCancel">
          Yes, cancel
        </AppButton>
      </template>
    </AppModal>

  </div>
</template>
