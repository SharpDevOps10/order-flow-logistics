<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useOrdersStore } from '@/stores/orders.store'
import { useToast } from '@/composables/useToast'
import { UsersApi } from '@/api/users.api'
import { OrderStatus } from '@/types/order.types'
import type { Order } from '@/types/order.types'
import type { CourierUser } from '@/types/user.types'
import AppButton from '@/components/common/AppButton.vue'
import AppSpinner from '@/components/common/AppSpinner.vue'
import AppModal from '@/components/common/AppModal.vue'

type TabKey = 'active' | 'waiting' | 'done'

const TABS: { key: TabKey; label: string; statuses: OrderStatus[] }[] = [
  { key: 'active', label: 'Active', statuses: [OrderStatus.Pending, OrderStatus.Accepted] },
  { key: 'waiting', label: 'Waiting for courier', statuses: [OrderStatus.ReadyForDelivery, OrderStatus.PickedUp] },
  { key: 'done', label: 'Done', statuses: [OrderStatus.Delivered] },
]

const NEW_ORDER_THRESHOLD_MIN = 10

const SUPPLIER_FLOW: OrderStatus[] = [
  OrderStatus.Pending,
  OrderStatus.Accepted,
  OrderStatus.ReadyForDelivery,
]

const supplierStepIndex = (status: OrderStatus): number => {
  const idx = SUPPLIER_FLOW.indexOf(status)
  if (idx !== -1) return idx
  return SUPPLIER_FLOW.length
}

const route = useRoute()
const router = useRouter()
const store = useOrdersStore()
const toast = useToast()

const initialTab = TABS.some((t) => t.key === route.query.tab)
  ? (route.query.tab as TabKey)
  : 'active'
const activeTab = ref<TabKey>(initialTab)
const expandedItems = ref<Set<number>>(new Set())

watch(activeTab, (value) => {
  router.replace({
    query: { ...route.query, tab: value === 'active' ? undefined : value },
  })
})

const nextStatus: Partial<Record<OrderStatus, OrderStatus>> = {
  [OrderStatus.Pending]: OrderStatus.Accepted,
  [OrderStatus.Accepted]: OrderStatus.ReadyForDelivery,
}

const nextStatusLabel: Partial<Record<OrderStatus, string>> = {
  [OrderStatus.Pending]: 'Accept',
  [OrderStatus.Accepted]: 'Mark as ready',
}

const supplierStepLabel: Record<OrderStatus, string> = {
  [OrderStatus.Pending]: 'Pending',
  [OrderStatus.Accepted]: 'Accepted',
  [OrderStatus.ReadyForDelivery]: 'Ready',
  [OrderStatus.PickedUp]: 'Picked up',
  [OrderStatus.Delivered]: 'Delivered',
}

const updatingIds = ref<Set<number>>(new Set())

const handleStatusUpdate = async (order: Order) => {
  const next = nextStatus[order.status]
  if (!next) return

  updatingIds.value = new Set(updatingIds.value).add(order.id)
  try {
    await store.updateStatus(order.id, next)
    toast.success(`Status updated: ${supplierStepLabel[next]}`)
  } catch {
    toast.error(store.error ?? 'Failed to update status')
  } finally {
    const updated = new Set(updatingIds.value)
    updated.delete(order.id)
    updatingIds.value = updated
  }
}

const couriers = ref<CourierUser[]>([])
const couriersLoading = ref(false)

const loadCouriers = async () => {
  if (couriers.value.length) return
  couriersLoading.value = true
  try {
    couriers.value = await UsersApi.getCouriers()
  } catch {
    toast.error('Failed to load couriers')
  } finally {
    couriersLoading.value = false
  }
}

const isModalOpen = ref(false)
const selectedOrder = ref<Order | null>(null)
const selectedCourierId = ref<number | null>(null)
const isAssigning = ref(false)

const openAssignModal = async (order: Order) => {
  selectedOrder.value = order
  selectedCourierId.value = order.courierId ?? null
  isModalOpen.value = true
  await loadCouriers()
}

