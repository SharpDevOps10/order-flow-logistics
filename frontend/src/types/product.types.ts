export interface Product {
  id: string
  name: string
  description: string
  price: number
  organizationId: string
  createdAt: string
}

export interface CreateProductDto {
  name: string
  description: string
  price: number
}

export type UpdateProductDto = Partial<CreateProductDto>
