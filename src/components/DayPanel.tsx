import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import { compareEvents, occursOn, timeLabel } from '../lib/dates'
import type { CalEvent, Calendar } from '../types'
import { Modal } from './Modal'

interface Props {
  day: Date
  events: CalEvent[]
  calendars: Map<string, Calendar>
  canAdd: boolean
  onAdd: () => void
  onOpen: (ev: CalEvent) => void
  onClose: () => void
}

export function DayPanel({ day, events, calendars, canAdd, onAdd, onOpen, onClose }: Props) {
  const list = events.filter((e) => occursOn(e, day)).sort(compareEvents)

  return (
    <Modal
      title={format(day, 'M월 d일 (EEE)', { locale: ko })}
      onClose={onClose}
      footer={
        canAdd && (
          <button className="btn primary" onClick={onAdd}>
            + 이 날에 일정 추가
          </button>
        )
      }
    >
      {list.length === 0 ? (
        <p className="empty">일정이 없어요.</p>
      ) : (
        <ul className="day-list">
          {list.map((ev) => {
            const cal = calendars.get(ev.calendar_id)
            return (
              <li key={ev.id}>
                <button className="day-item" onClick={() => onOpen(ev)}>
                  <span className="bar" style={{ background: cal?.color }} />
                  <span className="day-item-text">
                    <strong>{ev.title}</strong>
                    <small>
                      {timeLabel(ev)} · {cal?.name}
                      {ev.location ? ` · ${ev.location}` : ''}
                    </small>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </Modal>
  )
}
