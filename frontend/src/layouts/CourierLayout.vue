<script setup lang="ts">
import { RouterView, RouterLink } from 'vue-router'
import { useAuthStore } from '@/stores/auth.store'
import { useRouter } from 'vue-router'
import { useCourierSocket } from '@/composables/useCourierSocket'

const authStore = useAuthStore()
const router = useRouter()

useCourierSocket()

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
            <span class="text-xs bg-orange-50 text-orange-700 px-2 py-0.5 rounded-full font-medium">Courier</span>
          </div>
          <div class="flex items-center gap-1">
            <RouterLink
              to="/courier/deliveries"
              class="text-sm px-3 py-1.5 rounded-lg text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors"
              active-class="text-orange-700 font-medium bg-orange-50 hover:bg-orange-50 hover:text-orange-700"
            >
              My Deliveries
            </RouterLink>
            <RouterLink
              to="/courier/route"
              class="text-sm px-3 py-1.5 rounded-lg text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors"
              active-class="text-orange-700 font-medium bg-orange-50 hover:bg-orange-50 hover:text-orange-700"
            >
              Route Map
            </RouterLink>
          </div>
        </div>
        <!-- Right: user info + logout -->
        <div class="flex items-center gap-3">
          <div class="text-right">
            <p class="text-xs font-medium text-gray-700 leading-tight">{{ authStore.user?.email }}</p>
            <p class="text-xs text-gray-400 leading-tight">Courier</p>
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
