import type { RouteRecordRaw } from 'vue-router'
import { UserRole } from '@/types/auth.types'

export const routes: RouteRecordRaw[] = [
  {
    path: '/',
    redirect: '/login',
  },
  {
    path: '/login',
    component: () => import('@/layouts/AuthLayout.vue'),
    children: [
      {
        path: '',
        name: 'login',
        component: () => import('@/views/auth/LoginView.vue'),
      },
    ],
  },
  {
    path: '/register',
    component: () => import('@/layouts/AuthLayout.vue'),
    children: [
      {
        path: '',
        name: 'register',
        component: () => import('@/views/auth/RegisterView.vue'),
      },
    ],
  },
  {
    path: '/client',
    component: () => import('@/layouts/ClientLayout.vue'),
    meta: { role: UserRole.Client },
    children: [
      {
        path: 'marketplace',
        name: 'marketplace',
        component: () => import('@/views/client/MarketplaceView.vue'),
      },
      {
        path: 'orgs/:id',
        name: 'organization',
        component: () => import('@/views/client/OrganizationView.vue'),
      },
      {
        path: 'checkout',
        name: 'checkout',
        component: () => import('@/views/client/CheckoutView.vue'),
      },
      {
        path: 'orders',
        name: 'my-orders',
        component: () => import('@/views/client/MyOrdersView.vue'),
      },
    ],
  },
  {
    path: '/supplier',
    component: () => import('@/layouts/SupplierLayout.vue'),
    meta: { role: UserRole.Supplier },
    children: [
      {
        path: 'organizations',
        name: 'my-organizations',
        component: () => import('@/views/supplier/MyOrganizationsView.vue'),
      },
      {
        path: 'organizations/new',
        name: 'organization-create',
        component: () => import('@/views/supplier/OrganizationFormView.vue'),
      },
      {
        path: 'organizations/:id',
        name: 'organization-edit',
        component: () => import('@/views/supplier/OrganizationFormView.vue'),
      },
      {
        path: 'organizations/:id/products',
        name: 'products',
        component: () => import('@/views/supplier/ProductsView.vue'),
      },
      {
        path: 'products/new/:orgId',
        name: 'product-create',
        component: () => import('@/views/supplier/ProductFormView.vue'),
      },
      {
        path: 'products/:id/edit',
        name: 'product-edit',
        component: () => import('@/views/supplier/ProductFormView.vue'),
      },
      {
        path: 'orders',
        name: 'incoming-orders',
        component: () => import('@/views/supplier/IncomingOrdersView.vue'),
      },
    ],
  },
  {
    path: '/courier',
    component: () => import('@/layouts/CourierLayout.vue'),
    meta: { role: UserRole.Courier },
    children: [
      {
        path: 'deliveries',
        name: 'my-deliveries',
        component: () => import('@/views/courier/MyDeliveriesView.vue'),
      },
      {
        path: 'route',
        name: 'route-map',
        component: () => import('@/views/courier/RouteMapView.vue'),
      },
    ],
  },
  {
    path: '/admin',
    component: () => import('@/layouts/AdminLayout.vue'),
    meta: { role: UserRole.Admin },
    children: [
      {
        path: 'pending',
        name: 'pending-orgs',
        component: () => import('@/views/admin/PendingOrgsView.vue'),
      },
    ],
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/login',
  },
]
