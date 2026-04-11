import type { Product, CreateProductDto, UpdateProductDto } from '@/types/product.types'
import { axiosInstance } from './axios.instance'

export const ProductsApi = {
  getByOrg: async (orgId: string): Promise<Product[]> => {
    const { data } = await axiosInstance.get<Product[]>(`/organizations/${orgId}/products`)
    return data
  },

  create: async (orgId: string, dto: CreateProductDto): Promise<Product> => {
    const { data } = await axiosInstance.post<Product>(`/organizations/${orgId}/products`, dto)
    return data
  },

  update: async (id: string, dto: UpdateProductDto): Promise<Product> => {
    const { data } = await axiosInstance.patch<Product>(`/products/${id}`, dto)
    return data
  },

  delete: async (id: string): Promise<void> => {
    await axiosInstance.delete(`/products/${id}`)
  },
}
