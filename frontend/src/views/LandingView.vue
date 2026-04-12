<script setup lang="ts">
import { useRouter } from 'vue-router'

const router = useRouter()

const goToLogin = () => router.push('/login')
const goToRegister = () => router.push('/register')

type Feature = {
  icon: string
  role: string
  title: string
  description: string
  color: string
  bg: string
}

type TechItem = {
  name: string
  description: string
}

const features: Feature[] = [
  {
    icon: '🛍️',
    role: 'CLIENT',
    title: 'Client',
    description: 'Browse store catalogs, select products, place orders and track their status in real-time.',
    color: 'text-blue-700',
    bg: 'bg-blue-50 border-blue-100',
  },
  {
    icon: '🏪',
    role: 'SUPPLIER',
    title: 'Supplier',
    description: 'Create your own stores, manage product catalogs, process incoming orders and assign couriers.',
    color: 'text-green-700',
    bg: 'bg-green-50 border-green-100',
  },
  {
    icon: '🚴',
    role: 'COURIER',
    title: 'Courier',
    description: 'Receive assigned deliveries and view an optimized route on an interactive map using Dijkstra\'s algorithm.',
    color: 'text-orange-700',
    bg: 'bg-orange-50 border-orange-100',
  },
  {
    icon: '🛡️',
    role: 'ADMIN',
    title: 'Administrator',
    description: 'Moderate the platform: review store registration applications and approve them for display in the catalog.',
    color: 'text-purple-700',
    bg: 'bg-purple-50 border-purple-100',
  },
]

const techStack: TechItem[] = [
  { name: 'NestJS', description: 'Backend framework' },
  { name: 'PostgreSQL', description: 'Database' },
  { name: 'Drizzle ORM', description: 'ORM Layer' },
  { name: 'Vue 3', description: 'Frontend SPA' },
  { name: 'Pinia', description: 'State management' },
  { name: 'Dijkstra', description: 'Route Algorithm' },
]
</script>

