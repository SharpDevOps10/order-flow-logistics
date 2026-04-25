export enum UserRole {
  Client = 'CLIENT',
  Supplier = 'SUPPLIER',
  Courier = 'COURIER',
  Admin = 'ADMIN',
}

export interface CurrentUser {
  sub: string
  email: string
  role: UserRole
  iat: number
  exp: number
}

export interface SignUpDto {
  email: string
  password: string
  fullName: string
  role?: UserRole
}

export interface SignInDto {
  email: string
  password: string
}

export interface AuthTokens {
  accessToken: string
  refreshToken: string
}

export interface SignUpResponse {
  message: string
  email: string
}

export interface VerifyEmailResponse {
  message: string
}
