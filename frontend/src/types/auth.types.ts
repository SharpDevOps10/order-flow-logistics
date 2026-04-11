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
  role: UserRole
}

export interface SignInDto {
  email: string
  password: string
}

export interface AuthTokens {
  access_token: string
  refresh_token: string
}
