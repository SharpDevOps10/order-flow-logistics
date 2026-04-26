<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useProductsStore } from '@/stores/products.store'
import { useToast } from '@/composables/useToast'
import AppButton from '@/components/common/AppButton.vue'
import AppInput from '@/components/common/AppInput.vue'

const SKU_PATTERN = /^[A-Za-z0-9._-]+$/
const ALLOWED_IMAGE_MIMES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_IMAGE_BYTES = 5 * 1024 * 1024

const route = useRoute()
const router = useRouter()
const store = useProductsStore()
const toast = useToast()

const isEditMode = computed(() => !!route.params.id)
const productId = computed(() => Number(route.params.id))
const orgIdParam = computed(() => Number(route.params.orgId))

const name = ref('')
const description = ref('')
const price = ref('')
const sku = ref('')
const category = ref('')
const inStock = ref(true)
const formOrgId = ref<number | null>(null)

const existingImageUrl = ref<string | null>(null)
const pendingImageFile = ref<File | null>(null)
const pendingImagePreview = ref<string | null>(null)
const imageBusy = ref(false)
const fileInputEl = ref<HTMLInputElement | null>(null)

const errors = ref({ name: '', price: '', sku: '', image: '' })

const resolvedOrgId = computed(() => formOrgId.value ?? orgIdParam.value)

const validate = (): boolean => {
  errors.value = { name: '', price: '', sku: '', image: '' }
  if (!name.value.trim()) {
    errors.value.name = 'Name is required'
    return false
  }
  if (!price.value || isNaN(Number(price.value)) || Number(price.value) <= 0) {
    errors.value.price = 'Enter a valid price'
    return false
  }
  if (sku.value.trim() && !SKU_PATTERN.test(sku.value.trim())) {
    errors.value.sku = 'Letters, digits, dot, underscore and dash only'
    return false
  }
  return true
}

const validateImage = (file: File): string | null => {
  if (!ALLOWED_IMAGE_MIMES.includes(file.type)) {
    return 'Only JPEG, PNG or WebP images are allowed'
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return 'Image must be smaller than 5 MB'
  }
  return null
}

const releasePreview = () => {
  if (pendingImagePreview.value) {
    URL.revokeObjectURL(pendingImagePreview.value)
    pendingImagePreview.value = null
  }
}

const onFileChange = async (event: Event) => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  target.value = ''
  if (!file) return

  const validationError = validateImage(file)
  if (validationError) {
    errors.value.image = validationError
    return
  }
  errors.value.image = ''

  if (isEditMode.value) {
    imageBusy.value = true
    try {
      const updated = await store.uploadImage(productId.value, file)
      existingImageUrl.value = updated.imageUrl
      toast.success('Image uploaded')
    } catch {
      toast.error(store.error ?? 'Failed to upload image')
    } finally {
      imageBusy.value = false
    }
    return
  }

  releasePreview()
  pendingImageFile.value = file
  pendingImagePreview.value = URL.createObjectURL(file)
}

const removeImage = async () => {
  errors.value.image = ''

  if (isEditMode.value && existingImageUrl.value) {
    imageBusy.value = true
    try {
      await store.deleteImage(productId.value)
      existingImageUrl.value = null
      toast.success('Image removed')
    } catch {
      toast.error(store.error ?? 'Failed to remove image')
    } finally {
      imageBusy.value = false
    }
    return
  }

  releasePreview()
  pendingImageFile.value = null
}

