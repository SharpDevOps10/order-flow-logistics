<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useOrganizationsStore } from '@/stores/organizations.store'
import { useToast } from '@/composables/useToast'
import AppButton from '@/components/common/AppButton.vue'
import AppInput from '@/components/common/AppInput.vue'

const route = useRoute()
const router = useRouter()
const store = useOrganizationsStore()
const toast = useToast()

const isEditMode = computed(() => !!route.params.id)
const orgId = computed(() => Number(route.params.id))

const name = ref('')
const region = ref('')
const lat = ref('')
const lng = ref('')

const errors = ref({ name: '', lat: '', lng: '' })

const validate = (): boolean => {
  errors.value = { name: '', lat: '', lng: '' }
  if (!name.value.trim()) {
    errors.value.name = 'Name is required'
    return false
  }
  if (lat.value && isNaN(Number(lat.value))) {
    errors.value.lat = 'Latitude must be a number'
    return false
  }
  if (lng.value && isNaN(Number(lng.value))) {
    errors.value.lng = 'Longitude must be a number'
    return false
  }
  return true
}

const handleSubmit = async () => {
  if (!validate()) return

  const dto = {
    name: name.value.trim(),
    ...(region.value && { region: region.value.trim() }),
    ...(lat.value && { lat: Number(lat.value) }),
    ...(lng.value && { lng: Number(lng.value) }),
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

onMounted(() => {
  if (!isEditMode.value) return

  const existing = store.organizations.find((o) => o.id === orgId.value)
  if (!existing) return

  name.value = existing.name
  region.value = existing.region ?? ''
  lat.value = existing.lat ?? ''
  lng.value = existing.lng ?? ''
})
</script>

<template>
  <div class="max-w-lg">

    <!-- Header -->
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

    <!-- Form -->
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

      <div class="grid grid-cols-2 gap-4">
        <AppInput
          v-model="lat"
          label="Latitude"
          placeholder="50.4501"
          :error="errors.lat"
        />
        <AppInput
          v-model="lng"
          label="Longitude"
          placeholder="30.5234"
          :error="errors.lng"
        />
      </div>

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
