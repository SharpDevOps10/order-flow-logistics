export interface Product {
  id: number
  name: string
  description: string | null
  price: number
  organizationId: number
  createdAt: string | null
}

export interface CreateProductDto {
  name: string
  description?: string
  price: number
}

export interface UpdateProductDto {
  name?: string
  description?: string
  price?: number
}
