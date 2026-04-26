export interface Product {
  id: number
  name: string
  description: string | null
  price: number
  organizationId: number
  sku: string | null
  category: string | null
  inStock: boolean
  imageUrl: string | null
  createdAt: string | null
}

export interface CreateProductDto {
  name: string
  description?: string
  price: number
  sku?: string
  category?: string
  inStock?: boolean
}

export interface UpdateProductDto {
  name?: string
  description?: string
  price?: number
  sku?: string
  category?: string
  inStock?: boolean
}
