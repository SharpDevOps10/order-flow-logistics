import { ref } from 'vue'
import { defineStore } from 'pinia'
import { OrganizationsApi } from '@/api/organizations.api'
import type {
  Organization,
  CreateOrganizationDto,
  UpdateOrganizationDto,
} from '@/types/organization.types'

const extractErrorMessage = (error: unknown): string => {
  if (error && typeof error === 'object' && 'response' in error) {
    const axiosError = error as { response?: { data?: { message?: string } } }
    return axiosError.response?.data?.message ?? 'An error occurred'
  }
  return 'An error occurred'
}

export const useOrganizationsStore = defineStore('organizations', () => {
  const organizations = ref<Organization[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  const fetchAll = async () => {
    loading.value = true
    error.value = null
    try {
      organizations.value = await OrganizationsApi.getAll()
    } catch (e: unknown) {
      error.value = extractErrorMessage(e)
    } finally {
      loading.value = false
    }
  }

  const fetchMy = async () => {
    loading.value = true
    error.value = null
    try {
      organizations.value = await OrganizationsApi.getMy()
    } catch (e: unknown) {
      error.value = extractErrorMessage(e)
    } finally {
      loading.value = false
    }
  }

  const fetchPending = async () => {
    loading.value = true
    error.value = null
    try {
      organizations.value = await OrganizationsApi.getPending()
    } catch (e: unknown) {
      error.value = extractErrorMessage(e)
    } finally {
      loading.value = false
    }
  }

  const create = async (dto: CreateOrganizationDto) => {
    loading.value = true
    error.value = null
    try {
      const org = await OrganizationsApi.create(dto)
      organizations.value.push(org)
      return org
    } catch (e: unknown) {
      error.value = extractErrorMessage(e)
      throw e
    } finally {
      loading.value = false
    }
  }

  const update = async (id: string, dto: UpdateOrganizationDto) => {
    loading.value = true
    error.value = null
    try {
      const updated = await OrganizationsApi.update(id, dto)
      const idx = organizations.value.findIndex((o) => o.id === id)
      if (idx !== -1) organizations.value[idx] = updated
      return updated
    } catch (e: unknown) {
      error.value = extractErrorMessage(e)
      throw e
    } finally {
      loading.value = false
    }
  }

  const approve = async (id: string) => {
    loading.value = true
    error.value = null
    try {
      const updated = await OrganizationsApi.approve(id)
      organizations.value = organizations.value.filter((o) => o.id !== id)
      return updated
    } catch (e: unknown) {
      error.value = extractErrorMessage(e)
      throw e
    } finally {
      loading.value = false
    }
  }

  return {
    organizations,
    loading,
    error,
    fetchAll,
    fetchMy,
    fetchPending,
    create,
    update,
    approve,
  }
})
