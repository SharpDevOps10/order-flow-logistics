<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { ShiftsApi } from '@/api/shifts.api'
import type { ShiftSlot } from '@/types/shift.types'
import { useToast } from '@/composables/useToast'
import AppButton from '@/components/common/AppButton.vue'
import AppSpinner from '@/components/common/AppSpinner.vue'

const toast = useToast()

const DAY_NAMES_SHORT = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']

interface Slot {
  id: string
  dayOfWeek: number
  startMinute: number
  endMinute: number
}

const slots = ref<Slot[]>([])
const loading = ref(true)
const saving = ref(false)
const selectedId = ref<string | null>(null)

const PIXELS_PER_HOUR = 48
const PIXELS_PER_MIN = PIXELS_PER_HOUR / 60
const TOTAL_HEIGHT = 24 * PIXELS_PER_HOUR
const SNAP_MIN = 15
const MIN_DURATION = 15

const calendarRef = ref<HTMLElement | null>(null)

const uid = () => Math.random().toString(36).slice(2, 10)

const snapMin = (m: number) => Math.round(m / SNAP_MIN) * SNAP_MIN
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

const formatTime = (m: number) => {
  const hh = Math.floor(m / 60).toString().padStart(2, '0')
  const mm = (m % 60).toString().padStart(2, '0')
  return `${hh}:${mm}`
}

const slotsByDay = computed<Record<number, Slot[]>>(() => {
  const map: Record<number, Slot[]> = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] }
  for (const s of slots.value) map[s.dayOfWeek].push(s)
  return map
})

const totalWeeklyMinutes = computed(() =>
  slots.value.reduce((acc, s) => acc + (s.endMinute - s.startMinute), 0),
)
const weeklyHours = computed(() => (totalWeeklyMinutes.value / 60).toFixed(1))
const workingDaysCount = computed(
  () => Object.values(slotsByDay.value).filter((d) => d.length > 0).length,
)

const slotStyle = (slot: Slot) => ({
  top: `${slot.startMinute * PIXELS_PER_MIN}px`,
  height: `${Math.max((slot.endMinute - slot.startMinute) * PIXELS_PER_MIN, 12)}px`,
})

interface DragState {
  type: 'create' | 'move' | 'resize-top' | 'resize-bottom'
  slot: Slot
  initialClientY: number
  initialClientX: number
  initialCursorMin: number
  initialDay: number
  initialStart: number
  initialEnd: number
  isClick: boolean
}

let dragState: DragState | null = null

const RESIZE_ZONE_PX = 6

const findGap = (
  dayOfWeek: number,
  ignoreId: string,
  anchorMin: number,
): { start: number; end: number } => {
  const neighbors = slots.value
    .filter((s) => s.dayOfWeek === dayOfWeek && s.id !== ignoreId)
    .sort((a, b) => a.startMinute - b.startMinute)
  let s = 0
  for (const n of neighbors) {
    if (anchorMin < n.startMinute) return { start: s, end: n.startMinute }
    if (anchorMin < n.endMinute) return { start: anchorMin, end: anchorMin }
    s = n.endMinute
  }
  return { start: s, end: 1440 }
}

const getMinuteFromEvent = (e: MouseEvent): number => {
  const grid = calendarRef.value
  if (!grid) return 0
  const rect = grid.getBoundingClientRect()
  const y = e.clientY - rect.top + grid.scrollTop
  return clamp(snapMin(y / PIXELS_PER_MIN), 0, 1440)
}

const getDayFromEvent = (e: MouseEvent): number => {
  const grid = calendarRef.value
  if (!grid) return 0
  const cols = grid.querySelectorAll<HTMLElement>('[data-day-col]')
  if (!cols.length) return 0
  for (let i = 0; i < cols.length; i++) {
    const r = cols[i].getBoundingClientRect()
    if (e.clientX >= r.left && e.clientX <= r.right) return i
  }
  const rect = cols[0].getBoundingClientRect()
  if (e.clientX < rect.left) return 0
  return 6
}

const startCreate = (dayIndex: number, e: MouseEvent) => {
  if (e.button !== 0) return
  const target = e.target as HTMLElement
  if (target.closest('[data-slot]')) return
  e.preventDefault()
  selectedId.value = null
  const startMin = getMinuteFromEvent(e)

  const tempId = uid()
  const gap = findGap(dayIndex, tempId, startMin)
  if (gap.end - gap.start < MIN_DURATION) return

  const start = clamp(startMin, gap.start, gap.end - MIN_DURATION)
  const newSlot: Slot = {
    id: tempId,
    dayOfWeek: dayIndex,
    startMinute: start,
    endMinute: start + MIN_DURATION,
  }
  slots.value.push(newSlot)
  dragState = {
    type: 'create',
    slot: newSlot,
    initialClientY: e.clientY,
    initialClientX: e.clientX,
    initialCursorMin: startMin,
    initialDay: dayIndex,
    initialStart: start,
    initialEnd: start + MIN_DURATION,
    isClick: true,
  }
  attachWindowHandlers()
}

