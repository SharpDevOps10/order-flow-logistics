<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useOrganizationsStore } from '@/stores/organizations.store'
import { useProductsStore } from '@/stores/products.store'
import { useCartStore } from '@/stores/cart.store'
import { useToast } from '@/composables/useToast'
import type { Product } from '@/types/product.types'
import AppButton from '@/components/common/AppButton.vue'
import AppBadge from '@/components/common/AppBadge.vue'
import AppSpinner from '@/components/common/AppSpinner.vue'

const route = useRoute()
const router = useRouter()
const orgsStore = useOrganizationsStore()
const productsStore = useProductsStore()
const cart = useCartStore()
const toast = useToast()

const orgId = Number(route.params.id)

const org = computed(() => orgsStore.organizations.find((o) => o.id === orgId) ?? null)

const goBack = () => router.push({ name: 'marketplace' })
const goToCheckout = () => router.push({ name: 'checkout' })

const handleAddToCart = (product: Product) => {
  const switchingOrg = cart.organizationId !== null && cart.organizationId !== orgId
  cart.addItem(product)

  if (switchingOrg) {
    toast.info('Cart cleared — items from one organization only')
  } else {
    toast.success(`${product.name} added to cart`)
  }
}

const cartQty = (productId: number) =>
  cart.items.find((i) => i.product.id === productId)?.quantity ?? 0

onMounted(async () => {
  if (!orgsStore.organizations.length) {
    await orgsStore.fetchAll()
  }
  await productsStore.fetchByOrg(orgId)
  if (productsStore.error) toast.error(productsStore.error)
})
</script>

<template>
  <div>

    <!-- Header -->
    <div class="flex items-center gap-3 mb-6">
      <button
        class="text-gray-400 hover:text-gray-700 transition-colors p-1.5 rounded-lg hover:bg-gray-100"
        @click="goBack"
      >
        <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
      </button>
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2">
          <h1 class="text-3xl font-bold text-gray-900 truncate">
            {{ org?.name ?? 'Organization' }}
          </h1>
          <AppBadge v-if="org" variant="green">Approved</AppBadge>
        </div>
        <p v-if="org?.region" class="text-sm text-gray-400 mt-1">{{ org.region }}</p>
      </div>

      <!-- Cart button -->
      <button
        v-if="!cart.isEmpty && cart.organizationId === orgId"
        class="flex items-center gap-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl transition-colors"
        @click="goToCheckout"
      >
        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-1.5 6M17 13l1.5 6M9 19a1 1 0 100 2 1 1 0 000-2zm8 0a1 1 0 100 2 1 1 0 000-2z" />
        </svg>
        Checkout · {{ cart.itemCount }}
      </button>
    </div>

    <!-- Products loading -->
    <div v-if="productsStore.loading" class="flex items-center justify-center py-20">
      <AppSpinner size="lg" />
    </div>

    <!-- Products error -->
    <div
      v-else-if="productsStore.error"
      class="bg-red-50 border border-red-100 rounded-2xl p-6 text-center"
    >
      <p class="text-sm text-red-600">{{ productsStore.error }}</p>
      <AppButton variant="ghost" size="sm" class="mt-3" @click="productsStore.fetchByOrg(orgId)">
        Try again
      </AppButton>
    </div>

    <!-- Empty -->
    <div v-else-if="!productsStore.products.length" class="text-center py-20">
      <p class="text-4xl mb-3">📦</p>
      <p class="text-base font-semibold text-gray-900 mb-1">No products available</p>
      <p class="text-sm text-gray-400">This organization has no products yet</p>
    </div>

    <!-- Products grid -->
    <div v-else class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      <div
        v-for="product in productsStore.products"
        :key="product.id"
        class="bg-white border border-gray-100 rounded-2xl p-5 flex flex-col gap-4 hover:shadow-sm transition-shadow"
      >
        <div class="flex-1">
          <p class="text-base font-semibold text-gray-900">{{ product.name }}</p>
          <p v-if="product.description" class="text-sm text-gray-500 mt-1">
            {{ product.description }}
          </p>
        </div>

        <div class="flex items-center justify-between">
          <p class="text-lg font-bold text-gray-900">₴{{ product.price.toFixed(2) }}</p>

          <!-- Add / quantity controls -->
          <div v-if="cartQty(product.id) > 0" class="flex items-center gap-2">
            <button
              class="w-7 h-7 rounded-lg border border-gray-200 hover:bg-gray-50 flex items-center justify-center text-gray-600 transition-colors"
              @click="cart.updateQuantity(product.id, cartQty(product.id) - 1)"
            >
              −
            </button>
            <span class="text-sm font-semibold text-gray-900 w-5 text-center">
              {{ cartQty(product.id) }}
            </span>
            <button
              class="w-7 h-7 rounded-lg border border-gray-200 hover:bg-gray-50 flex items-center justify-center text-gray-600 transition-colors"
              @click="cart.addItem(product)"
            >
              +
            </button>
          </div>
          <AppButton v-else size="sm" @click="handleAddToCart(product)">
            Add to cart
          </AppButton>
        </div>
      </div>
    </div>

  </div>
</template>
