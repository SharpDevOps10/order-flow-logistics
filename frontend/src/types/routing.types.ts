export type WaypointType = 'PICKUP' | 'DELIVERY'

export interface RouteWaypoint {
  type: WaypointType
  orderId: number | null
  organizationId: number | null
  address: string
  lat: number
  lng: number
  distanceFromPrevKm: number
  completed?: boolean
}

export interface OptimizedRoute {
  totalDistanceKm: number
  waypoints: RouteWaypoint[]
  geometry: [number, number][][] | null
}
