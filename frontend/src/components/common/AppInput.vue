<script setup lang="ts">
interface Props {
  label?: string
  placeholder?: string
  type?: string
  error?: string
  helper?: string
  disabled?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  label: '',
  placeholder: '',
  type: 'text',
  error: '',
  helper: '',
  disabled: false,
})

const modelValue = defineModel<string | number>()
</script>

<template>
  <div class="flex flex-col gap-1">
    <label v-if="props.label" class="text-sm font-medium text-gray-700">
      {{ props.label }}
    </label>
    <input
      v-model="modelValue"
      :type="props.type"
      :placeholder="props.placeholder"
      :disabled="props.disabled"
      class="w-full border rounded-xl px-3 py-2 text-sm text-gray-900 placeholder-gray-400 bg-white transition focus:outline-none focus:ring-2 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
      :class="
        props.error
          ? 'border-red-400 focus:ring-red-400'
          : 'border-gray-200 focus:ring-blue-500'
      "
    />
    <p v-if="props.error" class="text-xs text-red-500">{{ props.error }}</p>
    <p v-else-if="props.helper" class="text-xs text-gray-400">{{ props.helper }}</p>
  </div>
</template>
