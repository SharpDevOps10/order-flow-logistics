export enum OrderStatus {
  Pending = 'PENDING',
  Accepted = 'ACCEPTED',
  ReadyForDelivery = 'READY_FOR_DELIVERY',
  PickedUp = 'PICKED_UP',
  Delivered = 'DELIVERED',
}

export interface OrderItem {
  id: number
  orderId: number
  productId: number
  quantity: number
  priceAtPurchase: number
  productName?: string | null
  productImageUrl?: string | null
}

export interface Order {
  id: number
  clientId: number
  organizationId: number
  courierId: number | null
  status: OrderStatus
  totalAmount: number
  deliveryAddress: string
  lat: string | null
  lng: string | null
  deliveryFee: number
  pricingBreakdown: unknown | null
  createdAt: string | null
  items?: OrderItem[]
  clientName?: string | null
}

export interface OrderWithItems extends Order {
  items: OrderItem[]
}

export interface CreateOrderItemDto {
  productId: number
  quantity: number
}

export interface CreateOrderDto {
  organizationId: number
  deliveryAddress: string
  lat?: string
  lng?: string
  items: CreateOrderItemDto[]
}

export interface AssignCourierDto {
  courierId: number
}
