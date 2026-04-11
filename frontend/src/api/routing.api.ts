import type { OptimizedRoute } from '@/types/routing.types'
import { axiosInstance } from './axios.instance'

export const RoutingApi = {
  getRoute: async (): Promise<OptimizedRoute[]> => {
    const { data } = await axiosInstance.get<OptimizedRoute[]>('/courier/route')
    return data
  },
}
