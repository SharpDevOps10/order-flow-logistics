<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useOrganizationsStore } from '@/stores/organizations.store'
import { useToast } from '@/composables/useToast'
import OrganizationCard from '@/components/organizations/OrganizationCard.vue'
import AppButton from '@/components/common/AppButton.vue'
import AppSpinner from '@/components/common/AppSpinner.vue'

const store = useOrganizationsStore()
const router = useRouter()
const toast = useToast()

const goToOrg = (id: number) => router.push({ name: 'organization', params: { id } })

onMounted(async () => {
  await store.fetchAll()
  if (store.error) toast.error(store.error)
})
</script>

<template>
  <div>

    <!-- Header -->
    <div class="mb-6">
      <h1 class="text-3xl font-bold text-gray-900">Marketplace</h1>
      <p class="text-sm text-gray-400 mt-1">Browse organizations and order products</p>
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
      <AppButton variant="ghost" size="sm" class="mt-3" @click="store.fetchAll()">
        Try again
      </AppButton>
    </div>

    <!-- Empty -->
    <div v-else-if="!store.organizations.length" class="text-center py-20">
      <p class="text-4xl mb-3">🏪</p>
      <p class="text-base font-semibold text-gray-900 mb-1">No organizations available</p>
      <p class="text-sm text-gray-400">Check back later</p>
    </div>

    <!-- Grid -->
    <div v-else class="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
      <OrganizationCard
        v-for="org in store.organizations"
        :key="org.id"
        :organization="org"
      >
        <AppButton size="sm" @click="goToOrg(org.id)">
          View products
        </AppButton>
      </OrganizationCard>
    </div>

  </div>
</template>
