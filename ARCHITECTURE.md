# Order Flow Logistics — Architecture

## Project Overview

A diploma project: a SaaS logistics marketplace for managing order delivery.

**Backend:** NestJS API at `http://localhost:3000`  
**Frontend:** Vue 3 SPA in `frontend/` directory

---

## System Roles

1. **CLIENT** — Creates and tracks orders
2. **SUPPLIER** — Manages organizations and products, processes orders
3. **COURIER** — Delivers orders, views optimized delivery routes on map
4. **ADMIN** — Approves organizations

---

## Backend API Structure

### Auth Module

```
POST   /auth/signup        — Register new user
POST   /auth/signin        — Login (returns access_token + refresh_token)
POST   /auth/refresh       — Refresh expired access_token
POST   /auth/logout        — Logout (invalidates tokens)
```

### Organizations Module

```
POST   /organizations                    — SUPPLIER: Create organization
GET    /organizations                    — Public: Get all approved orgs
GET    /organizations/my                 — SUPPLIER: Get my organizations
GET    /organizations/pending            — ADMIN: Get pending (unapproved) orgs
PATCH  /organizations/:id/approve        — ADMIN: Approve organization
PATCH  /organizations/:id                — SUPPLIER (owner): Update organization
```

### Products Module

```
POST   /organizations/:orgId/products    — SUPPLIER (org owner): Create product
GET    /organizations/:orgId/products    — Public: Get products for organization
PATCH  /products/:id                     — SUPPLIER (owner): Update product
DELETE /products/:id                     — SUPPLIER (owner): Delete product
```

### Orders Module

```
POST   /orders                           — CLIENT: Create order
GET    /orders/my                        — CLIENT: Get my orders
GET    /orders/supplier                  — SUPPLIER: Get orders from my orgs
GET    /orders/courier                   — COURIER: Get orders assigned to me
PATCH  /orders/:id/status                — SUPPLIER: Update order status (PENDING → ACCEPTED → READY_FOR_DELIVERY)
PATCH  /orders/:id/assign-courier        — SUPPLIER: Assign courier to order
```

### Routing Module

```
GET    /courier/route                    — COURIER: Get optimized delivery route
```

**Returns:** Array of routes with waypoints (PICKUP + DELIVERYs) with coordinates and distances

---

## Frontend Architecture

### Folder Structure

```
frontend/
├── index.html
├── vite.config.ts
├── tsconfig.json
├── package.json
│
└── src/
    ├── main.ts                              # Vue app bootstrap
    ├── App.vue                              # Root component (RouterView + Toast)
    ├── style.css                            # Tailwind directives
    │
    ├── types/                               # TypeScript interfaces
    │   ├── auth.types.ts
    │   ├── organization.types.ts
    │   ├── product.types.ts
    │   ├── order.types.ts
    │   └── routing.types.ts
    │
    ├── api/                                 # Axios HTTP layer
    │   ├── axios.instance.ts                # Base instance + interceptors
    │   ├── auth.api.ts
    │   ├── organizations.api.ts
    │   ├── products.api.ts
    │   ├── orders.api.ts
    │   └── routing.api.ts
    │
    ├── stores/                              # Pinia state management
    │   ├── auth.store.ts                    # Identity + authentication
    │   ├── organizations.store.ts
    │   ├── products.store.ts
    │   ├── orders.store.ts
    │   ├── cart.store.ts                    # Ephemeral cart before checkout
    │   └── routing.store.ts
    │
    ├── composables/
    │   └── useToast.ts                      # Toast notification helper
    │
    ├── router/
    │   ├── index.ts                         # Router instance + navigation guard
    │   └── routes.ts                        # Route definitions (role-based)
    │
    ├── layouts/                             # One per role
    │   ├── AuthLayout.vue                   # Login/Register (no nav)
    │   ├── ClientLayout.vue
    │   ├── SupplierLayout.vue
    │   ├── CourierLayout.vue
    │   └── AdminLayout.vue
    │
    ├── views/                               # Page components
    │   ├── auth/
    │   │   ├── LoginView.vue
    │   │   └── RegisterView.vue
    │   │
    │   ├── client/
    │   │   ├── MarketplaceView.vue          # Browse approved organizations
    │   │   ├── OrganizationView.vue         # View products for one org
    │   │   ├── CheckoutView.vue             # Cart → create order
    │   │   └── MyOrdersView.vue             # View my orders
    │   │
    │   ├── supplier/
    │   │   ├── MyOrganizationsView.vue
    │   │   ├── OrganizationFormView.vue     # Create/Edit org (shared)
    │   │   ├── ProductsView.vue             # Manage products for org
    │   │   ├── ProductFormView.vue          # Create/Edit product (shared)
    │   │   └── IncomingOrdersView.vue       # View and process orders
    │   │
    │   ├── courier/
    │   │   ├── MyDeliveriesView.vue         # View assigned orders
    │   │   └── RouteMapView.vue             # View optimized route on map
    │   │
    │   └── admin/
    │       └── PendingOrgsView.vue          # Approve pending organizations
    │
    └── components/                          # Reusable components
        ├── common/
        │   ├── AppButton.vue
        │   ├── AppInput.vue
        │   ├── AppModal.vue
        │   ├── AppBadge.vue
        │   ├── AppSpinner.vue
        │   └── AppToast.vue
        │
        ├── orders/
        │   ├── OrderCard.vue
        │   ├── OrderStatusBadge.vue
        │   └── AssignCourierModal.vue
        │
        ├── products/
        │   ├── ProductCard.vue
        │   └── ProductForm.vue
        │
        ├── organizations/
        │   ├── OrganizationCard.vue
        │   └── OrganizationForm.vue
        │
        └── map/
            └── RouteMap.vue                 # Leaflet map wrapper
```