const onSlotMouseDown = (slot: Slot, e: MouseEvent) => {
  if (e.button !== 0) return
  e.preventDefault()
  const target = e.currentTarget as HTMLElement
  const rect = target.getBoundingClientRect()
  const offsetY = e.clientY - rect.top
  if (offsetY <= RESIZE_ZONE_PX) {
    startResize('resize-top', slot, e)
  } else if (offsetY >= rect.height - RESIZE_ZONE_PX) {
    startResize('resize-bottom', slot, e)
  } else {
    startMove(slot, e)
  }
}

const startMove = (slot: Slot, e: MouseEvent) => {
  if (e.button !== 0) return
  e.preventDefault()
  selectedId.value = slot.id
  dragState = {
    type: 'move',
    slot,
    initialClientY: e.clientY,
    initialClientX: e.clientX,
    initialCursorMin: getMinuteFromEvent(e),
    initialDay: slot.dayOfWeek,
    initialStart: slot.startMinute,
    initialEnd: slot.endMinute,
    isClick: true,
  }
  attachWindowHandlers()
}

const startResize = (
  type: 'resize-top' | 'resize-bottom',
  slot: Slot,
  e: MouseEvent,
) => {
  if (e.button !== 0) return
  e.preventDefault()
  selectedId.value = slot.id
  dragState = {
    type,
    slot,
    initialClientY: e.clientY,
    initialClientX: e.clientX,
    initialCursorMin: getMinuteFromEvent(e),
    initialDay: slot.dayOfWeek,
    initialStart: slot.startMinute,
    initialEnd: slot.endMinute,
    isClick: false,
  }
  attachWindowHandlers()
}

const onMouseMove = (e: MouseEvent) => {
  if (!dragState) return
  if (
    Math.abs(e.clientY - dragState.initialClientY) > 3 ||
    Math.abs(e.clientX - dragState.initialClientX) > 3
  ) {
    dragState.isClick = false
  }

  const cursorMin = getMinuteFromEvent(e)
  const deltaMin = cursorMin - dragState.initialCursorMin

  if (dragState.type === 'create') {
    const gap = findGap(
      dragState.initialDay,
      dragState.slot.id,
      dragState.initialStart,
    )
    if (cursorMin < dragState.initialStart) {
      const newStart = clamp(cursorMin, gap.start, dragState.initialStart)
      dragState.slot.startMinute = newStart
      dragState.slot.endMinute = Math.max(
        dragState.initialStart,
        newStart + MIN_DURATION,
      )
    } else {
      const newEnd = clamp(
        Math.max(cursorMin, dragState.initialStart + MIN_DURATION),
        dragState.initialStart + MIN_DURATION,
        gap.end,
      )
      dragState.slot.startMinute = dragState.initialStart
      dragState.slot.endMinute = newEnd
    }
  } else if (dragState.type === 'move') {
    const duration = dragState.initialEnd - dragState.initialStart
    const proposedDay = getDayFromEvent(e)
    let newStart = clamp(dragState.initialStart + deltaMin, 0, 1440 - duration)
    const anchor = newStart + duration / 2
    const gap = findGap(proposedDay, dragState.slot.id, anchor)
    if (gap.end - gap.start >= duration) {
      newStart = clamp(newStart, gap.start, gap.end - duration)
      dragState.slot.startMinute = newStart
      dragState.slot.endMinute = newStart + duration
      dragState.slot.dayOfWeek = proposedDay
    }
  } else if (dragState.type === 'resize-top') {
    const gap = findGap(
      dragState.slot.dayOfWeek,
      dragState.slot.id,
      dragState.initialEnd - 1,
    )
    const newStart = clamp(
      dragState.initialStart + deltaMin,
      gap.start,
      dragState.initialEnd - MIN_DURATION,
    )
    dragState.slot.startMinute = newStart
  } else if (dragState.type === 'resize-bottom') {
    const gap = findGap(
      dragState.slot.dayOfWeek,
      dragState.slot.id,
      dragState.initialStart,
    )
    const newEnd = clamp(
      dragState.initialEnd + deltaMin,
      dragState.initialStart + MIN_DURATION,
      gap.end,
    )
    dragState.slot.endMinute = newEnd
  }
}

