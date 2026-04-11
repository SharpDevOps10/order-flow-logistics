<script setup lang="ts">
import { RouterView, RouterLink } from 'vue-router'
import { useAuthStore } from '@/stores/auth.store'
import { useRouter } from 'vue-router'

const authStore = useAuthStore()
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
        <button
          class="text-sm text-gray-400 hover:text-gray-700 transition-colors px-3 py-1.5 rounded-lg hover:bg-gray-100"
          @click="handleLogout"
        >
          Logout
        </button>
      </div>
    </nav>
    <main class="max-w-6xl mx-auto px-6 py-8">
      <RouterView />
    </main>
  </div>
</template>
