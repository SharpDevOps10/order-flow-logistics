<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useOrganizationsStore } from '@/stores/organizations.store'
import { useToast } from '@/composables/useToast'
import { useGeocoding } from '@/composables/useGeocoding'
import AppButton from '@/components/common/AppButton.vue'
import AppInput from '@/components/common/AppInput.vue'

const route = useRoute()
const router = useRouter()
const store = useOrganizationsStore()
const toast = useToast()
const { isLocating, isGeocoding, locationError, detectLocation, geocodeAddress } = useGeocoding()

const isEditMode = computed(() => !!route.params.id)
const orgId = computed(() => Number(route.params.id))

const name = ref('')
const region = ref('')
const address = ref('')
const addressError = ref('')
const coords = ref<{ lat: string; lng: string } | null>(null)

const errors = ref({ name: '' })

const validate = (): boolean => {
  errors.value = { name: '' }
  if (!name.value.trim()) {
    errors.value.name = 'Name is required'
    return false
  }
  return true
}

const handleSubmit = async () => {
  if (!validate()) return

  const dto = {
    name: name.value.trim(),
    ...(region.value && { region: region.value.trim() }),
    ...(address.value && { address: address.value.trim() }),
    ...(coords.value && { lat: Number(coords.value.lat), lng: Number(coords.value.lng) }),
  }

  try {
    if (isEditMode.value) {
      await store.update(orgId.value, dto)
      toast.success('Organization updated')
    } else {
      await store.create(dto)
      toast.success('Organization created')
    }
    router.push({ name: 'my-organizations' })
  } catch {
    toast.error(store.error ?? 'Failed to save')
  }
}

const goBack = () => router.push({ name: 'my-organizations' })

const handleDetectLocation = async () => {
  const result = await detectLocation()
  if (result) {
    address.value = result.address
    coords.value = result.coords
    toast.success('Location detected')
  }
}

const handleFindCoords = async () => {
  const result = await geocodeAddress(address.value)
  if (result) {
    coords.value = result
    toast.success('Coordinates found')
  }
}

onMounted(() => {
  if (!isEditMode.value) return

  const existing = store.organizations.find((o) => o.id === orgId.value)
  if (!existing) return

  name.value = existing.name
  region.value = existing.region ?? ''
  address.value = existing.address ?? ''
  if (existing.lat && existing.lng) {
    coords.value = { lat: existing.lat, lng: existing.lng }
  }
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
          {{ isEditMode ? 'Edit Organization' : 'New Organization' }}
        </h1>
        <p class="text-sm text-gray-400 mt-1">
          {{ isEditMode ? 'Update organization details' : 'Fill in your new organization details' }}
        </p>
      </div>
    </div>

        <form
      class="bg-white border border-gray-100 rounded-2xl p-6 flex flex-col gap-5"
      @submit.prevent="handleSubmit"
    >
      <AppInput
        v-model="name"
        label="Organization name"
        placeholder="e.g. FreshFarm Ltd"
        :error="errors.name"
      />

      <AppInput
        v-model="region"
        label="Region"
        placeholder="e.g. Kyiv region"
      />

            <div class="flex flex-col gap-1">
        <label class="text-sm font-medium text-gray-700">Organization Address</label>
        <div class="flex gap-2">
          <input
            v-model="address"
            type="text"
            placeholder="Street, building, apartment"
            class="flex-1 border rounded-xl px-3 py-2 text-sm text-gray-900 placeholder-gray-400 bg-white transition focus:outline-none focus:ring-2 focus:border-transparent"
            :class="addressError ? 'border-red-400 focus:ring-red-400' : 'border-gray-200 focus:ring-blue-500'"
            @input="coords = null"
          />
                    <button
            v-if="address && !coords"
            class="flex-shrink-0 flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 border border-blue-200 hover:border-blue-300 hover:bg-blue-50 px-3 py-2 rounded-xl transition-colors disabled:opacity-50"
            :disabled="isGeocoding"
            type="button"
            @click="handleFindCoords"
          >
            <svg v-if="!isGeocoding" class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <circle cx="11" cy="11" r="8" /><path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-4.35-4.35" />
            </svg>
            <svg v-else class="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M4 12a8 8 0 018-8v0m0 0a8 8 0 110 16v0m0-16v8m0-8a8 8 0 110 16v0" />
            </svg>
            Find
          </button>
        </div>
        <p v-if="addressError" class="text-xs text-red-500">{{ addressError }}</p>
      </div>

            <button
        class="self-start flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 border border-gray-200 hover:border-gray-300 hover:bg-gray-50 px-3 py-2 rounded-xl transition-colors disabled:opacity-50"
        :disabled="isLocating"
        type="button"
        @click="handleDetectLocation"
      >
        <svg v-if="!isLocating" class="w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 110-5 2.5 2.5 0 010 5z" />
        </svg>
        <svg v-else class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M4 12a8 8 0 018-8v0m0 0a8 8 0 110 16v0m0-16v8m0-8a8 8 0 110 16v0" />
        </svg>
        Use my current location
      </button>

            <div
        v-if="coords"
        class="flex items-center gap-2 text-xs text-green-700 bg-green-50 border border-green-100 rounded-xl px-3 py-2"
      >
        <svg class="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
        </svg>
        Coordinates detected: {{ Number(coords.lat).toFixed(5) }}, {{ Number(coords.lng).toFixed(5) }}
      </div>

            <p v-if="locationError" class="text-xs text-red-500">{{ locationError }}</p>

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
