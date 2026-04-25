<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRoute, RouterLink } from 'vue-router'
import { AuthApi } from '@/api/auth.api'
import AppButton from '@/components/common/AppButton.vue'

const route = useRoute()
const email = computed(() => (route.query.email as string) ?? '')
const resending = ref(false)
const resendMessage = ref<string | null>(null)
const resendError = ref<string | null>(null)

const extractErrorMessage = (error: unknown): string => {
  if (error && typeof error === 'object' && 'response' in error) {
    const axiosError = error as { response?: { data?: { message?: string } } }
    return axiosError.response?.data?.message ?? 'Could not resend email'
  }
  return 'Could not resend email'
}

const handleResend = async () => {
  if (!email.value) return
  resending.value = true
  resendMessage.value = null
  resendError.value = null
  try {
    const { message } = await AuthApi.resendVerification(email.value)
    resendMessage.value = message
  } catch (e) {
    resendError.value = extractErrorMessage(e)
  } finally {
    resending.value = false
  }
}
</script>

<template>
  <div class="text-center">
    <div class="text-5xl mb-4">📬</div>
    <h1 class="text-2xl font-bold text-gray-900 mb-2">Check your inbox</h1>
    <p class="text-sm text-gray-500 mb-6 leading-relaxed">
      We've sent a confirmation link to
      <span v-if="email" class="font-semibold text-gray-700">{{ email }}</span>
      <span v-else>your email</span>.
      Click the link in the email to activate your account, then sign in.
    </p>

    <div
      v-if="resendMessage"
      class="bg-green-50 border border-green-100 rounded-xl px-4 py-3 mb-4"
    >
      <p class="text-sm text-green-700">{{ resendMessage }}</p>
    </div>
    <div
      v-if="resendError"
      class="bg-red-50 border border-red-100 rounded-xl px-4 py-3 mb-4"
    >
      <p class="text-sm text-red-600">{{ resendError }}</p>
    </div>

    <AppButton
      v-if="email"
      type="button"
      size="lg"
      variant="secondary"
      :loading="resending"
      class="w-full mb-3"
      @click="handleResend"
    >
      Resend confirmation email
    </AppButton>

    <RouterLink
      to="/login"
      class="block text-sm text-blue-600 font-medium hover:underline mt-4"
    >
      Back to Sign In
    </RouterLink>
  </div>
</template>
