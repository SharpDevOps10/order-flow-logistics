<script setup lang="ts">
import { reactive } from 'vue'
import { useRouter, RouterLink } from 'vue-router'
import { useAuthStore } from '@/stores/auth.store'
import { UserRole } from '@/types/auth.types'
import AppButton from '@/components/common/AppButton.vue'
import AppInput from '@/components/common/AppInput.vue'

const router = useRouter()
const authStore = useAuthStore()

const ROLE_HOME: Record<UserRole, string> = {
  [UserRole.Client]: '/client/marketplace',
  [UserRole.Supplier]: '/supplier/organizations',
  [UserRole.Courier]: '/courier/deliveries',
  [UserRole.Admin]: '/admin/pending',
}

const form = reactive({
  email: '',
  password: '',
})

const fieldErrors = reactive({
  email: '',
  password: '',
})

const validate = (): boolean => {
  fieldErrors.email = ''
  fieldErrors.password = ''
  let valid = true

  if (!form.email.trim()) {
    fieldErrors.email = 'Введіть email'
    valid = false
  }
  if (!form.password) {
    fieldErrors.password = 'Введіть пароль'
    valid = false
  }

  return valid
}

const handleSubmit = async () => {
  if (!validate()) return

  try {
    await authStore.signIn({ email: form.email, password: form.password })
    const role = authStore.role
    if (role) router.push(ROLE_HOME[role])
  } catch {
    // error already stored in authStore.error
  }
}
</script>

<template>
  <div>
    <!-- Header -->
    <div class="mb-7">
      <h1 class="text-2xl font-bold text-gray-900">Увійти в систему</h1>
      <p class="text-sm text-gray-400 mt-1">Введіть свої дані для входу</p>
    </div>

    <!-- Form -->
    <form class="space-y-4" @submit.prevent="handleSubmit">

      <AppInput
        v-model="form.email"
        label="Email"
        type="email"
        placeholder="you@example.com"
        :error="fieldErrors.email"
      />

      <AppInput
        v-model="form.password"
        label="Пароль"
        type="password"
        placeholder="••••••••"
        :error="fieldErrors.password"
      />

      <!-- Server error -->
      <div
        v-if="authStore.error"
        class="bg-red-50 border border-red-100 rounded-xl px-4 py-3"
      >
        <p class="text-sm text-red-600">{{ authStore.error }}</p>
      </div>

      <AppButton
        type="submit"
        size="lg"
        :loading="authStore.loading"
        class="w-full"
      >
        Увійти
      </AppButton>
    </form>

    <!-- Divider -->
    <div class="flex items-center gap-3 my-6">
      <div class="flex-1 h-px bg-gray-100" />
      <span class="text-xs text-gray-400">або</span>
      <div class="flex-1 h-px bg-gray-100" />
    </div>

    <!-- Link to register -->
    <p class="text-center text-sm text-gray-500">
      Немає акаунту?
      <RouterLink to="/register" class="text-blue-600 font-medium hover:underline ml-1">
        Зареєструватися
      </RouterLink>
    </p>
  </div>
</template>