const handleAssignCourier = async () => {
  if (!selectedOrder.value || !selectedCourierId.value) return

  isAssigning.value = true
  try {
    await store.assignCourier(selectedOrder.value.id, { courierId: selectedCourierId.value })
    toast.success('Courier assigned')
    isModalOpen.value = false
  } catch {
    toast.error(store.error ?? 'Failed to assign courier')
  } finally {
    isAssigning.value = false
  }
}

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

const isNewOrder = (order: Order): boolean => {
  if (!order.createdAt) return false
  if (order.status !== OrderStatus.Pending) return false
  const ageMin = (Date.now() - new Date(order.createdAt).getTime()) / 60000
  return ageMin < NEW_ORDER_THRESHOLD_MIN
}

const orderTitle = (order: Order): string =>
  order.clientName ?? `Client #${order.clientId}`

const totalItemCount = (order: Order): number =>
  (order.items ?? []).reduce((sum, i) => sum + i.quantity, 0)

const counts = computed(() => {
  const result: Record<TabKey, number> = { active: 0, waiting: 0, done: 0 }
  for (const o of store.orders) {
    for (const tab of TABS) {
      if (tab.statuses.includes(o.status)) {
        result[tab.key] += 1
        break
      }
    }
  }
  return result
})

const visibleOrders = computed(() => {
  const tab = TABS.find((t) => t.key === activeTab.value)
  if (!tab) return []
  return [...store.orders]
    .filter((o) => tab.statuses.includes(o.status))
    .sort((a, b) => {
      const aT = a.createdAt ? new Date(a.createdAt).getTime() : 0
      const bT = b.createdAt ? new Date(b.createdAt).getTime() : 0
      return bT - aT || b.id - a.id
    })
})

