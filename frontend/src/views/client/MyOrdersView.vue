<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { useOrdersStore } from '@/stores/orders.store'
import { useOrganizationsStore } from '@/stores/organizations.store'
import { useToast } from '@/composables/useToast'
import { useOrderRealtime } from '@/composables/useOrderRealtime'
import { useClientOrderEtas } from '@/composables/useClientOrderEtas'
import { OrderStatus } from '@/types/order.types'
import type { Order } from '@/types/order.types'
import type { OrderReview, CourierRatingStats } from '@/types/review.types'
import { ReviewsApi } from '@/api/reviews.api'
import AppButton from '@/components/common/AppButton.vue'
import AppSpinner from '@/components/common/AppSpinner.vue'
import AppModal from '@/components/common/AppModal.vue'
import OrderRouteMap from '@/components/map/OrderRouteMap.vue'
import StarRating from '@/components/common/StarRating.vue'

const UNDO_DURATION = 5000

const store = useOrdersStore()
const orgsStore = useOrganizationsStore()
const router = useRouter()
const toast = useToast()

useOrderRealtime()
const { etaByOrder, contexts: etaContexts, courierPosByOrder } = useClientOrderEtas(computed(() => store.orders))

const getRouteForOrder = (orderId: number) => {
  const ctx = etaContexts.value.get(orderId)
  if (!ctx || !ctx.available) return null
  return (
    ctx.routes.find((r) =>
      r.waypoints.some((wp) => wp.type === 'DELIVERY' && wp.orderId === orderId),
    ) ?? null
  )
}

const expandedRoutes = ref<Set<number>>(new Set())
const expandedItems = ref<Set<number>>(new Set())

const toggleRoute = (orderId: number) => {
  if (expandedRoutes.value.has(orderId)) {
    expandedRoutes.value.delete(orderId)
  } else {
    expandedRoutes.value.add(orderId)
  }
}