const onMouseUp = () => {
  if (!dragState) return
  if (dragState.type === 'create' && dragState.isClick) {
    const gap = findGap(
      dragState.slot.dayOfWeek,
      dragState.slot.id,
      dragState.slot.startMinute,
    )
    dragState.slot.endMinute = clamp(
      dragState.slot.startMinute + 60,
      dragState.slot.startMinute + MIN_DURATION,
      gap.end,
    )
    selectedId.value = dragState.slot.id
  }
  dragState = null
  detachWindowHandlers()
}

const attachWindowHandlers = () => {
  window.addEventListener('mousemove', onMouseMove)
  window.addEventListener('mouseup', onMouseUp)
}
const detachWindowHandlers = () => {
  window.removeEventListener('mousemove', onMouseMove)
  window.removeEventListener('mouseup', onMouseUp)
}

onBeforeUnmount(detachWindowHandlers)

const removeSlot = (slot: Slot) => {
  slots.value = slots.value.filter((s) => s.id !== slot.id)
  if (selectedId.value === slot.id) selectedId.value = null
}

const onBackgroundClick = () => {
  selectedId.value = null
}

const applyWeekdayPreset = () => {
  slots.value = slots.value.filter(
    (s) => s.dayOfWeek === 0 || s.dayOfWeek === 6,
  )
  for (let d = 1; d <= 5; d++) {
    slots.value.push({
      id: uid(),
      dayOfWeek: d,
      startMinute: 9 * 60,
      endMinute: 17 * 60,
    })
  }
}
const clearAll = () => {
  slots.value = []
  selectedId.value = null
}

