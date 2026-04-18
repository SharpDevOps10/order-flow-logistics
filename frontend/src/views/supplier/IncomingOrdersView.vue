<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useOrdersStore } from '@/stores/orders.store'
import { useToast } from '@/composables/useToast'
import { UsersApi } from '@/api/users.api'
import { OrderStatus } from '@/types/order.types'
import type { Order } from '@/types/order.types'
import type { CourierUser } from '@/types/user.types'
import AppButton from '@/components/common/AppButton.vue'
import AppBadge from '@/components/common/AppBadge.vue'
import AppSpinner from '@/components/common/AppSpinner.vue'
import AppModal from '@/components/common/AppModal.vue'

const store = useOrdersStore()
const toast = useToast()

const nextStatus: Partial<Record<OrderStatus, OrderStatus>> = {
  [OrderStatus.Pending]: OrderStatus.Accepted,
  [OrderStatus.Accepted]: OrderStatus.ReadyForDelivery,
}

const nextStatusLabel: Partial<Record<OrderStatus, string>> = {
  [OrderStatus.Pending]: 'Accept',
  [OrderStatus.Accepted]: 'Mark Ready for Delivery',
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

const updatingIds = ref<Set<number>>(new Set())

const handleStatusUpdate = async (order: Order) => {
  const next = nextStatus[order.status]
  if (!next) return

  updatingIds.value = new Set(updatingIds.value).add(order.id)
  try {
    await store.updateStatus(order.id, next)
    toast.success(`Status updated: ${statusLabel[next]}`)
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
        {{ store.orders.length }} orders
      </span>
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
      <p class="text-sm text-gray-400">New orders will appear here</p>
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
              {{ order.courierId ? `ID: ${order.courierId}` : 'Not assigned' }}
            </p>
          </div>
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
          <span v-else class="text-xs text-gray-400 px-3 py-1.5">Final status</span>
        </div>

      </div>
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
