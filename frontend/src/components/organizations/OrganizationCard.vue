<script setup lang="ts">
import type { Organization } from '@/types/organization.types'
import AppBadge from '@/components/common/AppBadge.vue'

interface Props {
  organization: Organization
}

const props = defineProps<Props>()
</script>

<template>
  <div class="bg-white border border-gray-100 rounded-2xl p-6 hover:shadow-md transition-shadow flex flex-col gap-5">

    <!-- Header -->
    <div class="flex items-start justify-between gap-3">
      <div class="flex-1 min-w-0">
        <h3 class="text-lg font-semibold text-gray-900 truncate">{{ props.organization.name }}</h3>
        <p v-if="props.organization.region" class="text-sm text-gray-500 mt-1 flex items-center gap-1.5">
          <svg class="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path stroke-linecap="round" stroke-linejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          {{ props.organization.region }}
        </p>
      </div>
      <AppBadge :variant="props.organization.isApproved ? 'green' : 'yellow'">
        {{ props.organization.isApproved ? 'Approved' : 'Pending' }}
      </AppBadge>
    </div>

    <!-- Coordinates -->
    <div
      v-if="props.organization.lat && props.organization.lng"
      class="flex items-center gap-2 text-sm text-gray-500 bg-gray-50 rounded-xl px-4 py-3"
    >
      <svg class="w-4 h-4 flex-shrink-0 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="3" />
        <path stroke-linecap="round" d="M12 2v3M12 19v3M2 12h3M19 12h3" />
      </svg>
      <span class="font-mono">{{ Number(props.organization.lat).toFixed(4) }}, {{ Number(props.organization.lng).toFixed(4) }}</span>
    </div>

    <!-- Footer: meta + actions -->
    <div class="flex items-center justify-between gap-3 pt-1 border-t border-gray-50">
      <span class="text-sm text-gray-400">ID: {{ props.organization.id }}</span>
      <div class="flex items-center gap-2">
        <slot />
      </div>
    </div>

  </div>
</template>
