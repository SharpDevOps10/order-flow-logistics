import type {
  Organization,
  CreateOrganizationDto,
  UpdateOrganizationDto,
} from '@/types/organization.types'
import { axiosInstance } from './axios.instance'

export const OrganizationsApi = {
  getAll: async (): Promise<Organization[]> => {
    const { data } = await axiosInstance.get<Organization[]>('/organizations')
    return data
  },

  getMy: async (): Promise<Organization[]> => {
    const { data } = await axiosInstance.get<Organization[]>('/organizations/my')
    return data
  },

  getPending: async (): Promise<Organization[]> => {
    const { data } = await axiosInstance.get<Organization[]>('/organizations/pending')
    return data
  },

  create: async (dto: CreateOrganizationDto): Promise<Organization> => {
    const { data } = await axiosInstance.post<Organization>('/organizations', dto)
    return data
  },

  update: async (id: number, dto: UpdateOrganizationDto): Promise<Organization> => {
    const { data } = await axiosInstance.patch<Organization>(`/organizations/${id}`, dto)
    return data
  },

  approve: async (id: number): Promise<Organization> => {
    const { data } = await axiosInstance.patch<Organization>(`/organizations/${id}/approve`)
    return data
  },
}
