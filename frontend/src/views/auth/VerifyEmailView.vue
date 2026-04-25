<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, RouterLink } from 'vue-router'
import { AuthApi } from '@/api/auth.api'

const route = useRoute()
const status = ref<'loading' | 'success' | 'error'>('loading')
const message = ref<string>('')

const extractErrorMessage = (error: unknown): string => {
  if (error && typeof error === 'object' && 'response' in error) {
    const axiosError = error as { response?: { data?: { message?: string } } }
    return axiosError.response?.data?.message ?? 'Verification failed'
  }
  return 'Verification failed'
}

onMounted(async () => {
  const token = route.query.token as string | undefined
  if (!token) {
    status.value = 'error'
    message.value = 'Verification token is missing.'
    return
  }
  try {
    const result = await AuthApi.verifyEmail(token)
    status.value = 'success'
    message.value = result.message
  } catch (e) {
    status.value = 'error'
    message.value = extractErrorMessage(e)
  }
})
</script>

<template>
  <div class="text-center">
    <template v-if="status === 'loading'">
      <div class="text-5xl mb-4">⏳</div>
      <h1 class="text-2xl font-bold text-gray-900 mb-2">Confirming your email…</h1>
      <p class="text-sm text-gray-500">Please wait a moment.</p>
    </template>

    <template v-else-if="status === 'success'">
      <div class="text-5xl mb-4">✅</div>
      <h1 class="text-2xl font-bold text-gray-900 mb-2">Email confirmed</h1>
      <p class="text-sm text-gray-500 mb-6">{{ message }}</p>
      <RouterLink
        to="/login"
        class="inline-block bg-blue-600 hover:bg-blue-700 text-white font-medium px-6 py-3 rounded-xl transition"
      >
        Go to Sign In
      </RouterLink>
    </template>

    <template v-else>
      <div class="text-5xl mb-4">❌</div>
      <h1 class="text-2xl font-bold text-gray-900 mb-2">Verification failed</h1>
      <p class="text-sm text-red-600 mb-6">{{ message }}</p>
      <RouterLink
        to="/login"
        class="inline-block text-sm text-blue-600 font-medium hover:underline"
      >
        Back to Sign In
      </RouterLink>
    </template>
  </div>
</template>
