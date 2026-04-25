<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { ShiftsApi } from '@/api/shifts.api'
import type { ShiftSlot } from '@/types/shift.types'
import { useToast } from '@/composables/useToast'
import AppButton from '@/components/common/AppButton.vue'
import AppSpinner from '@/components/common/AppSpinner.vue'

const toast = useToast()

const DAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
]

interface EditableSlot {
  dayOfWeek: number
  start: string
  end: string
}

const slots = ref<EditableSlot[]>([])
const loading = ref(true)
const saving = ref(false)

const minutesToTime = (m: number): string => {
  const hh = Math.floor(m / 60).toString().padStart(2, '0')
  const mm = (m % 60).toString().padStart(2, '0')
  return `${hh}:${mm}`
}

const timeToMinutes = (t: string): number => {
  const [hh, mm] = t.split(':').map(Number)
  return hh * 60 + mm
}

const slotsByDay = computed<Record<number, EditableSlot[]>>(() => {
  const map: Record<number, EditableSlot[]> = {}
  for (let d = 0; d < 7; d++) map[d] = []
  for (const s of slots.value) map[s.dayOfWeek].push(s)
  return map
})

const addSlot = (dayOfWeek: number) => {
  slots.value.push({ dayOfWeek, start: '09:00', end: '18:00' })
}

const removeSlot = (slot: EditableSlot) => {
  const idx = slots.value.indexOf(slot)
  if (idx !== -1) slots.value.splice(idx, 1)
}

const validate = (): string | null => {
  for (const s of slots.value) {
    const start = timeToMinutes(s.start)
    const end = timeToMinutes(s.end)
    if (start >= end) {
      return `${DAY_NAMES[s.dayOfWeek]}: start time must be before end time (cross-midnight not allowed)`
    }
  }
  for (let d = 0; d < 7; d++) {
    const daySlots = slotsByDay.value[d]
      .map((s) => ({
        start: timeToMinutes(s.start),
        end: timeToMinutes(s.end),
      }))
      .sort((a, b) => a.start - b.start)
    for (let i = 1; i < daySlots.length; i++) {
      if (daySlots[i].start < daySlots[i - 1].end) {
        return `${DAY_NAMES[d]}: slots overlap`
      }
    }
  }
  return null
}

const handleSave = async () => {
  const error = validate()
  if (error) {
    toast.error(error)
    return
  }
  saving.value = true
  try {
    const payload: ShiftSlot[] = slots.value.map((s) => ({
      dayOfWeek: s.dayOfWeek,
      startMinute: timeToMinutes(s.start),
      endMinute: timeToMinutes(s.end),
    }))
    await ShiftsApi.setMine(payload)
    toast.success('Schedule saved')
  } catch (e) {
    const msg =
      (e as { response?: { data?: { message?: string } } }).response?.data
        ?.message ?? 'Failed to save schedule'
    toast.error(msg)
  } finally {
    saving.value = false
  }
}

onMounted(async () => {
  try {
    const data = await ShiftsApi.getMine()
    slots.value = data.map((s) => ({
      dayOfWeek: s.dayOfWeek,
      start: minutesToTime(s.startMinute),
      end: minutesToTime(s.endMinute),
    }))
  } catch {
    toast.error('Failed to load schedule')
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div>
    <div class="flex items-start justify-between mb-6">
      <div>
        <h1 class="text-3xl font-bold text-gray-900">My Schedule</h1>
        <p class="text-sm text-gray-400 mt-1">
          Set the hours when you're available for deliveries.
          You won't receive new orders outside these slots.
        </p>
      </div>
      <AppButton :loading="saving" @click="handleSave">Save schedule</AppButton>
    </div>

    <div
      v-if="!loading && slots.length === 0"
      class="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 mb-4"
    >
      <p class="text-sm text-blue-700">
        💡 No schedule set — you're treated as always available.
        Add slots below to restrict your working hours.
      </p>
    </div>

    <AppSpinner v-if="loading" size="lg" />

    <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div
        v-for="(dayName, dayIndex) in DAY_NAMES"
        :key="dayIndex"
        class="bg-white border border-gray-100 rounded-2xl p-5"
      >
        <div class="flex items-center justify-between mb-3">
          <h3 class="font-semibold text-gray-900">{{ dayName }}</h3>
          <button
            type="button"
            class="text-xs font-medium text-orange-600 hover:text-orange-700"
            @click="addSlot(dayIndex)"
          >
            + Add slot
          </button>
        </div>

        <div v-if="slotsByDay[dayIndex].length === 0" class="text-xs text-gray-400 italic">
          Off
        </div>

        <div v-else class="flex flex-col gap-2">
          <div
            v-for="(slot, slotIdx) in slotsByDay[dayIndex]"
            :key="slotIdx"
            class="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2"
          >
            <input
              v-model="slot.start"
              type="time"
              class="text-sm border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:border-blue-500"
            />
            <span class="text-gray-400 text-sm">–</span>
            <input
              v-model="slot.end"
              type="time"
              class="text-sm border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:border-blue-500"
            />
            <button
              type="button"
              class="ml-auto text-red-500 hover:text-red-600 text-sm"
              :aria-label="`Remove slot`"
              @click="removeSlot(slot)"
            >
              ✕
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
