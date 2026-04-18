<script setup lang="ts">
import { RouterView } from 'vue-router'
</script>

<template>
  <div class="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">

        <div class="mb-8 flex flex-col items-center gap-1">
      <span class="text-2xl font-bold text-gray-900">OrderFlow</span>
      <span class="text-xs text-gray-400 tracking-widest uppercase">Logistics</span>
    </div>

        <div class="bg-white border border-gray-100 rounded-2xl shadow-sm w-full max-w-md p-8">
      <RouterView />
    </div>

        <p class="mt-6 text-xs text-gray-400">© 2026 Order Flow Logistics</p>
  </div>
</template>
