<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useOrganizationsStore } from '@/stores/organizations.store'
import { useToast } from '@/composables/useToast'
import OrganizationCard from '@/components/organizations/OrganizationCard.vue'
import AppButton from '@/components/common/AppButton.vue'

const store = useOrganizationsStore()
const route = useRoute()
const router = useRouter()
const toast = useToast()

const initialQuery = typeof route.query.q === 'string' ? route.query.q : ''
const initialRegion = typeof route.query.region === 'string' ? route.query.region : ''

const searchInput = ref(initialQuery)
const debouncedSearch = ref(initialQuery)
const regionFilter = ref(initialRegion)

let searchDebounceId: ReturnType<typeof setTimeout> | null = null
watch(searchInput, (value) => {
  if (searchDebounceId) clearTimeout(searchDebounceId)
  searchDebounceId = setTimeout(() => {
    debouncedSearch.value = value
  }, 300)
})

watch([debouncedSearch, regionFilter], ([q, region]) => {
  router.replace({
    query: {
      ...route.query,
      q: q || undefined,
      region: region || undefined,
    },
  })
})

onBeforeUnmount(() => {
  if (searchDebounceId) clearTimeout(searchDebounceId)
})

const availableRegions = computed(() => {
  const set = new Set<string>()
  for (const o of store.organizations) {
    if (o.region) set.add(o.region)
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b))
})

const visibleOrganizations = computed(() => {
  const q = debouncedSearch.value.trim().toLowerCase()
  let list = store.organizations
  if (q) {
    list = list.filter((o) =>
      o.name.toLowerCase().includes(q) ||
      (o.address?.toLowerCase().includes(q) ?? false) ||
      (o.region?.toLowerCase().includes(q) ?? false) ||
      (o.categories?.some((c) => c.toLowerCase().includes(q)) ?? false),
    )
  }
  if (regionFilter.value) {
    list = list.filter((o) => o.region === regionFilter.value)
  }
  return list
})

const goToOrg = (id: number) => router.push({ name: 'organization', params: { id } })

const clearSearch = () => {
  searchInput.value = ''
  debouncedSearch.value = ''
}

const clearFilters = () => {
  clearSearch()
  regionFilter.value = ''
}

onMounted(async () => {
  await store.fetchAll()
  if (store.error) toast.error(store.error)
})
</script>

<template>
  <div>
    <div class="mb-6">
      <h1 class="text-3xl font-bold text-gray-900">Marketplace</h1>
      <p class="text-sm text-gray-400 mt-1">Browse organizations and order products</p>
    </div>

    <div v-if="!store.loading && store.organizations.length" class="flex flex-wrap items-center gap-3 mb-5">
      <div class="relative flex-1 min-w-[220px] max-w-md">
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
          placeholder="Search by name, address or category..."
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

      <label v-if="availableRegions.length" class="flex items-center gap-2 text-sm text-gray-600">
        <span class="text-gray-500">Region:</span>
        <select
          v-model="regionFilter"
          class="text-sm bg-white border border-gray-200 rounded-xl py-2 pl-3 pr-8 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="">All</option>
          <option v-for="r in availableRegions" :key="r" :value="r">{{ r }}</option>
        </select>
      </label>
    </div>

    <div v-if="store.loading" class="flex items-center justify-center py-20">
      <div class="text-sm text-gray-400">Loading organizations...</div>
    </div>

    <div
      v-else-if="store.error"
      class="bg-red-50 border border-red-100 rounded-2xl p-6 text-center"
    >
      <p class="text-sm text-red-600">{{ store.error }}</p>
      <AppButton variant="ghost" size="sm" class="mt-3" @click="store.fetchAll()">
        Try again
      </AppButton>
    </div>

    <div v-else-if="!store.organizations.length" class="text-center py-20">
      <p class="text-4xl mb-3">🏪</p>
      <p class="text-base font-semibold text-gray-900 mb-1">No organizations available</p>
      <p class="text-sm text-gray-400">Check back later</p>
    </div>

    <div v-else-if="!visibleOrganizations.length" class="text-center py-16">
      <p class="text-sm text-gray-500 mb-3">No organizations match the current filters</p>
      <AppButton variant="secondary" size="sm" @click="clearFilters">Clear filters</AppButton>
    </div>

    <div v-else class="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
      <OrganizationCard
        v-for="org in visibleOrganizations"
        :key="org.id"
        :organization="org"
        clickable
        @click="goToOrg(org.id)"
      >
        <AppButton size="sm" @click.stop="goToOrg(org.id)">
          View products
        </AppButton>
      </OrganizationCard>
    </div>
  </div>
</template>
