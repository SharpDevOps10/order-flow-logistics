<script setup lang="ts">
import { RouterView } from 'vue-router'
import AppToast from '@/components/common/AppToast.vue'
import { useToast } from '@/composables/useToast'

const { toasts } = useToast()
</script>

<template>
  <RouterView />
  <AppToast
    v-for="t in toasts"
    :key="t.id"
    :message="t.message"
    :type="t.type"
    :action="t.action"
    :visible="true"
    @close="toasts.splice(toasts.findIndex(x => x.id === t.id), 1)"
  />
</template>
