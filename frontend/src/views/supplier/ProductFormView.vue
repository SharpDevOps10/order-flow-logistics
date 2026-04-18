<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useProductsStore } from '@/stores/products.store'
import { useToast } from '@/composables/useToast'
import AppButton from '@/components/common/AppButton.vue'
import AppInput from '@/components/common/AppInput.vue'

const route = useRoute()
const router = useRouter()
const store = useProductsStore()
const toast = useToast()

const isEditMode = computed(() => !!route.params.id)
const productId = computed(() => Number(route.params.id))
const orgId = computed(() => Number(route.params.orgId))

const name = ref('')
const description = ref('')
const price = ref('')

const errors = ref({ name: '', price: '' })

const validate = (): boolean => {
  errors.value = { name: '', price: '' }
  if (!name.value.trim()) {
    errors.value.name = 'Name is required'
    return false
  }
  if (!price.value || isNaN(Number(price.value)) || Number(price.value) <= 0) {
    errors.value.price = 'Enter a valid price'
    return false
  }
  return true
}

const handleSubmit = async () => {
  if (!validate()) return

  const dto = {
    name: name.value.trim(),
    ...(description.value.trim() && { description: description.value.trim() }),
    price: Number(price.value),
  }

  try {
    if (isEditMode.value) {
      await store.update(productId.value, dto)
      toast.success('Product updated')
      router.back()
    } else {
      await store.create(orgId.value, dto)
      toast.success('Product created')
      router.push({ name: 'products', params: { id: orgId.value } })
    }
  } catch {
    toast.error(store.error ?? 'Failed to save')
  }
}

const goBack = () => router.back()

onMounted(() => {
  if (!isEditMode.value) return

  const existing = store.products.find((p) => p.id === productId.value)
  if (!existing) return

  name.value = existing.name
  description.value = existing.description ?? ''
  price.value = String(existing.price)
})
</script>

<template>
  <div class="max-w-lg">

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
        <h1 class="text-3xl font-bold text-gray-900">
          {{ isEditMode ? 'Edit Product' : 'New Product' }}
        </h1>
        <p class="text-sm text-gray-400 mt-1">
          {{ isEditMode ? 'Update product details' : 'Fill in your new product details' }}
        </p>
      </div>
    </div>

        <form
      class="bg-white border border-gray-100 rounded-2xl p-6 flex flex-col gap-5"
      @submit.prevent="handleSubmit"
    >
      <AppInput
        v-model="name"
        label="Product name"
        placeholder="e.g. Golden Apples"
        :error="errors.name"
      />

      <div class="flex flex-col gap-1">
        <label class="text-sm font-medium text-gray-700">Description</label>
        <textarea
          v-model="description"
          placeholder="Short product description (optional)"
          rows="3"
          class="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 placeholder-gray-400 bg-white transition focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
        />
      </div>

      <AppInput
        v-model="price"
        label="Price (₴)"
        placeholder="0.00"
        type="number"
        :error="errors.price"
      />

      <div class="flex items-center justify-end gap-3 pt-2">
        <AppButton variant="secondary" type="button" @click="goBack">
          Cancel
        </AppButton>
        <AppButton type="submit" :loading="store.loading">
          {{ isEditMode ? 'Save changes' : 'Create' }}
        </AppButton>
      </div>
    </form>

  </div>
</template>