onMounted(async () => {
  await store.fetchSupplier()
  if (store.error) toast.error(store.error)
})
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <div>
        <h1 class="text-3xl font-bold text-gray-900">Incoming Orders</h1>
        <p class="text-sm text-gray-400 mt-1">Orders placed by clients</p>
      </div>
      <span
        v-if="!store.loading && store.orders.length"
        class="text-sm bg-blue-50 text-blue-700 border border-blue-100 px-3 py-1 rounded-full font-medium"
      >
        {{ store.orders.length }} {{ store.orders.length === 1 ? 'order' : 'orders' }}
      </span>
    </div>

    <div v-if="!store.loading && store.orders.length" class="flex items-center gap-1 mb-5 border-b border-gray-200">
      <button
        v-for="tab in TABS"
        :key="tab.key"
        class="relative px-4 py-2.5 text-sm font-medium transition-colors flex items-center gap-2"
        :class="activeTab === tab.key
          ? 'text-blue-600'
          : 'text-gray-500 hover:text-gray-700'"
        @click="activeTab = tab.key"
      >
        <span>{{ tab.label }}</span>
        <span
          v-if="counts[tab.key] > 0"
          class="text-xs px-1.5 py-0.5 rounded-full"
          :class="activeTab === tab.key ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'"
        >
          {{ counts[tab.key] }}
        </span>
        <span
          v-if="activeTab === tab.key"
          class="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600"
        />
      </button>
    </div>

    <div v-if="store.loading" class="flex items-center justify-center py-20">
      <AppSpinner size="lg" />
    </div>

    <div
      v-else-if="store.error"
      class="bg-red-50 border border-red-100 rounded-2xl p-6 text-center"
    >
      <p class="text-sm text-red-600">{{ store.error }}</p>
      <AppButton variant="ghost" size="sm" class="mt-3" @click="store.fetchSupplier()">
        Try again
      </AppButton>
    </div>

    <div v-else-if="!store.orders.length" class="text-center py-20">
      <p class="text-4xl mb-3">📋</p>
      <p class="text-base font-semibold text-gray-900 mb-1">No orders yet</p>
      <p class="text-sm text-gray-400">Orders will appear here when clients place them</p>
    </div>

    <div v-else-if="!visibleOrders.length" class="text-center py-16">
      <p class="text-sm text-gray-500">
        Nothing in <span class="font-semibold">{{ TABS.find((t) => t.key === activeTab)?.label }}</span>
      </p>
    </div>

    <div v-else class="flex flex-col gap-4">
      <article
        v-for="order in visibleOrders"
        :key="order.id"
        class="relative bg-white border rounded-2xl p-5 flex flex-col gap-4 transition-shadow"
        :class="isNewOrder(order)
          ? 'border-blue-300 shadow-md ring-2 ring-blue-100'
          : 'border-gray-100'"
      >
        <span
          v-if="isNewOrder(order)"
          class="absolute -top-2 -right-2 inline-flex items-center px-2 py-0.5 rounded-full bg-blue-600 text-white text-[10px] font-bold uppercase tracking-wide shadow-sm animate-pulse"
        >
          New
        </span>

        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0 flex-1">
            <h2 class="text-lg font-bold text-gray-900 truncate">
              {{ orderTitle(order) }}
            </h2>
            <p class="text-xs text-gray-400 mt-0.5 flex items-center gap-1.5">
              <span>Order #{{ order.id }}</span>
              <span class="text-gray-300">·</span>
              <span :title="formatDateTime(order.createdAt)">
                {{ formatRelative(order.createdAt) }}
              </span>
            </p>
          </div>
          <div class="flex-shrink-0 text-right">
            <p class="text-xs text-gray-400 uppercase tracking-wide">Your payout</p>
            <p class="text-2xl font-bold text-emerald-600 whitespace-nowrap">
              {{ formatPrice(order.totalAmount) }}
            </p>
          </div>
        </div>

        <div
          v-if="order.status === OrderStatus.Pending ||
                order.status === OrderStatus.Accepted ||
                order.status === OrderStatus.ReadyForDelivery"
          class="flex items-center gap-1"
        >
          <template v-for="(s, i) in SUPPLIER_FLOW" :key="s">
            <div class="flex flex-col items-center gap-1 flex-1">
              <div
                class="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-semibold transition-colors"
                :class="
                  i < supplierStepIndex(order.status)
                    ? 'bg-blue-600 text-white'
                    : i === supplierStepIndex(order.status)
                      ? 'bg-blue-100 text-blue-700 ring-2 ring-blue-500 ring-offset-2'
                      : 'bg-gray-100 text-gray-400'
                "
              >
                <svg v-if="i < supplierStepIndex(order.status)" class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                <template v-else>{{ i + 1 }}</template>
              </div>
              <span
                class="text-[10px] font-medium text-center leading-tight"
                :class="i <= supplierStepIndex(order.status) ? 'text-gray-700' : 'text-gray-400'"
              >
                {{ supplierStepLabel[s] }}
              </span>
            </div>
            <div
              v-if="i < SUPPLIER_FLOW.length - 1"
              class="flex-1 h-0.5 -mt-4 transition-colors"
              :class="i < supplierStepIndex(order.status) ? 'bg-blue-600' : 'bg-gray-200'"
            />
          </template>
        </div>

        <div
          v-else
          class="flex items-center gap-2 rounded-xl px-4 py-2.5"
          :class="order.status === OrderStatus.Delivered
            ? 'bg-emerald-50 border border-emerald-100'
            : 'bg-purple-50 border border-purple-100'"
        >
          <svg
            class="w-5 h-5"
            :class="order.status === OrderStatus.Delivered ? 'text-emerald-600' : 'text-purple-600'"
            fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"
          >
            <path
              v-if="order.status === OrderStatus.Delivered"
              stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"
            />
            <path
              v-else
              stroke-linecap="round" stroke-linejoin="round" d="M9 17a2 2 0 104 0m-4 0a2 2 0 11-4 0m4 0V7m6 10a2 2 0 104 0m-4 0a2 2 0 114 0m-4 0V7m-12 0h16"
            />
          </svg>
          <p class="text-sm font-semibold"
             :class="order.status === OrderStatus.Delivered ? 'text-emerald-800' : 'text-purple-800'">
            {{ supplierStepLabel[order.status] }}
          </p>
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
                {{ totalItemCount(order) }} {{ totalItemCount(order) === 1 ? 'item' : 'items' }} to pack
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
              <span class="text-gray-500 whitespace-nowrap">
                {{ formatPrice(item.priceAtPurchase * item.quantity) }}
              </span>
            </li>
          </ul>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <div class="bg-gray-50 rounded-xl px-4 py-3">
            <p class="text-xs text-gray-400 mb-1">Delivery address</p>
            <p class="text-gray-700 font-medium truncate" :title="order.deliveryAddress">
              {{ order.deliveryAddress }}
            </p>
          </div>
          <div class="bg-gray-50 rounded-xl px-4 py-3">
            <p class="text-xs text-gray-400 mb-1">Courier</p>
            <p class="text-gray-700 font-medium">
              {{ order.courierId ? `ID: ${order.courierId}` : 'Not assigned' }}
            </p>
          </div>
        </div>

        <div class="flex items-center justify-between gap-2 text-xs text-gray-500 px-1">
          <span>Items: <span class="font-medium text-gray-700">{{ formatPrice(order.totalAmount) }}</span></span>
          <span>Delivery: <span class="font-medium text-gray-700">{{ formatPrice(order.deliveryFee) }}</span></span>
          <span>Customer paid: <span class="font-medium text-gray-700">{{ formatPrice(order.totalAmount + order.deliveryFee) }}</span></span>
        </div>

        <div class="flex items-center justify-end gap-2 pt-1 border-t border-gray-50">
          <AppButton
            v-if="order.status === OrderStatus.ReadyForDelivery"
            variant="secondary"
            size="sm"
            @click="openAssignModal(order)"
          >
            {{ order.courierId ? 'Change courier' : 'Assign courier' }}
          </AppButton>
          <AppButton
            v-if="nextStatus[order.status]"
            size="sm"
            :loading="updatingIds.has(order.id)"
            @click="handleStatusUpdate(order)"
          >
            {{ nextStatusLabel[order.status] }}
          </AppButton>
        </div>
      </article>
    </div>

    <AppModal v-model="isModalOpen" title="Assign courier">
      <div class="flex flex-col gap-4">
        <p class="text-sm text-gray-500">
          Order <span class="font-semibold text-gray-900">#{{ selectedOrder?.id }}</span>
        </p>

        <div v-if="couriersLoading" class="flex items-center justify-center py-6">
          <AppSpinner size="md" />
        </div>

        <div v-else-if="!couriers.length" class="text-center py-6 text-sm text-gray-400">
          No couriers registered in the system
        </div>

        <div v-else class="flex flex-col gap-2">
          <button
            v-for="courier in couriers"
            :key="courier.id"
            class="flex items-center gap-3 px-4 py-3 rounded-xl border transition-colors text-left"
            :class="selectedCourierId === courier.id
              ? 'border-blue-400 bg-blue-50'
              : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'"
            @click="selectedCourierId = courier.id"
          >
            <div
              class="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
              :class="selectedCourierId === courier.id
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-500'"
            >
              {{ courier.fullName.charAt(0).toUpperCase() }}
            </div>

            <div class="flex-1 min-w-0">
              <p class="text-sm font-medium text-gray-900 truncate">{{ courier.fullName }}</p>
              <p class="text-xs text-gray-400 truncate">{{ courier.email }}</p>
            </div>

            <svg
              v-if="selectedCourierId === courier.id"
              class="w-4 h-4 text-blue-600 flex-shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              stroke-width="2.5"
            >
              <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </button>
        </div>
      </div>

      <template #footer>
        <AppButton variant="secondary" @click="isModalOpen = false">Cancel</AppButton>
        <AppButton
          :disabled="!selectedCourierId"
          :loading="isAssigning"
          @click="handleAssignCourier"
        >
          Assign
        </AppButton>
      </template>
    </AppModal>
  </div>
</template>
