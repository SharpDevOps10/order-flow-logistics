# Order Flow Logistics

This is the diploma project — a delivery marketplace where suppliers sell goods, clients place orders, and couriers run
optimised routes to deliver them. Think of a tiny Glovo/Rozetka, stripped down, with most of the love poured into the
routing math rather than the UX.

Frontend is a Vue 3 SPA, backend is a NestJS API, and the infra (Postgres, Redis, RabbitMQ) runs in Docker.

## What it actually does

There are four roles, and each sees its own slice of the world:

- **CLIENT** browses the marketplace, adds items to the cart (one organisation per order — same rule every sane delivery
  app enforces), checks out, and watches the status tick.
- **SUPPLIER** registers organisations, adds products, moves incoming orders through the pipeline (PENDING → ACCEPTED →
  READY_FOR_DELIVERY), and either picks a courier by hand or lets the auto-assigner do it.
- **COURIER** sees the orders assigned to them, opens a map with the optimised route, and marks pickups and deliveries
  as they happen. Their live GPS streams over WebSocket so the dispatcher can reshuffle orders if a closer courier
  appears.
- **ADMIN** approves new organisations so garbage doesn't end up on the marketplace.

## The science part

The whole point of the diploma is the routing and assignment algorithms. A naive "pick the nearest free courier"
approach falls apart once you have more orders than couriers, so this is layered.

**Single-courier route (`routing/`).** Input: a bunch of pickup and delivery points. First we build an N×N distance
matrix (via OSRM when it's reachable, Haversine as a fallback). Then we solve the TSP — exact Held-Karp (bitmask DP) for
small n, greedy nearest-neighbour with 2-opt polish for the rest. The result is cached in Redis so we don't hammer OSM
every time the map re-renders.

**Batch courier assignment (`courier-assignment/batch-assignment.service.ts`).** When there are a lot of unclaimed
orders, a cron kicks in, builds a (courier × order) cost matrix, and solves it with the Hungarian (Kuhn-Munkres)
algorithm — so the global assignment cost is minimised instead of each pairing being locally greedy. A new order or a
courier coming free triggers a recompute and, if reassignment happens, a WebSocket notification goes out to whoever lost
the delivery.

## Stack

| Layer                          | Tech                                              |
|--------------------------------|---------------------------------------------------|
| Backend framework              | NestJS 11 (TypeScript, strict, no `any`)          |
| DB                             | PostgreSQL 16 + Drizzle ORM                       |
| Cache / courier location state | Redis 7 (ioredis)                                 |
| Message broker                 | RabbitMQ 3.13 (amqp-connection-manager)           |
| Auth                           | Passport JWT (access + refresh), Argon2           |
| Real-time                      | Socket.IO (courier gateway)                       |
| Email                          | nodemailer + handlebars                           |
| Routing                        | OSRM (self-hosted or public) + custom TSP solvers |
| Frontend                       | Vue 3, Pinia, Vue Router, Vite, Tailwind, Leaflet |

## Repo layout

```
backend/    NestJS API, Drizzle schema, routing algorithms
frontend/   Vue 3 SPA
docker-compose.yml   Postgres + Redis + RabbitMQ (lives in backend/)
```

More on the modules and patterns lives in `ARCHITECTURE.md` and `PROJECT_CONTEXT.md`.

## Running it locally

You need Node 20+ and Docker.

```bash
# 1. Infra
cd backend
npm install
npm run db:up          # Postgres, Redis, RabbitMQ
npm run db:push        # applies the Drizzle schema

# 2. Backend
cp .env.example .env   # fill in JWT secrets, SMTP, OSRM URL if you have one
npm run start:dev      # http://localhost:3000

# 3. Frontend (separate terminal)
cd ../frontend
npm install
npm run dev            # http://localhost:5173
```

For poking at the DB — `npm run db:studio` spins up Drizzle Studio in the browser.

RabbitMQ management UI is at `http://localhost:15672`, `guest/guest`.

## Walkthrough for manual testing

The shortest path that exercises everything:

1. Register four users, one per role. ADMIN has to be promoted directly in the DB — signup refuses to hand out that
   role.
2. As SUPPLIER, create an organisation and a handful of products.
3. As ADMIN, approve the organisation.
4. As CLIENT, find it on the marketplace and place an order.
5. As SUPPLIER, push the order to READY_FOR_DELIVERY — then either assign a courier manually or wait for the batch cron.
6. As COURIER, open the map, see the built route, and mark pickup/delivery as you go.
