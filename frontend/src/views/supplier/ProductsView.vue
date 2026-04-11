<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useProductsStore } from '@/stores/products.store'
import { useToast } from '@/composables/useToast'
import AppButton from '@/components/common/AppButton.vue'
import AppSpinner from '@/components/common/AppSpinner.vue'

const route = useRoute()
const router = useRouter()
const store = useProductsStore()
const toast = useToast()

const orgId = Number(route.params.id)
const deletingIds = ref<Set<number>>(new Set())

const goBack = () => router.push({ name: 'my-organizations' })
const goToCreate = () => router.push({ name: 'product-create', params: { orgId } })
const goToEdit = (id: number) => router.push({ name: 'product-edit', params: { id } })

const handleDelete = async (id: number) => {
  deletingIds.value = new Set(deletingIds.value).add(id)
  try {
    await store.remove(id)
    toast.success('Product deleted')
  } catch {
    toast.error(store.error ?? 'Failed to delete product')
  } finally {
    const next = new Set(deletingIds.value)
    next.delete(id)
    deletingIds.value = next
  }
}

onMounted(async () => {
  await store.fetchByOrg(orgId)
  if (store.error) toast.error(store.error)
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
      <div class="flex-1">
        <h1 class="text-3xl font-bold text-gray-900">Products</h1>
        <p class="text-sm text-gray-400 mt-1">Organization product catalog</p>
      </div>
      <AppButton @click="goToCreate">+ Add Product</AppButton>
    </div>

    <!-- Loading -->
    <div v-if="store.loading" class="flex items-center justify-center py-20">
      <AppSpinner size="lg" />
    </div>

    <!-- Error -->
    <div
      v-else-if="store.error"
      class="bg-red-50 border border-red-100 rounded-2xl p-6 text-center"
    >
      <p class="text-sm text-red-600">{{ store.error }}</p>
      <AppButton variant="ghost" size="sm" class="mt-3" @click="store.fetchByOrg(orgId)">
        Try again
      </AppButton>
    </div>

    <!-- Empty -->
    <div v-else-if="!store.products.length" class="text-center py-20">
      <p class="text-4xl mb-3">📦</p>
      <p class="text-base font-semibold text-gray-900 mb-1">No products yet</p>
      <p class="text-sm text-gray-400 mb-6">Add your first product to this organization</p>
      <AppButton @click="goToCreate">Add product</AppButton>
    </div>

    <!-- List -->
    <div v-else class="flex flex-col gap-3">
      <div
        v-for="product in store.products"
        :key="product.id"
        class="bg-white border border-gray-100 rounded-2xl p-5 flex items-center gap-4 hover:shadow-sm transition-shadow"
      >
        <!-- Info -->
        <div class="flex-1 min-w-0">
          <p class="text-base font-semibold text-gray-900 truncate">{{ product.name }}</p>
          <p v-if="product.description" class="text-sm text-gray-500 truncate mt-0.5">
            {{ product.description }}
          </p>
        </div>

        <!-- Price -->
        <div class="text-right flex-shrink-0">
          <p class="text-base font-bold text-gray-900">₴{{ product.price.toFixed(2) }}</p>
          <p class="text-xs text-gray-400">ID: {{ product.id }}</p>
        </div>

        <!-- Actions -->
        <div class="flex items-center gap-2 flex-shrink-0">
          <AppButton variant="secondary" size="sm" @click="goToEdit(product.id)">
            Edit
          </AppButton>
          <AppButton
            variant="danger"
            size="sm"
            :loading="deletingIds.has(product.id)"
            @click="handleDelete(product.id)"
          >
            Delete
          </AppButton>
        </div>
      </div>
    </div>

  </div>
</template>
