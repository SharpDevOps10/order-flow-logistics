<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useCartStore } from '@/stores/cart.store'
import { useOrdersStore } from '@/stores/orders.store'
import { useToast } from '@/composables/useToast'
import { useGeocoding } from '@/composables/useGeocoding'
import { OrdersApi, type PricingBreakdown } from '@/api/orders.api'
import AppButton from '@/components/common/AppButton.vue'
import AppSpinner from '@/components/common/AppSpinner.vue'

const router = useRouter()
const cart = useCartStore()
const ordersStore = useOrdersStore()
const toast = useToast()
const { isLocating, isGeocoding, locationError, detectLocation, geocodeAddress } = useGeocoding()

const deliveryAddress = ref('')
const addressError = ref('')
const coords = ref<{ lat: string; lng: string } | null>(null)
const quote = ref<PricingBreakdown | null>(null)
const quoteLoading = ref(false)
const showBreakdown = ref(false)

const grandTotal = computed(
  () => cart.total + (quote.value?.finalFee ?? 0),
)

const fetchQuote = async () => {
  if (!cart.organizationId) return
  quoteLoading.value = true
  try {
    quote.value = await OrdersApi.quoteDelivery({
      organizationId: cart.organizationId,
      ...(coords.value && { lat: coords.value.lat, lng: coords.value.lng }),
    })
  } catch {
    quote.value = null
  } finally {
    quoteLoading.value = false
  }
}

watch(
  coords,
  () => {
    fetchQuote()
  },
  { immediate: true },
)

const goBack = () => router.back()

const handleDetectLocation = async () => {
  const result = await detectLocation()
  if (result) {
    deliveryAddress.value = result.address
    coords.value = result.coords
    toast.success('Location detected')
  }
}

const handleFindCoords = async () => {
  const result = await geocodeAddress(deliveryAddress.value)
  if (result) {
    coords.value = result
    toast.success('Coordinates found')
  }
}

const handlePlaceOrder = async () => {
  addressError.value = ''
  if (!deliveryAddress.value.trim()) {
    addressError.value = 'Delivery address is required'
    return
  }
  if (!cart.organizationId) return

  try {
    await ordersStore.create({
      organizationId: cart.organizationId,
      deliveryAddress: deliveryAddress.value.trim(),
      ...(coords.value && { lat: coords.value.lat, lng: coords.value.lng }),
      items: cart.items.map((i) => ({
        productId: i.product.id,
        quantity: i.quantity,
      })),
    })
    cart.clear()
    toast.success('Order placed successfully')
    router.push({ name: 'my-orders' })
  } catch {
    toast.error(ordersStore.error ?? 'Failed to place order')
  }
}
</script>

