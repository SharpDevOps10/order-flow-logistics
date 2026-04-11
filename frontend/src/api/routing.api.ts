import type { DeliveryRoute } from '@/types/routing.types'
import { axiosInstance } from './axios.instance'

export const RoutingApi = {
  getRoute: async (): Promise<DeliveryRoute[]> => {
    const { data } = await axiosInstance.get<DeliveryRoute[]>('/courier/route')
    return data
  },
}
