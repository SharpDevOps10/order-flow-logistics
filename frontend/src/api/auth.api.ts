import type { SignUpDto, SignInDto, AuthTokens } from '@/types/auth.types'
import { axiosInstance } from './axios.instance'

export const AuthApi = {
  signUp: async (dto: SignUpDto): Promise<AuthTokens> => {
    const { data } = await axiosInstance.post<AuthTokens>('/auth/signup', dto)
    return data
  },

  signIn: async (dto: SignInDto): Promise<AuthTokens> => {
    const { data } = await axiosInstance.post<AuthTokens>('/auth/signin', dto)
    return data
  },

  logout: async (): Promise<void> => {
    await axiosInstance.post('/auth/logout')
  },
}
