import type {
  SignUpDto,
  SignInDto,
  AuthTokens,
  SignUpResponse,
  VerifyEmailResponse,
} from '@/types/auth.types'
import { axiosInstance } from './axios.instance'

export const AuthApi = {
  signUp: async (dto: SignUpDto): Promise<SignUpResponse> => {
    const { data } = await axiosInstance.post<SignUpResponse>('/auth/signup', dto)
    return data
  },

  signIn: async (dto: SignInDto): Promise<AuthTokens> => {
    const { data } = await axiosInstance.post<AuthTokens>('/auth/signin', dto)
    return data
  },

  logout: async (): Promise<void> => {
    await axiosInstance.post('/auth/logout')
  },

  verifyEmail: async (token: string): Promise<VerifyEmailResponse> => {
    const { data } = await axiosInstance.post<VerifyEmailResponse>(
      '/auth/verify-email',
      { token },
    )
    return data
  },

  resendVerification: async (email: string): Promise<VerifyEmailResponse> => {
    const { data } = await axiosInstance.post<VerifyEmailResponse>(
      '/auth/resend-verification',
      { email },
    )
    return data
  },
}
