<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useProductsStore } from '@/stores/products.store'
import { useToast } from '@/composables/useToast'
import AppButton from '@/components/common/AppButton.vue'
import type { Product } from '@/types/product.types'

type SortKey = 'name-asc' | 'name-desc' | 'price-asc' | 'price-desc' | 'newest'

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'newest', label: 'Newest first' },
  { value: 'name-asc', label: 'Name (A → Z)' },
  { value: 'name-desc', label: 'Name (Z → A)' },
  { value: 'price-asc', label: 'Price (low → high)' },
  { value: 'price-desc', label: 'Price (high → low)' },
]
const DEFAULT_SORT: SortKey = 'newest'
const UNDO_DURATION = 5000

const route = useRoute()
const router = useRouter()
const store = useProductsStore()
const toast = useToast()

const orgId = Number(route.params.id)

const initialQuery = typeof route.query.q === 'string' ? route.query.q : ''
const initialSort = SORT_OPTIONS.some((o) => o.value === route.query.sort)
  ? (route.query.sort as SortKey)
  : DEFAULT_SORT
const initialCategory = typeof route.query.category === 'string' ? route.query.category : ''

const searchInput = ref(initialQuery)
const debouncedSearch = ref(initialQuery)
const sortBy = ref<SortKey>(initialSort)
const categoryFilter = ref(initialCategory)

let searchDebounceId: ReturnType<typeof setTimeout> | null = null
watch(searchInput, (value) => {
  if (searchDebounceId) clearTimeout(searchDebounceId)
  searchDebounceId = setTimeout(() => {
    debouncedSearch.value = value
  }, 300)
})

watch([debouncedSearch, sortBy, categoryFilter], ([q, sort, category]) => {
  router.replace({
    query: {
      ...route.query,
      q: q || undefined,
      sort: sort === DEFAULT_SORT ? undefined : sort,
      category: category || undefined,
    },
  })
})

onBeforeUnmount(() => {
  if (searchDebounceId) clearTimeout(searchDebounceId)
  flushPendingDelete()
})

const currencyFormatter = new Intl.NumberFormat('uk-UA', {
  style: 'currency',
  currency: 'UAH',
  minimumFractionDigits: 2,
})
const formatPrice = (value: number) => currencyFormatter.format(value)

const availableCategories = computed(() => {
  const set = new Set<string>()
  for (const p of store.products) {
    if (p.category) set.add(p.category)
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b))
})

const visibleProducts = computed(() => {
  const q = debouncedSearch.value.trim().toLowerCase()
  let list = store.products
  if (q) {
    list = list.filter((p) =>
      p.name.toLowerCase().includes(q) ||
      (p.description?.toLowerCase().includes(q) ?? false) ||
      (p.sku?.toLowerCase().includes(q) ?? false),
    )
  }
  if (categoryFilter.value) {
    list = list.filter((p) => p.category === categoryFilter.value)
  }
  const sorted = [...list]
  switch (sortBy.value) {
    case 'name-asc':
      sorted.sort((a, b) => a.name.localeCompare(b.name))
      break
    case 'name-desc':
      sorted.sort((a, b) => b.name.localeCompare(a.name))
      break
    case 'price-asc':
      sorted.sort((a, b) => a.price - b.price)
      break
    case 'price-desc':
      sorted.sort((a, b) => b.price - a.price)
      break
    case 'newest':
      sorted.sort((a, b) => {
        const aT = a.createdAt ? new Date(a.createdAt).getTime() : 0
        const bT = b.createdAt ? new Date(b.createdAt).getTime() : 0
        return bT - aT || b.id - a.id
      })
      break
  }
  return sorted
})

const avatarPalette = [
  'from-blue-500 to-indigo-500',
  'from-emerald-500 to-teal-500',
  'from-amber-500 to-orange-500',
  'from-pink-500 to-rose-500',
  'from-purple-500 to-fuchsia-500',
  'from-sky-500 to-cyan-500',
]
const avatarGradient = (id: number) => avatarPalette[id % avatarPalette.length]
const initial = (name: string) => name.trim().charAt(0).toUpperCase() || '?'

const goBack = () => router.push({ name: 'my-organizations' })
const goToCreate = () => router.push({ name: 'product-create', params: { orgId } })
const goToEdit = (id: number) => router.push({ name: 'product-edit', params: { id } })

const clearSearch = () => {
  searchInput.value = ''
  debouncedSearch.value = ''
}

