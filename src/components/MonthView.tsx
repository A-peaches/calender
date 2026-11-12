import {
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  getDay,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
} from 'date-fns'
import type { CSSProperties } from 'react'
import { compareEvents, isMultiDay, occursOn } from '../lib/dates'
import type { CalEvent, Calendar } from '../types'

interface Props {
  month: Date
  events: CalEvent[]
  calendars: Map<string, Calendar>
  onDayClick: (day: Date) => void
  onEventClick: (ev: CalEvent) => void
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']
const MAX_VISIBLE = 3

export function MonthView({ month, events, calendars, onDayClick, onEventClick }: Props) {
  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(month)),
    end: endOfWeek(endOfMonth(month)),
  })

  return (
    <div className="month">
      <div className="weekdays">
        {WEEKDAYS.map((w, i) => (
          <div key={w} className={`weekday ${i === 0 ? 'sun' : i === 6 ? 'sat' : ''}`}>
            {w}
          </div>
        ))}
      </div>
      <div className="days" style={{ gridTemplateRows: `repeat(${days.length / 7}, 1fr)` }}>
        {days.map((day) => {
          const dayEvents = events.filter((e) => occursOn(e, day)).sort(compareEvents)
          const hidden = dayEvents.length - MAX_VISIBLE
          const dow = getDay(day)
          return (
            <div
              key={day.toISOString()}
              className={[
                'day',
                isSameMonth(day, month) ? '' : 'outside',
                isToday(day) ? 'today' : '',
              ].join(' ')}
              onClick={() => onDayClick(day)}
            >
              <span className={`day-num ${dow === 0 ? 'sun' : dow === 6 ? 'sat' : ''}`}>
                {format(day, 'd')}
              </span>
              <div className="day-events">
                {dayEvents.slice(0, hidden > 0 ? MAX_VISIBLE - 1 : MAX_VISIBLE).map((ev) => {
                  const color = calendars.get(ev.calendar_id)?.color ?? '#888'
                  const block = ev.all_day || isMultiDay(ev)
                  return (
                    <button
                      key={ev.id}
                      className={`chip ${block ? 'block' : ''}`}
                      style={{ '--c': color } as CSSProperties}
                      onClick={(e) => {
                        e.stopPropagation()
                        onEventClick(ev)
                      }}
                      title={ev.title}
                    >
                      {!block && <span className="chip-time">{format(new Date(ev.start_at), 'HH:mm')}</span>}
                      <span className="chip-title">{ev.title}</span>
                    </button>
                  )
                })}
                {hidden > 0 && <span className="more">+{hidden + 1}개 더</span>}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