<template>
  <div class="max-w-2xl">

        <div class="flex items-center gap-3 mb-8">
      <button
        class="text-gray-400 hover:text-gray-700 transition-colors p-1.5 rounded-lg hover:bg-gray-100"
        @click="goBack"
      >
        <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
      </button>
      <div>
        <h1 class="text-3xl font-bold text-gray-900">Checkout</h1>
        <p class="text-sm text-gray-400 mt-1">Review your order and confirm</p>
      </div>
    </div>

        <div v-if="cart.isEmpty" class="text-center py-20">
      <p class="text-4xl mb-3">🛒</p>
      <p class="text-base font-semibold text-gray-900 mb-1">Your cart is empty</p>
      <p class="text-sm text-gray-400 mb-6">Add products from the marketplace first</p>
      <AppButton @click="router.push({ name: 'marketplace' })">Go to Marketplace</AppButton>
    </div>

    <div v-else class="flex flex-col gap-5">

            <div class="bg-white border border-gray-100 rounded-2xl p-5 flex flex-col gap-1">
        <p class="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Order items</p>

        <div
          v-for="item in cart.items"
          :key="item.product.id"
          class="flex items-center justify-between py-3 border-b border-gray-50 last:border-0"
        >
          <div>
            <p class="text-sm font-medium text-gray-900">{{ item.product.name }}</p>
            <p class="text-xs text-gray-400 mt-0.5">₴{{ item.product.price.toFixed(2) }} × {{ item.quantity }}</p>
          </div>
          <p class="text-sm font-semibold text-gray-900">
            ₴{{ (item.product.price * item.quantity).toFixed(2) }}
          </p>
        </div>

                <div class="flex items-center justify-between pt-3 mt-1">
          <p class="text-base font-semibold text-gray-900">Total</p>
          <p class="text-xl font-bold text-gray-900">₴{{ cart.total.toFixed(2) }}</p>
        </div>
      </div>

            <div class="bg-white border border-gray-100 rounded-2xl p-5 flex flex-col gap-4">
        <p class="text-xs font-semibold text-gray-400 uppercase tracking-wide">Delivery details</p>

                <div class="flex flex-col gap-1">
          <label class="text-sm font-medium text-gray-700">Delivery address</label>
          <div class="flex gap-2">
            <input
              v-model="deliveryAddress"
              type="text"
              placeholder="Street, building, apartment"
              class="flex-1 border rounded-xl px-3 py-2 text-sm text-gray-900 placeholder-gray-400 bg-white transition focus:outline-none focus:ring-2 focus:border-transparent"
              :class="addressError ? 'border-red-400 focus:ring-red-400' : 'border-gray-200 focus:ring-blue-500'"
              @input="coords = null"
            />
                        <button
              v-if="deliveryAddress && !coords"
              class="flex-shrink-0 flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 border border-blue-200 hover:border-blue-300 hover:bg-blue-50 px-3 py-2 rounded-xl transition-colors disabled:opacity-50"
              :disabled="isGeocoding"
              @click="handleFindCoords"
            >
              <AppSpinner v-if="isGeocoding" size="sm" />
              <svg v-else class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <circle cx="11" cy="11" r="8" /><path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-4.35-4.35" />
              </svg>
              Find
            </button>
          </div>
          <p v-if="addressError" class="text-xs text-red-500">{{ addressError }}</p>
        </div>

                <button
          class="self-start flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 border border-gray-200 hover:border-gray-300 hover:bg-gray-50 px-3 py-2 rounded-xl transition-colors disabled:opacity-50"
          :disabled="isLocating"
          @click="handleDetectLocation"
        >
          <AppSpinner v-if="isLocating" size="sm" />
          <svg v-else class="w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 110-5 2.5 2.5 0 010 5z" />
          </svg>
          Use my current location
        </button>

                <div
          v-if="coords"
          class="flex items-center gap-2 text-xs text-green-700 bg-green-50 border border-green-100 rounded-xl px-3 py-2"
        >
          <svg class="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          Coordinates detected: {{ Number(coords.lat).toFixed(5) }}, {{ Number(coords.lng).toFixed(5) }}
        </div>

                <p v-if="locationError" class="text-xs text-red-500">{{ locationError }}</p>
      </div>

            <div class="bg-white border border-gray-100 rounded-2xl p-5 flex flex-col gap-3">
        <div class="flex items-center justify-between">
          <p class="text-xs font-semibold text-gray-400 uppercase tracking-wide">Delivery fee</p>
          <button
            v-if="quote"
            type="button"
            class="text-xs text-blue-600 hover:underline font-medium"
            @click="showBreakdown = !showBreakdown"
          >
            {{ showBreakdown ? 'Hide' : 'Show' }} breakdown
          </button>
        </div>

        <div v-if="quoteLoading" class="flex items-center gap-2 text-sm text-gray-400">
          <AppSpinner size="sm" /> Calculating…
        </div>

        <template v-else-if="quote">
          <div class="flex items-center justify-between">
            <span class="text-sm text-gray-700">
              <template v-if="!coords">
                Estimated (set address coords for accurate price)
              </template>
              <template v-else>
                {{ quote.distanceKm.toFixed(2) }} km from supplier
              </template>
            </span>
            <span class="text-lg font-bold text-gray-900">₴{{ quote.finalFee }}</span>
          </div>

          <div
            v-if="showBreakdown"
            class="bg-gray-50 rounded-xl p-3 flex flex-col gap-1.5 text-sm"
          >
            <div
              v-for="(item, i) in quote.items"
              :key="i"
              class="flex items-center justify-between"
            >
              <div class="flex flex-col">
                <span class="text-gray-700 font-medium">{{ item.label }}</span>
                <span v-if="item.detail" class="text-xs text-gray-400">{{ item.detail }}</span>
              </div>
              <span
                class="font-mono"
                :class="item.amount >= 0 ? 'text-gray-900' : 'text-green-600'"
              >
                {{ item.amount >= 0 ? '+' : '' }}₴{{ item.amount }}
              </span>
            </div>
            <div class="flex items-center justify-between pt-2 mt-1 border-t border-gray-200">
              <span class="font-semibold text-gray-900">Total</span>
              <span class="font-bold text-gray-900">₴{{ quote.finalFee }}</span>
            </div>
          </div>

          <div
            v-if="quote.loadMultiplier > 1"
            class="flex items-center gap-1.5 text-xs text-orange-600 bg-orange-50 border border-orange-100 rounded-lg px-2.5 py-1.5"
          >
            🔥 High demand right now ({{ quote.activeOrders }} orders, {{ quote.availableCouriers }} couriers)
          </div>
        </template>
      </div>

            <div class="bg-white border border-gray-100 rounded-2xl p-5 flex items-center justify-between">
        <p class="text-base font-semibold text-gray-900">Total to pay</p>
        <p class="text-2xl font-bold text-gray-900">₴{{ grandTotal.toFixed(2) }}</p>
      </div>

            <div class="flex items-center justify-between">
        <AppButton variant="ghost" @click="goBack">Back</AppButton>
        <AppButton :loading="ordersStore.loading" @click="handlePlaceOrder">
          Place order · ₴{{ grandTotal.toFixed(2) }}
        </AppButton>
      </div>

    </div>

  </div>
</template>