const clearFilters = () => {
  clearSearch()
  categoryFilter.value = ''
}

interface PendingDelete {
  product: Product
  index: number
  toastId: number
  timerId: ReturnType<typeof setTimeout>
}

let pendingDelete: PendingDelete | null = null

const flushPendingDelete = async () => {
  if (!pendingDelete) return
  const { product, timerId } = pendingDelete
  clearTimeout(timerId)
  pendingDelete = null
  try {
    await store.deleteOnServer(product.id)
  } catch {
    toast.error(store.error ?? 'Failed to delete product')
    await store.fetchByOrg(orgId)
  }
}

const handleDelete = (product: Product) => {
  if (pendingDelete) {
    void flushPendingDelete()
  }
  const removed = store.removeLocal(product.id)
  if (!removed) return

  const undo = () => {
    if (!pendingDelete || pendingDelete.product.id !== product.id) return
    clearTimeout(pendingDelete.timerId)
    store.restoreLocal(pendingDelete.product, pendingDelete.index)
    pendingDelete = null
  }

  const timerId = setTimeout(() => {
    if (!pendingDelete || pendingDelete.product.id !== product.id) return
    const target = pendingDelete
    pendingDelete = null
    store.deleteOnServer(target.product.id).catch(() => {
      toast.error(store.error ?? 'Failed to delete product')
      store.restoreLocal(target.product, target.index)
    })
  }, UNDO_DURATION)

  const toastId = toast.success(`Deleted "${product.name}"`, {
    duration: UNDO_DURATION,
    action: { label: 'Undo', onClick: undo },
  })

  pendingDelete = { product: removed.product, index: removed.index, toastId, timerId }
}

onMounted(async () => {
  await store.fetchByOrg(orgId)
  if (store.error) toast.error(store.error)
})
</script>

