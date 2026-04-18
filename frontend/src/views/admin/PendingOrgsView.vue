<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useOrganizationsStore } from '@/stores/organizations.store'
import OrganizationCard from '@/components/organizations/OrganizationCard.vue'
import AppButton from '@/components/common/AppButton.vue'
import AppSpinner from '@/components/common/AppSpinner.vue'

const store = useOrganizationsStore()

const approvingIds = ref<Set<number>>(new Set())

const handleApprove = async (id: number) => {
  approvingIds.value = new Set(approvingIds.value).add(id)
  try {
    await store.approve(id)
  } finally {
    const next = new Set(approvingIds.value)
    next.delete(id)
    approvingIds.value = next
  }
}

onMounted(() => store.fetchPending())
</script>

<template>
  <div>

        <div class="flex items-center justify-between mb-6">
      <div>
        <h1 class="text-3xl font-bold text-gray-900">Pending Organizations</h1>
        <p class="text-sm text-gray-400 mt-1">Organizations awaiting approval</p>
      </div>
      <span
        v-if="!store.loading && store.organizations.length"
        class="text-sm bg-yellow-50 text-yellow-700 border border-yellow-100 px-3 py-1 rounded-full font-medium"
      >
        {{ store.organizations.length }} pending
      </span>
    </div>

        <div v-if="store.loading" class="flex items-center justify-center py-20">
      <AppSpinner size="lg" />
    </div>

        <div
      v-else-if="store.error"
      class="bg-red-50 border border-red-100 rounded-2xl p-6 text-center"
    >
      <p class="text-sm text-red-600">{{ store.error }}</p>
      <AppButton variant="ghost" size="sm" class="mt-3" @click="store.fetchPending()">
        Try again
      </AppButton>
    </div>

        <div v-else-if="!store.organizations.length" class="text-center py-20">
      <p class="text-4xl mb-3">✅</p>
      <p class="text-base font-semibold text-gray-900 mb-1">All organizations reviewed</p>
      <p class="text-sm text-gray-400">No pending applications</p>
    </div>

        <div v-else class="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
      <OrganizationCard
        v-for="org in store.organizations"
        :key="org.id"
        :organization="org"
      >
        <AppButton
          size="sm"
          :loading="approvingIds.has(org.id)"
          @click="handleApprove(org.id)"
        >
          Approve
        </AppButton>
      </OrganizationCard>
    </div>

  </div>
</template>
