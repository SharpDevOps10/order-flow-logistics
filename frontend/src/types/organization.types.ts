export interface Organization {
  id: string
  name: string
  description: string
  address: string
  isApproved: boolean
  supplierId: string
  createdAt: string
}

export interface CreateOrganizationDto {
  name: string
  description: string
  address: string
}

export type UpdateOrganizationDto = Partial<CreateOrganizationDto>