<template>
  <div>
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
        <div class="flex items-center gap-2">
          <h1 class="text-3xl font-bold text-gray-900">Products</h1>
          <span
            v-if="!store.loading && store.products.length"
            class="inline-flex items-center px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 text-xs font-medium"
          >
            {{ store.products.length }}
          </span>
        </div>
        <p class="text-sm text-gray-400 mt-1">Organization product catalog</p>
      </div>
      <AppButton @click="goToCreate">+ Add Product</AppButton>
    </div>

    <div v-if="!store.loading && store.products.length" class="flex flex-wrap items-center gap-3 mb-4">
      <div class="relative flex-1 min-w-[220px] max-w-sm">
        <svg
          class="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          stroke-width="2"
        >
          <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z" />
        </svg>
        <input
          v-model="searchInput"
          type="text"
          placeholder="Search products..."
          class="w-full pl-9 pr-9 py-2 text-sm bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <button
          v-if="searchInput"
          class="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 p-1 rounded-md hover:bg-gray-100"
          title="Clear search"
          @click="clearSearch"
        >
          <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <label v-if="availableCategories.length" class="flex items-center gap-2 text-sm text-gray-600">
        <span class="text-gray-500">Category:</span>
        <select
          v-model="categoryFilter"
          class="text-sm bg-white border border-gray-200 rounded-xl py-2 pl-3 pr-8 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="">All</option>
          <option v-for="c in availableCategories" :key="c" :value="c">{{ c }}</option>
        </select>
      </label>

      <label class="flex items-center gap-2 text-sm text-gray-600">
        <span class="text-gray-500">Sort:</span>
        <select
          v-model="sortBy"
          class="text-sm bg-white border border-gray-200 rounded-xl py-2 pl-3 pr-8 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option v-for="opt in SORT_OPTIONS" :key="opt.value" :value="opt.value">
            {{ opt.label }}
          </option>
        </select>
      </label>
    </div>

    <div
      v-if="store.loading"
      class="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
      aria-label="Loading products"
    >
      <div
        v-for="n in 8"
        :key="n"
        class="bg-white border border-gray-100 rounded-2xl overflow-hidden"
      >
        <div class="h-32 bg-gray-200 animate-pulse" />
        <div class="p-4 space-y-3">
          <div class="h-4 bg-gray-200 rounded animate-pulse w-3/4" />
          <div class="space-y-1.5">
            <div class="h-3 bg-gray-100 rounded animate-pulse" />
            <div class="h-3 bg-gray-100 rounded animate-pulse w-5/6" />
          </div>
          <div class="flex items-center justify-between pt-2 border-t border-gray-100">
            <div class="h-5 w-20 bg-gray-200 rounded animate-pulse" />
            <div class="flex gap-1">
              <div class="w-8 h-8 bg-gray-100 rounded-lg animate-pulse" />
              <div class="w-8 h-8 bg-gray-100 rounded-lg animate-pulse" />
            </div>
          </div>
        </div>
      </div>
    </div>

    <div
      v-else-if="store.error"
      class="bg-red-50 border border-red-100 rounded-2xl p-6 text-center"
    >
      <p class="text-sm text-red-600">{{ store.error }}</p>
      <AppButton variant="ghost" size="sm" class="mt-3" @click="store.fetchByOrg(orgId)">
        Try again
      </AppButton>
    </div>

    <div v-else-if="!store.products.length" class="text-center py-20">
      <p class="text-4xl mb-3">📦</p>
      <p class="text-base font-semibold text-gray-900 mb-1">No products yet</p>
      <p class="text-sm text-gray-400 mb-6">Add your first product to this organization</p>
      <AppButton @click="goToCreate">Add product</AppButton>
    </div>

    <div v-else-if="!visibleProducts.length" class="text-center py-16">
      <p class="text-sm text-gray-500 mb-3">No products match the current filters</p>
      <AppButton variant="secondary" size="sm" @click="clearFilters">Clear filters</AppButton>
    </div>

    <div v-else class="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      <article
        v-for="product in visibleProducts"
        :key="product.id"
        class="group relative bg-white border border-gray-100 rounded-2xl overflow-hidden flex flex-col hover:shadow-lg hover:border-gray-200 hover:-translate-y-0.5 transition-all duration-200 cursor-pointer focus-within:ring-2 focus-within:ring-blue-500"
        :class="{ 'opacity-75': !product.inStock }"
        tabindex="0"
        role="button"
        @click="goToEdit(product.id)"
        @keydown.enter.prevent="goToEdit(product.id)"
        @keydown.space.prevent="goToEdit(product.id)"
      >
        <div
          class="relative h-32 flex items-center justify-center overflow-hidden"
          :class="product.imageUrl ? 'bg-gray-100' : `bg-gradient-to-br ${avatarGradient(product.id)}`"
        >
          <img
            v-if="product.imageUrl"
            :src="product.imageUrl"
            :alt="product.name"
            class="w-full h-full object-cover"
            loading="lazy"
          />
          <template v-else>
            <span class="absolute -right-4 -bottom-6 text-[7rem] font-black text-white/15 leading-none select-none">
              {{ initial(product.name) }}
            </span>
            <span class="text-3xl font-bold text-white drop-shadow-sm select-none">
              {{ initial(product.name) }}
            </span>
          </template>
          <span
            v-if="!product.inStock"
            class="absolute top-2 left-2 inline-flex items-center px-2 py-0.5 rounded-full bg-white/95 text-red-600 text-[11px] font-semibold shadow-sm"
          >
            Out of stock
          </span>
          <span
            v-if="product.category"
            class="absolute top-2 right-2 inline-flex items-center px-2 py-0.5 rounded-full bg-white/90 backdrop-blur text-gray-700 text-[11px] font-medium shadow-sm max-w-[60%] truncate"
            :title="product.category"
          >
            {{ product.category }}
          </span>
        </div>

        <div class="p-4 flex flex-col flex-1">
          <h3 class="text-base font-semibold text-gray-900 line-clamp-2 leading-snug" :title="product.name">
            {{ product.name }}
          </h3>
          <p class="text-xs font-mono text-gray-400 mt-0.5 truncate" :title="product.sku ?? `P-${product.id}`">
            {{ product.sku ?? `P-${product.id}` }}
          </p>
          <p
            v-if="product.description"
            class="text-sm text-gray-500 mt-1.5 line-clamp-3 break-words flex-1"
            :title="product.description"
          >
            {{ product.description }}
          </p>
          <div v-else class="flex-1" />

          <div class="flex items-center justify-between mt-4 pt-3 border-t border-gray-100">
            <p class="text-lg font-bold text-blue-600 whitespace-nowrap">
              {{ formatPrice(product.price) }}
            </p>
            <div class="flex items-center gap-1 opacity-70 group-hover:opacity-100 transition-opacity">
              <button
                class="p-2 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                title="Edit product"
                @click.stop="goToEdit(product.id)"
              >
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </button>
              <button
                class="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                title="Delete product"
                @click.stop="handleDelete(product)"
              >
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </article>
    </div>
  </div>
</template>
