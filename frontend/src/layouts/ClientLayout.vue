<script setup lang="ts">
import { RouterView, RouterLink, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth.store'
import { useCartStore } from '@/stores/cart.store'

const authStore = useAuthStore()
const cart = useCartStore()
const router = useRouter()

const handleLogout = async () => {
  await authStore.logout()
  router.push('/login')
}
</script>

<template>
  <div class="min-h-screen bg-gray-50">
    <nav class="bg-white border-b border-gray-200 sticky top-0 z-10">
      <div class="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">

                <div class="flex items-center gap-6">
          <div class="flex items-center gap-2">
            <span class="text-sm font-bold text-gray-900">OrderFlow</span>
            <span class="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-medium">Client</span>
          </div>
          <div class="flex items-center gap-1">
            <RouterLink
              to="/client/marketplace"
              class="text-sm px-3 py-1.5 rounded-lg text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors"
              active-class="text-blue-600 font-medium bg-blue-50 hover:bg-blue-50 hover:text-blue-600"
            >
              Marketplace
            </RouterLink>
            <RouterLink
              to="/client/orders"
              class="text-sm px-3 py-1.5 rounded-lg text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors"
              active-class="text-blue-600 font-medium bg-blue-50 hover:bg-blue-50 hover:text-blue-600"
            >
              My Orders
            </RouterLink>
          </div>
        </div>

                <div class="flex items-center gap-3">

                    <RouterLink
            to="/client/checkout"
            class="relative flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-1.5 6M17 13l1.5 6M9 19a1 1 0 100 2 1 1 0 000-2zm8 0a1 1 0 100 2 1 1 0 000-2z" />
            </svg>
            Cart
            <span
              v-if="cart.itemCount > 0"
              class="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-blue-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1"
            >
              {{ cart.itemCount }}
            </span>
          </RouterLink>

                    <div class="w-px h-5 bg-gray-200" />

                    <div class="text-right">
            <p class="text-xs font-medium text-gray-700 leading-tight">{{ authStore.user?.email }}</p>
            <p class="text-xs text-gray-400 leading-tight">Client</p>
          </div>

                    <button
            class="flex items-center gap-1.5 text-sm text-red-500 hover:text-red-600 border border-red-200 hover:border-red-300 hover:bg-red-50 transition-colors px-3 py-1.5 rounded-lg"
            @click="handleLogout"
          >
            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Logout
          </button>
        </div>

      </div>
    </nav>
    <main class="max-w-6xl mx-auto px-6 py-8">
      <RouterView />
    </main>
  </div>
</template>