const validate = (): string | null => {
  for (let d = 0; d < 7; d++) {
    const list = [...slotsByDay.value[d]].sort(
      (a, b) => a.startMinute - b.startMinute,
    )
    for (let i = 1; i < list.length; i++) {
      if (list[i].startMinute < list[i - 1].endMinute) {
        return `${DAY_NAMES_SHORT[d]}: slots overlap`
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
      startMinute: s.startMinute,
      endMinute: s.endMinute,
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
      id: uid(),
      dayOfWeek: s.dayOfWeek,
      startMinute: s.startMinute,
      endMinute: s.endMinute,
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
        <div class="flex items-start justify-between mb-6 gap-4 flex-wrap">
      <div>
        <h1 class="text-3xl font-bold text-gray-900">My Schedule</h1>
        <p class="text-sm text-gray-400 mt-1 max-w-xl">
          Click and drag on empty space to create a slot. Drag slots to move, drag edges to resize.
        </p>
      </div>
      <div class="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          class="text-xs font-medium text-gray-600 hover:text-gray-900 border border-gray-200 hover:border-gray-300 px-3 py-1.5 rounded-lg transition-colors"
          @click="applyWeekdayPreset"
        >
          Apply 9–5 weekdays
        </button>
        <button
          type="button"
          class="text-xs font-medium text-gray-600 hover:text-red-600 border border-gray-200 hover:border-red-200 px-3 py-1.5 rounded-lg transition-colors"
          @click="clearAll"
        >
          Clear all
        </button>
        <AppButton :loading="saving" @click="handleSave">Save</AppButton>
      </div>
    </div>

    <AppSpinner v-if="loading" size="lg" />

    <template v-else>
            <div class="grid grid-cols-3 gap-3 mb-5">
        <div class="bg-white border border-gray-100 rounded-2xl px-5 py-3">
          <p class="text-xs text-gray-400 uppercase tracking-wide font-medium">Weekly hours</p>
          <p class="text-xl font-bold text-gray-900 mt-1">
            {{ weeklyHours }}<span class="text-sm font-medium text-gray-400 ml-1">h</span>
          </p>
        </div>
        <div class="bg-white border border-gray-100 rounded-2xl px-5 py-3">
          <p class="text-xs text-gray-400 uppercase tracking-wide font-medium">Working days</p>
          <p class="text-xl font-bold text-gray-900 mt-1">
            {{ workingDaysCount }}<span class="text-sm font-medium text-gray-400 ml-1">/ 7</span>
          </p>
        </div>
        <div class="bg-white border border-gray-100 rounded-2xl px-5 py-3">
          <p class="text-xs text-gray-400 uppercase tracking-wide font-medium">Days off</p>
          <p class="text-xl font-bold text-gray-900 mt-1">{{ 7 - workingDaysCount }}</p>
        </div>
      </div>

            <div class="bg-white border border-gray-100 rounded-2xl overflow-x-auto" @click="onBackgroundClick">
                <div
          class="border-b border-gray-100 sticky top-0 bg-white z-10"
          style="display: grid; grid-template-columns: 60px repeat(7, minmax(110px, 1fr));"
        >
          <div></div>
          <div
            v-for="(name, i) in DAY_NAMES_SHORT"
            :key="i"
            class="text-center py-3 border-l border-gray-100"
          >
            <p class="text-[10px] font-semibold tracking-widest text-gray-400">{{ name }}</p>
            <p
              class="text-xs mt-0.5 font-medium"
              :class="slotsByDay[i].length > 0 ? 'text-orange-600' : 'text-gray-300'"
            >
              <template v-if="slotsByDay[i].length > 0">
                {{
                  (
                    slotsByDay[i].reduce((a, s) => a + (s.endMinute - s.startMinute), 0) / 60
                  ).toFixed(1)
                }}h
              </template>
              <template v-else>—</template>
            </p>
          </div>
        </div>

                <div
          ref="calendarRef"
          class="relative max-h-[640px] overflow-y-auto"
          style="display: grid; grid-template-columns: 60px repeat(7, minmax(110px, 1fr));"
        >
                    <div class="relative" :style="{ height: `${TOTAL_HEIGHT}px` }">
            <div
              v-for="h in 24"
              :key="h"
              class="absolute right-2 -translate-y-1/2 text-[10px] font-medium text-gray-400 select-none"
              :style="{ top: `${h * PIXELS_PER_HOUR}px` }"
            >
              {{ formatTime(h * 60) }}
            </div>
          </div>

                    <div
            v-for="(name, dIdx) in DAY_NAMES_SHORT"
            :key="dIdx"
            data-day-col
            class="relative border-l border-gray-100 cursor-crosshair"
            :style="{ height: `${TOTAL_HEIGHT}px` }"
            @mousedown="startCreate(dIdx, $event)"
          >
                        <div
              v-for="h in 23"
              :key="h"
              class="absolute inset-x-0 border-t border-gray-100 pointer-events-none"
              :style="{ top: `${h * PIXELS_PER_HOUR}px` }"
            />
                        <div
              v-for="h in 24"
              :key="`half-${h}`"
              class="absolute inset-x-0 border-t border-dashed border-gray-50 pointer-events-none"
              :style="{ top: `${h * PIXELS_PER_HOUR - PIXELS_PER_HOUR / 2}px` }"
            />

                        <div
              v-for="slot in slotsByDay[dIdx]"
              :key="slot.id"
              data-slot
              class="absolute left-1 right-1 rounded-md cursor-grab active:cursor-grabbing select-none transition-shadow group overflow-hidden"
              :class="
                selectedId === slot.id
                  ? 'shadow-lg z-20 outline outline-2 outline-orange-300'
                  : 'hover:shadow-md z-10'
              "
              :style="{
                ...slotStyle(slot),
                backgroundColor: selectedId === slot.id ? '#ea580c' : '#f97316',
                borderLeft: '3px solid #c2410c',
              }"
              @mousedown.stop="onSlotMouseDown(slot, $event)"
              @click.stop="selectedId = slot.id"
            >
                            <div
                class="absolute top-0 inset-x-0 h-2 cursor-ns-resize flex items-start justify-center pt-0.5"
              >
                <div
                  class="h-0.5 w-8 bg-white/70 rounded-full opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
                />
              </div>

                            <div class="px-2 py-1 text-white overflow-hidden h-full flex flex-col justify-start text-[11px] leading-tight pointer-events-none">
                <p class="font-semibold whitespace-nowrap">
                  {{ formatTime(slot.startMinute) }}–{{ formatTime(slot.endMinute) }}
                </p>
                <p
                  v-if="(slot.endMinute - slot.startMinute) >= 60"
                  class="text-white/80 mt-0.5 whitespace-nowrap"
                >
                  {{ ((slot.endMinute - slot.startMinute) / 60).toFixed(1) }}h shift
                </p>
              </div>

                            <button
                v-if="selectedId === slot.id"
                type="button"
                class="absolute top-1 right-1 w-5 h-5 flex items-center justify-center rounded bg-white/20 hover:bg-white/40 text-white text-xs leading-none z-30"
                aria-label="Remove slot"
                @mousedown.stop
                @click.stop="removeSlot(slot)"
              >
                ✕
              </button>

                            <div
                class="absolute bottom-0 inset-x-0 h-2 cursor-ns-resize flex items-end justify-center pb-0.5"
              >
                <div
                  class="h-0.5 w-8 bg-white/70 rounded-full opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
