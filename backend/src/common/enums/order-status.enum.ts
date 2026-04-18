export enum OrderStatus {
  PENDING = 'PENDING',
  ACCEPTED = 'ACCEPTED',
  READY_FOR_DELIVERY = 'READY_FOR_DELIVERY',
  PICKED_UP = 'PICKED_UP',
  DELIVERED = 'DELIVERED',
}

export const ORDER_STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  [OrderStatus.PENDING]: [OrderStatus.ACCEPTED],
  [OrderStatus.ACCEPTED]: [OrderStatus.READY_FOR_DELIVERY],
  [OrderStatus.READY_FOR_DELIVERY]: [OrderStatus.PICKED_UP],
  [OrderStatus.PICKED_UP]: [OrderStatus.DELIVERED],
  [OrderStatus.DELIVERED]: [],
};
