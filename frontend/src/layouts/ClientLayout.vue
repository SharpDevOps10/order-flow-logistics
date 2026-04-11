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
    <nav class="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
      <div class="flex items-center gap-6">
        <span class="font-semibold text-gray-900">Order Flow</span>
        <RouterLink
          to="/client/marketplace"
          class="text-gray-600 hover:text-gray-900 text-sm"
          active-class="text-blue-600 font-medium"
        >
          Marketplace
        </RouterLink>
        <RouterLink
          to="/client/orders"
          class="text-gray-600 hover:text-gray-900 text-sm"
          active-class="text-blue-600 font-medium"
        >
          My Orders
        </RouterLink>
      </div>
      <button class="text-sm text-gray-500 hover:text-gray-700" @click="handleLogout">
        Logout
      </button>
    </nav>
    <main class="max-w-6xl mx-auto px-6 py-8">
      <RouterView />
    </main>
  </div>
</template>