const handleSubmit = async () => {
  if (!validate()) return

  const trimmedSku = sku.value.trim()
  const trimmedCategory = category.value.trim()

  const dto = {
    name: name.value.trim(),
    ...(description.value.trim() && { description: description.value.trim() }),
    price: Number(price.value),
    ...(trimmedSku && { sku: trimmedSku }),
    ...(trimmedCategory && { category: trimmedCategory }),
    inStock: inStock.value,
  }

  try {
    if (isEditMode.value) {
      await store.update(productId.value, dto)
      toast.success('Product updated')
      router.back()
    } else {
      const created = await store.create(orgIdParam.value, dto)
      if (pendingImageFile.value && created) {
        try {
          await store.uploadImage(created.id, pendingImageFile.value)
        } catch {
          toast.error('Product created, but image upload failed')
        }
      }
      releasePreview()
      pendingImageFile.value = null
      toast.success('Product created')
      router.push({ name: 'products', params: { id: orgIdParam.value } })
    }
  } catch {
    toast.error(store.error ?? 'Failed to save')
  }
}

const goBack = () => router.back()

onMounted(async () => {
  if (isEditMode.value) {
    const existing = store.products.find((p) => p.id === productId.value)
    if (existing) {
      name.value = existing.name
      description.value = existing.description ?? ''
      price.value = String(existing.price)
      sku.value = existing.sku ?? ''
      category.value = existing.category ?? ''
      inStock.value = existing.inStock
      existingImageUrl.value = existing.imageUrl
      formOrgId.value = existing.organizationId
    }
  }

  if (resolvedOrgId.value) {
    void store.fetchCategories(resolvedOrgId.value)
  }
})

onBeforeUnmount(() => {
  releasePreview()
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

      <div class="flex flex-col gap-2">
        <label class="text-sm font-medium text-gray-700">Image</label>
        <div class="flex items-center gap-4">
          <div
            class="w-24 h-24 rounded-xl border border-gray-200 bg-gray-50 flex-shrink-0 overflow-hidden flex items-center justify-center"
          >
            <img
              v-if="pendingImagePreview || existingImageUrl"
              :src="pendingImagePreview ?? existingImageUrl ?? ''"
              alt="Product preview"
              class="w-full h-full object-cover"
            />
            <svg
              v-else
              class="w-8 h-8 text-gray-300"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              stroke-width="1.5"
            >
              <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
            </svg>
          </div>
          <div class="flex flex-col gap-1.5">
            <input
              ref="fileInputEl"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              class="hidden"
              @change="onFileChange"
            />
            <div class="flex items-center gap-2">
              <AppButton
                variant="secondary"
                size="sm"
                type="button"
                :loading="imageBusy"
                @click="fileInputEl?.click()"
              >
                {{ pendingImagePreview || existingImageUrl ? 'Replace' : 'Upload image' }}
              </AppButton>
              <AppButton
                v-if="pendingImagePreview || existingImageUrl"
                variant="ghost"
                size="sm"
                type="button"
                :disabled="imageBusy"
                @click="removeImage"
              >
                Remove
              </AppButton>
            </div>
            <p class="text-xs text-gray-400">JPEG, PNG or WebP, up to 5 MB</p>
            <p v-if="errors.image" class="text-xs text-red-600">{{ errors.image }}</p>
          </div>
        </div>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <AppInput
          v-model="price"
          label="Price (₴)"
          placeholder="0.00"
          type="number"
          :error="errors.price"
        />
        <AppInput
          v-model="sku"
          label="SKU"
          placeholder="Optional, e.g. CRX-1560"
          :error="errors.sku"
        />
      </div>

      <div class="flex flex-col gap-1">
        <label class="text-sm font-medium text-gray-700">Category</label>
        <input
          v-model="category"
          list="product-categories"
          placeholder="Optional, e.g. Toothpaste"
          class="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 placeholder-gray-400 bg-white transition focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <datalist id="product-categories">
          <option v-for="c in store.categories" :key="c" :value="c" />
        </datalist>
      </div>

      <label class="flex items-center gap-3 px-3 py-2 bg-gray-50 rounded-xl cursor-pointer select-none">
        <input
          v-model="inStock"
          type="checkbox"
          class="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
        />
        <span class="text-sm text-gray-700">In stock — available to order</span>
      </label>

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
