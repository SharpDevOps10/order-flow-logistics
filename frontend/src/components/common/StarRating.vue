<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  modelValue: number
  readonly?: boolean
  size?: 'sm' | 'md' | 'lg'
}

const props = withDefaults(defineProps<Props>(), {
  readonly: false,
  size: 'md',
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: number): void
}>()

const sizeClasses = computed(() => {
  switch (props.size) {
    case 'sm': return 'text-base'
    case 'lg': return 'text-3xl'
    default:   return 'text-2xl'
  }
})

const stars = [1, 2, 3, 4, 5]

const handleClick = (star: number) => {
  if (props.readonly) return
  emit('update:modelValue', star)
}
</script>

<template>
  <div class="inline-flex items-center gap-1">
    <button
      v-for="star in stars"
      :key="star"
      type="button"
      :disabled="readonly"
      class="leading-none transition-transform"
      :class="[
        sizeClasses,
        readonly ? 'cursor-default' : 'cursor-pointer hover:scale-110',
        star <= modelValue ? 'text-yellow-400' : 'text-gray-300',
      ]"
      :aria-label="`${star} star${star > 1 ? 's' : ''}`"
      @click="handleClick(star)"
    >
      ★
    </button>
  </div>
</template>
