<script setup lang="ts">
interface Props {
  title?: string
}

const props = withDefaults(defineProps<Props>(), {
  title: '',
})

const isOpen = defineModel<boolean>({ default: false })

const close = () => {
  isOpen.value = false
}
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="isOpen"
        class="fixed inset-0 z-50 flex items-center justify-center p-4"
        @mousedown.self="close"
      >
                <div class="absolute inset-0 bg-black/40 backdrop-blur-sm" />

                <div class="relative bg-white rounded-2xl shadow-xl w-full max-w-md flex flex-col max-h-[90vh]">

                    <div class="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
            <h2 class="text-base font-semibold text-gray-900">{{ props.title }}</h2>
            <button
              class="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-lg hover:bg-gray-100"
              @click="close"
            >
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

                    <div class="px-6 py-5 overflow-y-auto flex-1">
            <slot />
          </div>

                    <div v-if="$slots.footer" class="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 flex-shrink-0">
            <slot name="footer" />
          </div>

        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s ease;
}

.modal-enter-active .relative,
.modal-leave-active .relative {
  transition: transform 0.2s ease, opacity 0.2s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-from .relative,
.modal-leave-to .relative {
  transform: scale(0.95) translateY(8px);
  opacity: 0;
}
</style>
