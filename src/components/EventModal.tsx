import { addHours, endOfDay, setHours, startOfDay, startOfHour } from 'date-fns'
import { useState, type FormEvent } from 'react'
import { fromInputs, toDateInput, toTimeInput } from '../lib/dates'
import { canEdit, type CalEvent, type Calendar, type EventInput } from '../types'
import { Modal } from './Modal'

interface Props {
  event: CalEvent | null
  day: Date
  calendars: Calendar[]
  defaultCalendarId: string | undefined
  onSave: (input: EventInput) => Promise<void>
  onDelete: () => Promise<void>
  onClose: () => void
}

function defaultTimes(day: Date) {
  const now = new Date()
  const start =
    toDateInput(day) === toDateInput(now) ? addHours(startOfHour(now), 1) : setHours(startOfDay(day), 9)
  return { start, end: addHours(start, 1) }
}

export function EventModal({ event, day, calendars, defaultCalendarId, onSave, onDelete, onClose }: Props) {
  const eventCal = event ? calendars.find((c) => c.id === event.calendar_id) : undefined
  const readOnly = !!event && !canEdit(eventCal)
  const editable = calendars.filter(canEdit)

  const init = event
    ? { start: new Date(event.start_at), end: new Date(event.end_at) }
    : defaultTimes(day)

  const [title, setTitle] = useState(event?.title ?? '')
  const [calendarId, setCalendarId] = useState(
    event?.calendar_id ?? defaultCalendarId ?? editable[0]?.id ?? '',
  )
  const [allDay, setAllDay] = useState(event?.all_day ?? false)
  const [startDate, setStartDate] = useState(toDateInput(init.start))
  const [startTime, setStartTime] = useState(toTimeInput(init.start))
  const [endDate, setEndDate] = useState(toDateInput(init.end))
  const [endTime, setEndTime] = useState(toTimeInput(init.end))
  const [location, setLocation] = useState(event?.location ?? '')
  const [description, setDescription] = useState(event?.description ?? '')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const changeStartDate = (v: string) => {
    setStartDate(v)
    if (v > endDate) setEndDate(v)
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const start = allDay ? startOfDay(fromInputs(startDate)) : fromInputs(startDate, startTime)
    const end = allDay ? endOfDay(fromInputs(endDate)) : fromInputs(endDate, endTime)
    if (!title.trim()) return setError('제목을 입력해 주세요.')
    if (!calendarId) return setError('캘린더를 선택해 주세요.')
    if (end < start) return setError('끝나는 시간이 시작 시간보다 빨라요.')
    setBusy(true)
    setError(null)
    try {
      await onSave({
        calendar_id: calendarId,
        title: title.trim(),
        description: description.trim() || null,
        location: location.trim() || null,
        start_at: start.toISOString(),
        end_at: end.toISOString(),
        all_day: allDay,
      })
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setBusy(false)
    }
  }

  const remove = async () => {
    if (!window.confirm('이 일정을 삭제할까요?')) return
    setBusy(true)
    try {
      await onDelete()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setBusy(false)
    }
  }

  const selectable = readOnly && eventCal ? [eventCal] : editable

  return (
    <Modal
      title={readOnly ? '일정 보기' : event ? '일정 수정' : '새 일정'}
      onClose={onClose}
      footer={
        readOnly ? (
          <button className="btn" onClick={onClose}>
            닫기
          </button>
        ) : (
          <>
            {event && (
              <button className="btn danger" onClick={remove} disabled={busy}>
                삭제
              </button>
            )}
            <span className="spacer" />
            <button className="btn" onClick={onClose} disabled={busy}>
              취소
            </button>
            <button className="btn primary" type="submit" form="event-form" disabled={busy}>
              저장
            </button>
          </>
        )
      }
    >
      <form id="event-form" className="form" onSubmit={submit}>
        <fieldset disabled={readOnly || busy}>
          <input
            className="title-input"
            placeholder="제목"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            autoFocus={!event}
            maxLength={200}
          />

          <label className="field">
            <span>캘린더</span>
            <select value={calendarId} onChange={(e) => setCalendarId(e.target.value)}>
              {selectable.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>

          <label className="check">
            <input type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} />
            종일
          </label>

          <div className="field-row">
            <label className="field">
              <span>시작</span>
              <input type="date" value={startDate} onChange={(e) => changeStartDate(e.target.value)} required />
            </label>
            {!allDay && (
              <label className="field">
                <span>&nbsp;</span>
                <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} required />
              </label>
            )}
          </div>

          <div className="field-row">
            <label className="field">
              <span>종료</span>
              <input type="date" value={endDate} min={startDate} onChange={(e) => setEndDate(e.target.value)} required />
            </label>
            {!allDay && (
              <label className="field">
                <span>&nbsp;</span>
                <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} required />
              </label>
            )}
          </div>

          <label className="field">
            <span>장소</span>
            <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="선택 사항" />
          </label>

          <label className="field">
            <span>메모</span>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="선택 사항"
            />
          </label>
        </fieldset>
        {readOnly && <p className="hint">이 캘린더는 보기 권한만 있어요.</p>}
        {error && <p className="error">{error}</p>}
      </form>
    </Modal>
  )
}