---

## Frontend Tech Stack

| Layer         | Technology                        |
|---------------|-----------------------------------|
| **Build**     | Vite + TypeScript                 |
| **Framework** | Vue 3 (Composition API)           |
| **Router**    | Vue Router 4 (role-based layouts) |
| **State**     | Pinia                             |
| **HTTP**      | axios with interceptors           |
| **Styling**   | Tailwind CSS                      |
| **Maps**      | Leaflet + OpenStreetMap           |

---

## Key Architectural Patterns

### 1. axios Interceptors (axios.instance.ts)

- **Request:** Injects `Authorization: Bearer {access_token}` header
- **Response 401:** Transparent token refresh with `failedQueue` pattern
    - If multiple requests fail with 401 simultaneously, only one refresh call is made
    - Other requests queue and retry with the new token
- **Refresh failure:** Clear localStorage and redirect to `/login`

```typescript
// Pattern: failedQueue
let isRefreshing = false
let failedQueue = []

// On 401, if isRefreshing is false:
//   - Set isRefreshing = true
//   - Make refresh call
//   - On success: process queue with new token
// If isRefreshing is true:
//   - Add request to failedQueue (promise-based)
//   - Wait for queue to be processed
```

### 2. Authentication Store (auth.store.ts)

- JWT is decoded client-side using `jwt-decode` library
- No `/auth/me` endpoint needed — role is in JWT payload
- `user` and `role` are computed properties from accessToken
- localStorage is the persistence layer

```typescript
const accessToken = ref(localStorage.getItem('access_token'))
const user = computed(() => {
  if (!accessToken.value) return null
  return jwtDecode<CurrentUser>(accessToken.value)
})
```

### 3. Router Guard (router/index.ts)

- Guard reads `localStorage` **directly** (not via Pinia store) to avoid circular dependencies
- Role-based route protection via `meta.role` on parent routes
- All children inherit the role requirement
- Post-login redirect determined by `ROLE_HOME` map

```typescript
const ROLE_HOME = {
  CLIENT: '/client/marketplace',
  SUPPLIER: '/supplier/organizations',
  COURIER: '/courier/deliveries',
  ADMIN: '/admin/pending',
}
```

### 4. Pinia Stores (Consistent Shape)

Every store follows this pattern:

```typescript
const state = ref<T[]>([])
const loading = ref(false)
const error = ref<string | null>(null)

const actions = async () => { ...
}
```

This allows templates to be trivial: `v-if="loading"`, `v-if="error"`, etc.

