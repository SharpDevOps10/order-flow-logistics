export interface ShiftSlot {
  dayOfWeek: number
  startMinute: number
  endMinute: number
}

export interface ShiftSlotRecord extends ShiftSlot {
  id: number
  courierId: number
}
