export enum WaypointType {
  Pickup = 'PICKUP',
  Delivery = 'DELIVERY',
}

export interface Waypoint {
  type: WaypointType
  lat: number
  lng: number
  address: string
  orderId?: string
}

export interface DeliveryRoute {
  waypoints: Waypoint[]
  totalDistanceKm: number
}