<template>
  <div class="min-h-screen bg-white flex flex-col">

    <!-- Nav -->
    <header class="border-b border-gray-100 bg-white/80 backdrop-blur-sm sticky top-0 z-10">
      <div class="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <div class="flex items-center gap-2">
          <span class="text-xl font-bold text-gray-900">OrderFlow</span>
          <span class="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">Logistics</span>
        </div>
        <div class="flex items-center gap-3">
          <button
            class="text-sm text-gray-600 hover:text-gray-900 font-medium transition-colors px-3 py-1.5"
            @click="goToLogin"
          >
            Log In
          </button>
          <button
            class="text-sm bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-1.5 rounded-lg transition-colors"
            @click="goToRegister"
          >
            Sign Up
          </button>
        </div>
      </div>
    </header>

    <main class="flex-1">

      <!-- Hero -->
      <section class="max-w-6xl mx-auto px-6 pt-20 pb-24 text-center">
        <div class="inline-flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-full px-4 py-1.5 mb-8">
          <span class="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></span>
          <span class="text-sm text-blue-700 font-medium">Thesis Project · 2026</span>
        </div>

        <h1 class="text-5xl md:text-6xl font-extrabold text-gray-900 mb-6 leading-tight tracking-tight">
          Order Management System<br />
          <span class="text-blue-600">with Route Optimization</span><br />
          for Last-Mile Delivery
        </h1>

        <p class="text-xl text-gray-500 max-w-2xl mx-auto mb-10 leading-relaxed">
          A SaaS marketplace for small businesses with a multi-role system,
          order processing, and delivery route optimization based on
          Dijkstra's algorithm.
        </p>

        <div class="flex items-center justify-center gap-4 flex-wrap">
          <button
            class="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-8 py-3 rounded-xl transition-colors text-base shadow-sm"
            @click="goToRegister"
          >
            Get Started
          </button>
          <button
            class="border border-gray-200 hover:border-gray-300 bg-white text-gray-700 font-semibold px-8 py-3 rounded-xl transition-colors text-base"
            @click="goToLogin"
          >
            Sign In
          </button>
        </div>

        <!-- Stats -->
        <div class="mt-16 grid grid-cols-3 gap-8 max-w-lg mx-auto">
          <div>
            <p class="text-3xl font-bold text-gray-900">4</p>
            <p class="text-sm text-gray-500 mt-1">Roles</p>
          </div>
          <div>
            <p class="text-3xl font-bold text-gray-900">JWT</p>
            <p class="text-sm text-gray-500 mt-1">Authorization</p>
          </div>
          <div>
            <p class="text-3xl font-bold text-gray-900">∞</p>
            <p class="text-sm text-gray-500 mt-1">Organizations</p>
          </div>
        </div>
      </section>

      <!-- Divider -->
      <div class="border-t border-gray-100" />

      <!-- Features / Roles -->
      <section class="max-w-6xl mx-auto px-6 py-20">
        <div class="text-center mb-12">
          <h2 class="text-3xl font-bold text-gray-900 mb-3">Four Roles — One Platform</h2>
          <p class="text-gray-500 text-lg">Each participant gets a personalized interface with their own set of features</p>
        </div>

        <div class="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
          <div
            v-for="feature in features"
            :key="feature.role"
            class="border rounded-2xl p-6 flex flex-col gap-4 transition-shadow hover:shadow-md"
            :class="feature.bg"
          >
            <div class="text-4xl">{{ feature.icon }}</div>
            <div>
              <span class="text-xs font-semibold tracking-widest uppercase" :class="feature.color">{{ feature.role }}</span>
              <h3 class="text-lg font-bold text-gray-900 mt-1">{{ feature.title }}</h3>
            </div>
            <p class="text-sm text-gray-600 leading-relaxed flex-1">{{ feature.description }}</p>
          </div>
        </div>
      </section>

      <!-- Divider -->
      <div class="border-t border-gray-100" />

      <!-- Route Algorithm highlight -->
      <section class="bg-gray-50">
        <div class="max-w-6xl mx-auto px-6 py-20 flex flex-col lg:flex-row items-center gap-12">
          <div class="flex-1">
            <span class="text-xs font-semibold tracking-widest uppercase text-blue-600">Scientific Part</span>
            <h2 class="text-3xl font-bold text-gray-900 mt-2 mb-4">Route Optimization Algorithm</h2>
            <p class="text-gray-500 leading-relaxed mb-6">
              The key feature of the system is Dijkstra's algorithm for building an optimal
              delivery route. Distances between points are calculated using the
              haversine formula (great circle distance). The courier sees an interactive map with
              PICKUP and DELIVERY points, ordered by the shortest path.
            </p>
            <ul class="space-y-2">
              <li class="flex items-center gap-3 text-sm text-gray-700">
                <span class="w-5 h-5 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold flex-shrink-0">✓</span>
                Weighted graph based on GPS coordinates
              </li>
              <li class="flex items-center gap-3 text-sm text-gray-700">
                <span class="w-5 h-5 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold flex-shrink-0">✓</span>
                Haversine formula for real distances
              </li>
              <li class="flex items-center gap-3 text-sm text-gray-700">
                <span class="w-5 h-5 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold flex-shrink-0">✓</span>
                Greedy optimization for multiple orders
              </li>
              <li class="flex items-center gap-3 text-sm text-gray-700">
                <span class="w-5 h-5 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold flex-shrink-0">✓</span>
                Route visualization on Leaflet / OpenStreetMap
              </li>
            </ul>
          </div>

          <!-- Route diagram -->
          <div class="flex-1 flex justify-center">
            <div class="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm w-full max-w-sm">
              <p class="text-xs text-gray-400 font-medium uppercase tracking-widest mb-4">Route Example</p>
              <div class="space-y-3">
                <div class="flex items-center gap-3">
                  <span class="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center text-sm">🏪</span>
                  <div class="flex-1">
                    <p class="text-sm font-medium text-gray-800">PICKUP — Store A</p>
                    <p class="text-xs text-gray-400">50.4501° N, 30.5234° E</p>
                  </div>
                </div>
                <div class="ml-4 border-l-2 border-dashed border-gray-200 pl-3 py-1">
                  <p class="text-xs text-gray-400">1.2 км</p>
                </div>
                <div class="flex items-center gap-3">
                  <span class="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-sm">📦</span>
                  <div class="flex-1">
                    <p class="text-sm font-medium text-gray-800">DELIVERY — Client 1</p>
                    <p class="text-xs text-gray-400">50.4612° N, 30.5150° E</p>
                  </div>
                </div>
                <div class="ml-4 border-l-2 border-dashed border-gray-200 pl-3 py-1">
                  <p class="text-xs text-gray-400">0.8 км</p>
                </div>
                <div class="flex items-center gap-3">
                  <span class="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-sm">📦</span>
                  <div class="flex-1">
                    <p class="text-sm font-medium text-gray-800">DELIVERY — Client 2</p>
                    <p class="text-xs text-gray-400">50.4580° N, 30.5310° E</p>
                  </div>
                </div>
              </div>
              <div class="mt-4 pt-4 border-t border-gray-100 flex justify-between text-xs text-gray-500">
                <span>Total Distance</span>
                <span class="font-semibold text-gray-800">2.0 km</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Divider -->
      <div class="border-t border-gray-100" />

      <!-- Tech Stack -->
      <section class="max-w-6xl mx-auto px-6 py-20">
        <div class="text-center mb-12">
          <h2 class="text-3xl font-bold text-gray-900 mb-3">Technology Stack</h2>
          <p class="text-gray-500 text-lg">Modern technologies for production-ready solution</p>
        </div>

        <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <div
            v-for="tech in techStack"
            :key="tech.name"
            class="border border-gray-100 rounded-xl p-4 text-center hover:border-blue-200 hover:bg-blue-50 transition-colors"
          >
            <p class="font-bold text-gray-900 text-sm">{{ tech.name }}</p>
            <p class="text-xs text-gray-400 mt-1">{{ tech.description }}</p>
          </div>
        </div>
      </section>

      <!-- CTA -->
      <section class="bg-blue-600">
        <div class="max-w-6xl mx-auto px-6 py-16 text-center">
          <h2 class="text-3xl font-bold text-white mb-4">Ready to Get Started?</h2>
          <p class="text-blue-200 text-lg mb-8">Choose your role and sign in</p>
          <div class="flex items-center justify-center gap-4 flex-wrap">
            <button
              class="bg-white hover:bg-gray-50 text-blue-600 font-semibold px-8 py-3 rounded-xl transition-colors text-base"
              @click="goToRegister"
            >
              Sign Up
            </button>
            <button
              class="border border-blue-400 hover:border-white text-white font-semibold px-8 py-3 rounded-xl transition-colors text-base"
              @click="goToLogin"
            >
              Log In
            </button>
          </div>
        </div>
      </section>
    </main>

    <!-- Footer -->
    <footer class="border-t border-gray-100 bg-white">
      <div class="max-w-6xl mx-auto px-6 py-6 flex flex-col md:flex-row items-center justify-between gap-2 text-sm text-gray-400">
        <span>© 2026 OrderFlow Logistics — Thesis Project</span>
        <span>NestJS · Vue 3 · PostgreSQL · Dijkstra</span>
      </div>
    </footer>

  </div>
</template>