### 5. Route Structure (Role-Based Layouts)

```
/login, /register                    → AuthLayout (no nav)

/client/*                            → ClientLayout
  /client/marketplace
  /client/orgs/:id
  /client/checkout
  /client/orders

/supplier/*                          → SupplierLayout
  /supplier/organizations
  /supplier/organizations/new
  /supplier/organizations/:id
  /supplier/organizations/:id/products
  /supplier/products/new/:orgId
  /supplier/products/:id/edit
  /supplier/orders

/courier/*                           → CourierLayout
  /courier/deliveries
  /courier/route

/admin/*                             → AdminLayout
  /admin/pending
```

Each layout is a thin shell: a sidebar/topbar with role-specific nav links and a `<RouterView />`.

### 6. Leaflet Map Integration (RouteMap.vue)

- Map is initialized in `onMounted`, destroyed in `onUnmounted`
- Markers: 🏪 for PICKUP, 📦 for DELIVERY
- Polyline connects all waypoints
- `fitBounds` auto-zooms to all waypoints

---

## Development Order (Incremental)

1. **Scaffold** — `npm create vite@latest frontend -- --template vue-ts`
2. **Dependencies** — pinia, vue-router, axios, leaflet, jwt-decode, tailwindcss
3. **Auth** — Login, Register, token refresh, router guard
4. **Organizations** — Browse public, create/edit (SUPPLIER), approve (ADMIN)
5. **Products** — Browse, create/edit, delete
6. **Client Flow** — Cart, checkout, order creation, view my orders
7. **Supplier Flow** — Manage incoming orders, update status, assign courier
8. **Admin Flow** — Approve pending organizations
9. **Courier Flow** — View deliveries, optimized route map

Each step adds files without modifying existing ones — safe to build incrementally.

---

## Type Safety

All data flowing between API and views is typed via `src/types/`:

- `auth.types.ts` — User, roles, tokens
- `order.types.ts` — Orders, items, status enum
- `organization.types.ts` — Organizations
- `product.types.ts` — Products
- `routing.types.ts` — Waypoints, optimized routes

---

## Error Handling

Errors are stored as simple strings in stores (`error: ref<string | null>(null)`):

```typescript
try {
  await api.get(...)
} catch (e: unknown) {
  error.value = extractErrorMessage(e)  // Helper for AxiosError → string
}
```

Views show errors trivially:

```vue

<div v-if="error" class="text-red-500">{{ error }}</div>
```

---

## Styling

- **Framework:** Tailwind CSS (no pre-built component library)
- **Colors:** Use Tailwind default palette (gray, blue, green, red, yellow)
- **Layout:** Flex for layouts, grid for lists
- **Responsive:** Mobile-first, use `md:`, `lg:` breakpoints

---

## Performance Considerations

- **Code splitting:** All views lazy-loaded via `() => import(...)`
- **Bundle:** Only code for current role is downloaded on first visit
- **Token refresh:** Transparent, no page reload
- **Map:** Leaflet is bundled but only loaded when RouteMapView is visited

---

## Testing Flow (Manual with Postman)

1. Register 4 users (CLIENT, SUPPLIER, COURIER, ADMIN)
2. Login as SUPPLIER → create org and products
3. Login as ADMIN → approve the organization
4. Login as CLIENT → order products
5. Login as SUPPLIER → update order status, assign courier
6. Login as COURIER → view optimized route on map

---

## Backend Source Code (Reference)

```
/Users/danyil.tymofeiev/Programming/order-flow-logistics/backend/src/

├── modules/
│   ├── auth/
│   ├── organizations/
│   ├── products/
│   ├── orders/
│   └── routing/          # Route optimization (Dijkstra + Haversine)
│
├── database/
│   └── schema.ts         # Drizzle ORM table definitions
│
├── guards/
├── decorators/
└── common/
    └── enums/
```

**Key Algorithm:** `haversineKm()` in `src/modules/routing/dijkstra.ts`

- Calculates great-circle distance between two lat/lng coordinates
- Used to build weighted graph for Dijkstra's algorithm
- Greedy nearest-neighbour optimization for courier routes
