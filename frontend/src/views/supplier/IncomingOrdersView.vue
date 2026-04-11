<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useOrdersStore } from '@/stores/orders.store'
import { useToast } from '@/composables/useToast'
import { OrderStatus } from '@/types/order.types'
import type { Order } from '@/types/order.types'
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

// Status update
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

// Assign courier modal
const isModalOpen = ref(false)
const selectedOrder = ref<Order | null>(null)
const courierIdInput = ref('')
const courierIdError = ref('')
const isAssigning = ref(false)

const openAssignModal = (order: Order) => {
  selectedOrder.value = order
  courierIdInput.value = order.courierId ? String(order.courierId) : ''
  courierIdError.value = ''
  isModalOpen.value = true
}

const handleAssignCourier = async () => {
  if (!selectedOrder.value) return
  courierIdError.value = ''

  const id = Number(courierIdInput.value)
  if (!courierIdInput.value || isNaN(id) || id <= 0) {
    courierIdError.value = 'Enter a valid courier ID'
    return
  }

  isAssigning.value = true
  try {
    await store.assignCourier(selectedOrder.value.id, { courierId: id })
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

    <!-- Header -->
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

    <!-- Loading -->
    <div v-if="store.loading" class="flex items-center justify-center py-20">
      <AppSpinner size="lg" />
    </div>

    <!-- Error -->
    <div
      v-else-if="store.error"
      class="bg-red-50 border border-red-100 rounded-2xl p-6 text-center"
    >
      <p class="text-sm text-red-600">{{ store.error }}</p>
      <AppButton variant="ghost" size="sm" class="mt-3" @click="store.fetchSupplier()">
        Try again
      </AppButton>
    </div>

    <!-- Empty -->
    <div v-else-if="!store.orders.length" class="text-center py-20">
      <p class="text-4xl mb-3">📋</p>
      <p class="text-base font-semibold text-gray-900 mb-1">No orders yet</p>
      <p class="text-sm text-gray-400">New orders will appear here</p>
    </div>

    <!-- Orders list -->
    <div v-else class="flex flex-col gap-4">
      <div
        v-for="order in store.orders"
        :key="order.id"
        class="bg-white border border-gray-100 rounded-2xl p-5 flex flex-col gap-4"
      >

        <!-- Order header -->
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

        <!-- Order details -->
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

        <!-- Actions -->
        <div class="flex items-center justify-end gap-2 pt-1 border-t border-gray-50">
          <AppButton variant="secondary" size="sm" @click="openAssignModal(order)">
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
          <span v-else class="text-xs text-gray-400 px-3 py-1.5">
            Final status
          </span>
        </div>

      </div>
    </div>

    <!-- Assign courier modal -->
    <AppModal v-model="isModalOpen" title="Assign courier">
      <div class="flex flex-col gap-4">
        <p class="text-sm text-gray-500">
          Order <span class="font-semibold text-gray-900">#{{ selectedOrder?.id }}</span>
        </p>

        <div class="flex flex-col gap-1">
          <label class="text-sm font-medium text-gray-700">Courier ID</label>
          <input
            v-model="courierIdInput"
            type="number"
            placeholder="Enter courier ID"
            class="w-full border rounded-xl px-3 py-2 text-sm text-gray-900 placeholder-gray-400 bg-white transition focus:outline-none focus:ring-2 focus:border-transparent"
            :class="
              courierIdError
                ? 'border-red-400 focus:ring-red-400'
                : 'border-gray-200 focus:ring-blue-500'
            "
          />
          <p v-if="courierIdError" class="text-xs text-red-500">{{ courierIdError }}</p>
        </div>
      </div>

      <template #footer>
        <AppButton variant="secondary" @click="isModalOpen = false">Cancel</AppButton>
        <AppButton :loading="isAssigning" @click="handleAssignCourier">Assign</AppButton>
      </template>
    </AppModal>

  </div>
</template>
