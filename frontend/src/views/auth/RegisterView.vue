<script setup lang="ts">
import { reactive } from 'vue'
import { useRouter, RouterLink } from 'vue-router'
import { useAuthStore } from '@/stores/auth.store'
import { UserRole } from '@/types/auth.types'
import AppButton from '@/components/common/AppButton.vue'
import AppInput from '@/components/common/AppInput.vue'

const router = useRouter()
const authStore = useAuthStore()

type RoleOption = {
  value: UserRole
  label: string
  description: string
  icon: string
}

const roleOptions: RoleOption[] = [
  {
    value: UserRole.Client,
    label: 'Client',
    description: 'I buy products',
    icon: '🛍️',
  },
  {
    value: UserRole.Supplier,
    label: 'Supplier',
    description: 'I sell products',
    icon: '🏪',
  },
  {
    value: UserRole.Courier,
    label: 'Courier',
    description: 'I deliver orders',
    icon: '🚴',
  },
]

const form = reactive({
  fullName: '',
  email: '',
  password: '',
  role: '' as UserRole | '',
})

const fieldErrors = reactive({
  fullName: '',
  email: '',
  password: '',
  role: '',
})

const validate = (): boolean => {
  fieldErrors.fullName = ''
  fieldErrors.email = ''
  fieldErrors.password = ''
  fieldErrors.role = ''
  let valid = true

  if (!form.fullName.trim()) {
    fieldErrors.fullName = "Enter your full name"
    valid = false
  }
  if (!form.email.trim()) {
    fieldErrors.email = 'Enter your email'
    valid = false
  }
  if (!form.password || form.password.length < 6) {
    fieldErrors.password = 'Minimum 6 characters'
    valid = false
  }
  if (!form.role) {
    fieldErrors.role = 'Select a role'
    valid = false
  }

  return valid
}

const handleSubmit = async () => {
  if (!validate()) return

  try {
    const response = await authStore.signUp({
      fullName: form.fullName,
      email: form.email,
      password: form.password,
      role: form.role as UserRole,
    })
    if (response) {
      router.push({ name: 'check-email', query: { email: response.email } })
    }
  } catch {
  }
}
</script>

<template>
  <div>
        <div class="mb-7">
      <h1 class="text-2xl font-bold text-gray-900">Create an Account</h1>
      <p class="text-sm text-gray-400 mt-1">Fill in your registration details</p>
    </div>

        <form class="space-y-4" @submit.prevent="handleSubmit">

      <AppInput
        v-model="form.fullName"
        label="Full Name"
        placeholder="John Doe"
        :error="fieldErrors.fullName"
      />

      <AppInput
        v-model="form.email"
        label="Email"
        type="email"
        placeholder="you@example.com"
        :error="fieldErrors.email"
      />

      <AppInput
        v-model="form.password"
        label="Password"
        type="password"
        placeholder="••••••••"
        helper="Minimum 6 characters"
        :error="fieldErrors.password"
      />

            <div class="flex flex-col gap-1">
        <span class="text-sm font-medium text-gray-700">Role</span>
        <div class="grid grid-cols-3 gap-2">
          <button
            v-for="option in roleOptions"
            :key="option.value"
            type="button"
            class="flex flex-col items-center gap-1.5 border rounded-xl p-3 text-center transition-all focus:outline-none"
            :class="
              form.role === option.value
                ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500'
                : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
            "
            @click="form.role = option.value; fieldErrors.role = ''"
          >
            <span class="text-xl">{{ option.icon }}</span>
            <span
              class="text-xs font-semibold"
              :class="form.role === option.value ? 'text-blue-700' : 'text-gray-700'"
            >
              {{ option.label }}
            </span>
            <span class="text-xs text-gray-400 leading-tight">{{ option.description }}</span>
          </button>
        </div>
        <p v-if="fieldErrors.role" class="text-xs text-red-500 mt-0.5">{{ fieldErrors.role }}</p>
      </div>

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
        Sign Up
      </AppButton>
    </form>

        <div class="flex items-center gap-3 my-6">
      <div class="flex-1 h-px bg-gray-100" />
      <span class="text-xs text-gray-400">or</span>
      <div class="flex-1 h-px bg-gray-100" />
    </div>

        <p class="text-center text-sm text-gray-500">
      Already have an account?
      <RouterLink to="/login" class="text-blue-600 font-medium hover:underline ml-1">
        Sign In
      </RouterLink>
    </p>
  </div>
</template>
