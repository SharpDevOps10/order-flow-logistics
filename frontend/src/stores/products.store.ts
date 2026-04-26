import { ref } from 'vue'
import { defineStore } from 'pinia'
import { ProductsApi } from '@/api/products.api'
import type { Product, CreateProductDto, UpdateProductDto } from '@/types/product.types'

const extractErrorMessage = (error: unknown): string => {
  if (error && typeof error === 'object' && 'response' in error) {
    const axiosError = error as { response?: { data?: { message?: string } } }
    return axiosError.response?.data?.message ?? 'An error occurred'
  }
  return 'An error occurred'
}

export const useProductsStore = defineStore('products', () => {
  const products = ref<Product[]>([])
  const categories = ref<string[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  const fetchByOrg = async (orgId: number) => {
    loading.value = true
    error.value = null
    try {
      products.value = await ProductsApi.getByOrg(orgId)
    } catch (e: unknown) {
      error.value = extractErrorMessage(e)
    } finally {
      loading.value = false
    }
  }

  const fetchCategories = async (orgId: number) => {
    try {
      categories.value = await ProductsApi.getCategories(orgId)
    } catch {
      categories.value = []
    }
  }

  const create = async (orgId: number, dto: CreateProductDto) => {
    loading.value = true
    error.value = null
    try {
      const product = await ProductsApi.create(orgId, dto)
      products.value.push(product)
      return product
    } catch (e: unknown) {
      error.value = extractErrorMessage(e)
      throw e
    } finally {
      loading.value = false
    }
  }

  const update = async (id: number, dto: UpdateProductDto) => {
    loading.value = true
    error.value = null
    try {
      const updated = await ProductsApi.update(id, dto)
      const idx = products.value.findIndex((p) => p.id === id)
      if (idx !== -1) products.value[idx] = updated
      return updated
    } catch (e: unknown) {
      error.value = extractErrorMessage(e)
      throw e
    } finally {
      loading.value = false
    }
  }

  const remove = async (id: number) => {
    loading.value = true
    error.value = null
    try {
      await ProductsApi.delete(id)
      products.value = products.value.filter((p) => p.id !== id)
    } catch (e: unknown) {
      error.value = extractErrorMessage(e)
      throw e
    } finally {
      loading.value = false
    }
  }

  const removeLocal = (id: number): { product: Product; index: number } | null => {
    const index = products.value.findIndex((p) => p.id === id)
    if (index === -1) return null
    const [product] = products.value.splice(index, 1)
    return { product, index }
  }

  const restoreLocal = (product: Product, index: number) => {
    products.value.splice(index, 0, product)
  }

  const deleteOnServer = async (id: number) => {
    error.value = null
    try {
      await ProductsApi.delete(id)
    } catch (e: unknown) {
      error.value = extractErrorMessage(e)
      throw e
    }
  }

  const uploadImage = async (id: number, file: File) => {
    error.value = null
    try {
      const updated = await ProductsApi.uploadImage(id, file)
      const idx = products.value.findIndex((p) => p.id === id)
      if (idx !== -1) products.value[idx] = updated
      return updated
    } catch (e: unknown) {
      error.value = extractErrorMessage(e)
      throw e
    }
  }

  const deleteImage = async (id: number) => {
    error.value = null
    try {
      const updated = await ProductsApi.deleteImage(id)
      const idx = products.value.findIndex((p) => p.id === id)
      if (idx !== -1) products.value[idx] = updated
      return updated
    } catch (e: unknown) {
      error.value = extractErrorMessage(e)
      throw e
    }
  }

  return {
    products,
    categories,
    loading,
    error,
    fetchByOrg,
    fetchCategories,
    create,
    update,
    remove,
    removeLocal,
    restoreLocal,
    deleteOnServer,
    uploadImage,
    deleteImage,
  }
})
