export interface OrderReview {
  id: number
  orderId: number
  clientId: number
  courierId: number
  courierRating: number
  speedRating: number
  comment: string | null
  createdAt: string
}

export interface CreateReviewDto {
  orderId: number
  courierRating: number
  speedRating: number
  comment?: string
}

export interface CourierRatingStats {
  count: number
  averageCourier: number | null
  averageSpeed: number | null
  bayesianCourier: number
  bayesianSpeed: number
  globalMean: number
}
