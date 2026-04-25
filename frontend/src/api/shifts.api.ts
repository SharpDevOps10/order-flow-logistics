import { axiosInstance } from './axios.instance'
import type { ShiftSlot, ShiftSlotRecord } from '@/types/shift.types'

export const ShiftsApi = {
  getMine: async (): Promise<ShiftSlotRecord[]> => {
    const { data } = await axiosInstance.get<ShiftSlotRecord[]>('/shifts/me')
    return data
  },

  setMine: async (slots: ShiftSlot[]): Promise<ShiftSlotRecord[]> => {
    const { data } = await axiosInstance.put<ShiftSlotRecord[]>('/shifts/me', {
      slots,
    })
    return data
  },
}
