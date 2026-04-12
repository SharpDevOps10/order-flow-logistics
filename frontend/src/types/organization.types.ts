export interface Organization {
  id: number
  name: string
  ownerId: number | null
  region: string | null
  address: string | null
  lat: string | null
  lng: string | null
  isApproved: number
}

export interface CreateOrganizationDto {
  name: string
  region?: string
  address?: string
  lat?: number
  lng?: number
}

export interface UpdateOrganizationDto {
  name?: string
  region?: string
  address?: string
  lat?: number
  lng?: number
}
