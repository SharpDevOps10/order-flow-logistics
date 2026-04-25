import { axiosInstance } from './axios.instance'
import type {
  CourierRatingStats,
  CreateReviewDto,
  OrderReview,
} from '@/types/review.types'

export const ReviewsApi = {
  create: async (dto: CreateReviewDto): Promise<OrderReview> => {
    const { data } = await axiosInstance.post<OrderReview>('/reviews', dto)
    return data
  },

  findByOrder: async (orderId: number): Promise<OrderReview | null> => {
    const { data } = await axiosInstance.get<OrderReview | null>(
      `/reviews/order/${orderId}`,
    )
    return data
  },

  getCourierStats: async (courierId: number): Promise<CourierRatingStats> => {
    const { data } = await axiosInstance.get<CourierRatingStats>(
      `/reviews/courier/${courierId}/stats`,
    )
    return data
  },
}
