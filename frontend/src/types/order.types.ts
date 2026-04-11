export enum OrderStatus {
  Pending = 'PENDING',
  Accepted = 'ACCEPTED',
  ReadyForDelivery = 'READY_FOR_DELIVERY',
  InDelivery = 'IN_DELIVERY',
  Delivered = 'DELIVERED',
}

export interface OrderItem {
  productId: string
  productName: string
  quantity: number
  price: number
}

export interface Order {
  id: string
  status: OrderStatus
  clientId: string
  courierId: string | null
  organizationId: string
  deliveryAddress: string
  items: OrderItem[]
  createdAt: string
}

export interface CreateOrderDto {
  organizationId: string
  deliveryAddress: string
  items: Pick<OrderItem, 'productId' | 'quantity'>[]
}
