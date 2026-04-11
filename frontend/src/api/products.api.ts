import type { Product, CreateProductDto, UpdateProductDto } from '@/types/product.types'
import { axiosInstance } from './axios.instance'

export const ProductsApi = {
  getByOrg: async (orgId: number): Promise<Product[]> => {
    const { data } = await axiosInstance.get<Product[]>(`/organizations/${orgId}/products`)
    return data
  },

  create: async (orgId: number, dto: CreateProductDto): Promise<Product> => {
    const { data } = await axiosInstance.post<Product>(`/organizations/${orgId}/products`, dto)
    return data
  },

  update: async (id: number, dto: UpdateProductDto): Promise<Product> => {
    const { data } = await axiosInstance.patch<Product>(`/products/${id}`, dto)
    return data
  },

  delete: async (id: number): Promise<Product> => {
    const { data } = await axiosInstance.delete<Product>(`/products/${id}`)
    return data
  },
}
