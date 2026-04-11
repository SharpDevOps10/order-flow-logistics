import type { CourierUser } from '@/types/user.types'
import { axiosInstance } from './axios.instance'

export const UsersApi = {
  getCouriers: async (): Promise<CourierUser[]> => {
    const { data } = await axiosInstance.get<CourierUser[]>('/users/couriers')
    return data
  },
}
