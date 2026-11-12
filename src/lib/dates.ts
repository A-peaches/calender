import { endOfDay, format, isSameDay, startOfDay } from 'date-fns'
import type { CalEvent } from '../types'

/** 해당 날짜에 걸쳐 있는 일정인지 */
export function occursOn(ev: CalEvent, day: Date): boolean {
  return new Date(ev.start_at) <= endOfDay(day) && new Date(ev.end_at) >= startOfDay(day)
}

export function isMultiDay(ev: CalEvent): boolean {
  return !isSameDay(new Date(ev.start_at), new Date(ev.end_at))
}

/** 종일/여러 날 일정을 먼저, 그다음 시작 시간 순 */
export function compareEvents(a: CalEvent, b: CalEvent): number {
  const aLong = a.all_day || isMultiDay(a)
  const bLong = b.all_day || isMultiDay(b)
  if (aLong !== bLong) return aLong ? -1 : 1
  return a.start_at.localeCompare(b.start_at) || a.title.localeCompare(b.title)
}

export function timeLabel(ev: CalEvent): string {
  const s = new Date(ev.start_at)
  const e = new Date(ev.end_at)
  if (ev.all_day) {
    return isSameDay(s, e) ? '종일' : `${format(s, 'M/d')} ~ ${format(e, 'M/d')} 종일`
  }
  if (isSameDay(s, e)) return `${format(s, 'HH:mm')} ~ ${format(e, 'HH:mm')}`
  return `${format(s, 'M/d HH:mm')} ~ ${format(e, 'M/d HH:mm')}`
}

export const toDateInput = (d: Date) => format(d, 'yyyy-MM-dd')
export const toTimeInput = (d: Date) => format(d, 'HH:mm')

/** 'yyyy-MM-dd' + 'HH:mm' → 로컬 시간 Date */
export function fromInputs(date: string, time = '00:00'): Date {
  const [y, m, d] = date.split('-').map(Number)
  const [hh, mm] = time.split(':').map(Number)
  return new Date(y, m - 1, d, hh, mm)
}
