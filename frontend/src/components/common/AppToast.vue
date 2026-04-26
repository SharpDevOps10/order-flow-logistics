<script setup lang="ts">
import { computed } from 'vue'

type ToastType = 'success' | 'error' | 'info'

interface ToastAction {
  label: string
  onClick: () => void
}

interface Props {
  message: string
  type?: ToastType
  visible: boolean
  action?: ToastAction
}

const props = withDefaults(defineProps<Props>(), {
  type: 'info',
  action: undefined,
})

const emit = defineEmits<{
  close: []
}>()

type ToastConfig = {
  icon: string
  classes: string
  actionClasses: string
}

const config: Record<ToastType, ToastConfig> = {
  success: {
    icon: '✓',
    classes: 'bg-green-50 border-green-200 text-green-800',
    actionClasses: 'text-green-700 hover:bg-green-100',
  },
  error: {
    icon: '✕',
    classes: 'bg-red-50 border-red-200 text-red-800',
    actionClasses: 'text-red-700 hover:bg-red-100',
  },
  info: {
    icon: 'ℹ',
    classes: 'bg-blue-50 border-blue-200 text-blue-800',
    actionClasses: 'text-blue-700 hover:bg-blue-100',
  },
}

const current = computed(() => config[props.type])

const handleAction = () => {
  props.action?.onClick()
  emit('close')
}
</script>

<template>
  <Teleport to="body">
    <Transition name="toast">
      <div
        v-if="props.visible"
        class="fixed bottom-4 right-4 z-50 flex items-center gap-3 border rounded-xl px-4 py-3 shadow-lg max-w-sm w-full"
        :class="current.classes"
      >
        <span class="text-sm font-bold flex-shrink-0">{{ current.icon }}</span>
        <p class="text-sm flex-1">{{ props.message }}</p>
        <button
          v-if="props.action"
          class="flex-shrink-0 text-xs font-semibold uppercase tracking-wide px-2 py-1 rounded-md transition-colors"
          :class="current.actionClasses"
          @click="handleAction"
        >
          {{ props.action.label }}
        </button>
        <button
          class="flex-shrink-0 opacity-60 hover:opacity-100 transition-opacity"
          @click="emit('close')"
        >
          <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.toast-enter-active,
.toast-leave-active {
  transition: all 0.25s ease;
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateY(12px) scale(0.96);
}
</style>