const toggleItems = (orderId: number) => {
  if (expandedItems.value.has(orderId)) {
    expandedItems.value.delete(orderId)
  } else {
    expandedItems.value.add(orderId)
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

const isCourierEnRoute = (order: Order): boolean =>
  order.courierId !== null &&
  (order.status === OrderStatus.PickedUp ||
    order.status === OrderStatus.ReadyForDelivery)

const STATUS_FLOW: OrderStatus[] = [
  OrderStatus.Pending,
  OrderStatus.Accepted,
  OrderStatus.ReadyForDelivery,
  OrderStatus.PickedUp,
  OrderStatus.Delivered,
]

const statusLabel: Record<OrderStatus, string> = {
  [OrderStatus.Pending]: 'Pending',
  [OrderStatus.Accepted]: 'Accepted',
  [OrderStatus.ReadyForDelivery]: 'Ready',
  [OrderStatus.PickedUp]: 'In delivery',
  [OrderStatus.Delivered]: 'Delivered',
}

const stepIndex = (status: OrderStatus) => STATUS_FLOW.indexOf(status)

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
  const date = new Date(dateStr)
  const diffMs = Date.now() - date.getTime()
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

const reviewOrder = ref<Order | null>(null)
const isReviewModalOpen = ref(false)
const isSubmittingReview = ref(false)
const reviewForm = reactive({
  courierRating: 0,
  speedRating: 0,
  comment: '',
})

const openReviewModal = (order: Order) => {
  reviewOrder.value = order
  reviewForm.courierRating = 0
  reviewForm.speedRating = 0
  reviewForm.comment = ''
  isReviewModalOpen.value = true
}

const handleSubmitReview = async () => {
  if (!reviewOrder.value) return
  if (!reviewForm.courierRating || !reviewForm.speedRating) {
    toast.error('Please rate both courier and speed')
    return
  }
  isSubmittingReview.value = true
  try {
    const review = await ReviewsApi.create({
      orderId: reviewOrder.value.id,
      courierRating: reviewForm.courierRating,
      speedRating: reviewForm.speedRating,
      comment: reviewForm.comment.trim() || undefined,
    })
    reviews.value.set(review.orderId, review)
    if (reviewOrder.value.courierId) {
      const stats = await ReviewsApi.getCourierStats(reviewOrder.value.courierId)
      courierStats.value.set(reviewOrder.value.courierId, stats)
    }
    toast.success('Thanks for your feedback!')
    isReviewModalOpen.value = false
  } catch (e) {
    const msg =
      (e as { response?: { data?: { message?: string } } }).response?.data
        ?.message ?? 'Failed to submit review'
    toast.error(msg)
  } finally {
    isSubmittingReview.value = false
  }
}

interface PendingCancel {
  order: Order
  index: number
  timerId: ReturnType<typeof setTimeout>
}
let pendingCancel: PendingCancel | null = null

const flushPendingCancel = async () => {
  if (!pendingCancel) return
  const { order, timerId } = pendingCancel
  clearTimeout(timerId)
  pendingCancel = null
  try {
    await store.cancelOnServer(order.id)
  } catch {
    toast.error(store.error ?? 'Failed to cancel order')
    await store.fetchMy()
  }
}

const handleCancel = (order: Order) => {
  if (pendingCancel) void flushPendingCancel()

  const removed = store.removeLocal(order.id)
  if (!removed) return

  const undo = () => {
    if (!pendingCancel || pendingCancel.order.id !== order.id) return
    clearTimeout(pendingCancel.timerId)
    store.restoreLocal(pendingCancel.order, pendingCancel.index)
    pendingCancel = null
  }

  const timerId = setTimeout(() => {
    if (!pendingCancel || pendingCancel.order.id !== order.id) return
    const target = pendingCancel
    pendingCancel = null
    store.cancelOnServer(target.order.id).catch(() => {
      toast.error(store.error ?? 'Failed to cancel order')
      store.restoreLocal(target.order, target.index)
    })
  }, UNDO_DURATION)

  toast.success(`Order #${order.id} cancelled`, {
    duration: UNDO_DURATION,
    action: { label: 'Undo', onClick: undo },
  })

  pendingCancel = { order: removed.order, index: removed.index, timerId }
}

const isEtaEligible = (order: Order): boolean =>
  order.status === OrderStatus.ReadyForDelivery ||
  order.status === OrderStatus.PickedUp

const formatEtaLine = (arrivalAt: Date, minutes: number): string => {
  const hh = arrivalAt.getHours().toString().padStart(2, '0')
  const mm = arrivalAt.getMinutes().toString().padStart(2, '0')
  const mins = Math.max(0, Math.round(minutes))
  return `arrives in ~${mins} min · ${hh}:${mm}`
}

const etaUnavailableLabel = (reason: string): string => {
  if (reason === 'order-not-in-transit') return ''
  if (reason === 'no-route') return 'Route unavailable'
  if (reason === 'loading') return 'Calculating ETA...'
  return 'ETA unavailable'
}

const reviews = ref<Map<number, OrderReview>>(new Map())
const courierStats = ref<Map<number, CourierRatingStats>>(new Map())

const fetchReviewsAndStats = async () => {
  const delivered = store.orders.filter(
    (o) => o.status === OrderStatus.Delivered,
  )
  const reviewResults = await Promise.all(
    delivered.map(async (o) => {
      try {
        const r = await ReviewsApi.findByOrder(o.id)
        return r ? ([o.id, r] as const) : null
      } catch {
        return null
      }
    }),
  )
  const nextReviews = new Map<number, OrderReview>()
  for (const entry of reviewResults) if (entry) nextReviews.set(entry[0], entry[1])
  reviews.value = nextReviews

  const courierIds = Array.from(
    new Set(
      store.orders
        .filter((o) => o.courierId !== null)
        .map((o) => o.courierId as number),
    ),
  )
  const statsResults = await Promise.all(
    courierIds.map(async (cid) => {
      try {
        return [cid, await ReviewsApi.getCourierStats(cid)] as const
      } catch {
        return null
      }
    }),
  )
  const nextStats = new Map<number, CourierRatingStats>()
  for (const entry of statsResults) if (entry) nextStats.set(entry[0], entry[1])
  courierStats.value = nextStats
}

const orderTitle = (order: Order): string => {
  const org = getOrgForOrder(order)
  return org?.name ?? `Order #${order.id}`
}

const totalItemCount = (order: Order): number => {
  return (order.items ?? []).reduce((sum, i) => sum + i.quantity, 0)
}

const orderCount = computed(() => store.orders.length)
const orderCountLabel = computed(() =>
  orderCount.value === 1 ? '1 order' : `${orderCount.value} orders`,
)

onMounted(async () => {
  await Promise.all([store.fetchMy(), orgsStore.fetchAll()])
  if (store.error) toast.error(store.error)
  await fetchReviewsAndStats()
})

onBeforeUnmount(() => {
  void flushPendingCancel()
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
          {{ orderCountLabel }}
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
      <article
        v-for="order in store.orders"
        :key="order.id"
        class="bg-white border border-gray-100 rounded-2xl p-5 flex flex-col gap-4"
      >
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
            <p class="text-2xl font-bold text-blue-600 whitespace-nowrap">
              {{ formatPrice(order.totalAmount + order.deliveryFee) }}
            </p>
            <p v-if="order.deliveryFee > 0" class="text-xs text-gray-400 mt-0.5">
              incl. {{ formatPrice(order.deliveryFee) }} delivery
            </p>
          </div>
        </div>

        <div
          v-if="order.status !== OrderStatus.Delivered"
          class="flex items-center gap-1"
        >
          <template v-for="(s, i) in STATUS_FLOW" :key="s">
            <div class="flex flex-col items-center gap-1 flex-1">
              <div
                class="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-semibold transition-colors"
                :class="
                  i < stepIndex(order.status)
                    ? 'bg-blue-600 text-white'
                    : i === stepIndex(order.status)
                      ? 'bg-blue-100 text-blue-700 ring-2 ring-blue-500 ring-offset-2'
                      : 'bg-gray-100 text-gray-400'
                "
              >
                <svg v-if="i < stepIndex(order.status)" class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                <template v-else>{{ i + 1 }}</template>
              </div>
              <span
                class="text-[10px] font-medium text-center leading-tight"
                :class="i <= stepIndex(order.status) ? 'text-gray-700' : 'text-gray-400'"
              >
                {{ statusLabel[s] }}
              </span>
            </div>
            <div
              v-if="i < STATUS_FLOW.length - 1"
              class="flex-1 h-0.5 -mt-4 transition-colors"
              :class="i < stepIndex(order.status) ? 'bg-blue-600' : 'bg-gray-200'"
            />
          </template>
        </div>

        <div
          v-else
          class="flex items-center gap-2 bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-2.5"
        >
          <svg class="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          <p class="text-sm font-semibold text-emerald-800">Delivered</p>
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
                {{ totalItemCount(order) }} {{ totalItemCount(order) === 1 ? 'item' : 'items' }}
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
            <p class="text-gray-700 font-medium truncate" :title="order.courierName ?? ''">
              {{ order.courierId
                ? (order.courierName ?? `Courier #${order.courierId}`)
                : 'Not assigned yet' }}
            </p>
            <p
              v-if="order.courierId && courierStats.get(order.courierId)"
              class="text-xs text-gray-500 mt-1 flex items-center gap-1"
            >
              <span class="text-yellow-400">★</span>
              <span class="font-semibold text-gray-700">
                {{ courierStats.get(order.courierId)!.bayesianCourier.toFixed(2) }}
              </span>
              <span class="text-gray-400">
                ({{ courierStats.get(order.courierId)!.count }}
                {{ courierStats.get(order.courierId)!.count === 1 ? 'review' : 'reviews' }})
              </span>
            </p>
          </div>
        </div>

        <div
          v-if="isEtaEligible(order) && etaByOrder.get(order.id)"
          class="flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-xl px-4 py-2.5"
        >
          <svg class="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="9" />
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 7v5l3 2" />
          </svg>
          <template v-if="etaByOrder.get(order.id)!.available">
            <div class="flex-1 flex items-center gap-2">
              <p class="text-sm font-medium text-blue-800 flex-1">
                Your order {{ formatEtaLine(
                  (etaByOrder.get(order.id) as { arrivalAt: Date }).arrivalAt,
                  (etaByOrder.get(order.id) as { minutes: number }).minutes,
                ) }}
                <span
                  v-if="(etaByOrder.get(order.id) as { isFallbackSpeed: boolean }).isFallbackSpeed"
                  class="ml-1 text-[10px] text-blue-500/60"
                >(approximate)</span>
              </p>
              <span
                v-if="(etaByOrder.get(order.id) as { isPositionLive: boolean }).isPositionLive"
                class="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-700"
                title="Live tracking"
              >
                <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                LIVE
              </span>
            </div>
          </template>
          <template v-else>
            <p class="text-sm text-gray-500">{{ etaUnavailableLabel(etaByOrder.get(order.id)!.reason) }}</p>
          </template>
        </div>

        <div v-if="isCourierEnRoute(order) && canShowRoute(order)">
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
              :order-id="order.id"
              :route="getRouteForOrder(order.id)"
              :courier-pos="courierPosByOrder.get(order.id) ?? null"
            />
          </div>
        </div>

        <div
          v-if="order.status === OrderStatus.Pending"
          class="flex justify-end pt-1 border-t border-gray-50"
        >
          <button
            class="text-sm text-gray-500 hover:text-red-600 hover:bg-red-50 px-3 py-1.5 rounded-lg transition-colors"
            @click="handleCancel(order)"
          >
            Cancel order
          </button>
        </div>

        <div
          v-if="order.status === OrderStatus.Delivered"
          class="pt-1 border-t border-gray-50"
        >
          <div
            v-if="reviews.get(order.id)"
            class="flex flex-col gap-2 bg-yellow-50 border border-yellow-100 rounded-xl px-4 py-3"
          >
            <div class="flex items-center justify-between">
              <span class="text-xs text-gray-500 font-medium">Your review</span>
              <span class="text-xs text-gray-400">
                {{ formatDateTime(reviews.get(order.id)!.createdAt) }}
              </span>
            </div>
            <div class="grid grid-cols-2 gap-3">
              <div>
                <p class="text-xs text-gray-500 mb-0.5">Courier</p>
                <StarRating :model-value="reviews.get(order.id)!.courierRating" readonly size="sm" />
              </div>
              <div>
                <p class="text-xs text-gray-500 mb-0.5">Speed</p>
                <StarRating :model-value="reviews.get(order.id)!.speedRating" readonly size="sm" />
              </div>
            </div>
            <p
              v-if="reviews.get(order.id)!.comment"
              class="text-sm text-gray-600 italic mt-1"
            >
              "{{ reviews.get(order.id)!.comment }}"
            </p>
          </div>
          <div v-else class="flex justify-end">
            <AppButton size="sm" @click="openReviewModal(order)">
              ★ Rate delivery
            </AppButton>
          </div>
        </div>
      </article>
    </div>

    <AppModal v-model="isReviewModalOpen" title="Rate your delivery">
      <div class="flex flex-col gap-5">
        <p class="text-sm text-gray-600">
          How did
          <span class="font-semibold text-gray-900">Order #{{ reviewOrder?.id }}</span>
          go? Your feedback helps us route to the best couriers.
        </p>

        <div class="flex flex-col gap-2">
          <label class="text-sm font-medium text-gray-700">Courier</label>
          <p class="text-xs text-gray-400 -mt-1">Politeness, care, communication</p>
          <StarRating v-model="reviewForm.courierRating" size="lg" />
        </div>

        <div class="flex flex-col gap-2">
          <label class="text-sm font-medium text-gray-700">Speed</label>
          <p class="text-xs text-gray-400 -mt-1">How fast the order arrived</p>
          <StarRating v-model="reviewForm.speedRating" size="lg" />
        </div>

        <div class="flex flex-col gap-2">
          <label class="text-sm font-medium text-gray-700">Comment <span class="text-gray-400 font-normal">(optional)</span></label>
          <textarea
            v-model="reviewForm.comment"
            rows="3"
            maxlength="1000"
            class="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 resize-none"
            placeholder="Anything you'd like to share?"
          />
        </div>
      </div>

      <template #footer>
        <AppButton variant="secondary" @click="isReviewModalOpen = false">Cancel</AppButton>
        <AppButton :loading="isSubmittingReview" @click="handleSubmitReview">
          Submit review
        </AppButton>
      </template>
    </AppModal>
  </div>
</template>
