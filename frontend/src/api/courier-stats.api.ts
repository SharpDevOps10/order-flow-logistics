import { axiosInstance } from './axios.instance'

export interface CourierSpeedStats {
  avgSpeedKmh: number
  sampleCount: number
  windowMinutes: number
  isFallback: boolean
}

export const CourierStatsApi = {
  getMySpeed: async (): Promise<CourierSpeedStats> => {
    const { data } = await axiosInstance.get<CourierSpeedStats>('/courier/stats/speed')
    return data
  },
}
