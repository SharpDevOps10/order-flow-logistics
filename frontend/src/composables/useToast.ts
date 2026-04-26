import { ref } from 'vue'

type ToastType = 'success' | 'error' | 'info'

interface ToastAction {
  label: string
  onClick: () => void
}

interface Toast {
  id: number
  message: string
  type: ToastType
  action?: ToastAction
}

interface ShowOptions {
  duration?: number
  action?: ToastAction
}

const toasts = ref<Toast[]>([])
let nextId = 0

const dismiss = (id: number) => {
  toasts.value = toasts.value.filter((t) => t.id !== id)
}

export const useToast = () => {
  const show = (message: string, type: ToastType = 'info', options: ShowOptions = {}) => {
    const id = nextId++
    const duration = options.duration ?? 3000
    toasts.value.push({ id, message, type, action: options.action })
    if (duration > 0) {
      setTimeout(() => dismiss(id), duration)
    }
    return id
  }

  const success = (message: string, options?: ShowOptions) => show(message, 'success', options)
  const error = (message: string, options?: ShowOptions) => show(message, 'error', options)
  const info = (message: string, options?: ShowOptions) => show(message, 'info', options)

  return { toasts, success, error, info, dismiss }
}
