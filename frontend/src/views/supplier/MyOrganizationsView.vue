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

const goToCreate = () => router.push({ name: 'organization-create' })
const goToEdit = (id: number) => router.push({ name: 'organization-edit', params: { id } })
const goToProducts = (id: number) => router.push({ name: 'products', params: { id } })

onMounted(async () => {
  await store.fetchMy()
  if (store.error) toast.error(store.error)
})
</script>

<template>
  <div>

    <!-- Header -->
    <div class="flex items-center justify-between mb-6">
      <div>
        <h1 class="text-3xl font-bold text-gray-900">My Organizations</h1>
        <p class="text-sm text-gray-400 mt-1">Manage your organizations</p>
      </div>
      <AppButton @click="goToCreate">+ New Organization</AppButton>
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
      <AppButton variant="ghost" size="sm" class="mt-3" @click="store.fetchMy()">
        Try again
      </AppButton>
    </div>

    <!-- Empty -->
    <div v-else-if="!store.organizations.length" class="text-center py-20">
      <p class="text-4xl mb-3">🏢</p>
      <p class="text-base font-semibold text-gray-900 mb-1">No organizations yet</p>
      <p class="text-sm text-gray-400 mb-6">Create your first organization to start selling</p>
      <AppButton @click="goToCreate">Create organization</AppButton>
    </div>

    <!-- Grid -->
    <div v-else class="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
      <OrganizationCard
        v-for="org in store.organizations"
        :key="org.id"
        :organization="org"
      >
        <AppButton variant="green" size="sm" @click="goToProducts(org.id)">
          Products
        </AppButton>
        <AppButton variant="secondary" size="sm" @click="goToEdit(org.id)">
          Edit
        </AppButton>
      </OrganizationCard>
    </div>

  </div>
</template>
