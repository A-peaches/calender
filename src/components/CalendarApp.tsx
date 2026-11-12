import { addMonths, endOfMonth, endOfWeek, format, startOfMonth, startOfWeek } from 'date-fns'
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Store } from '../lib/store'
import { canEdit, type CalEvent, type Calendar } from '../types'
import { JoinCalendarModal, NewCalendarModal } from './CalendarForms'
import { CalendarSettings } from './CalendarSettings'
import { DayPanel } from './DayPanel'
import { EventModal } from './EventModal'
import { MonthView } from './MonthView'

interface Props {
  store: Store
  userLabel: string
  onSignOut?: () => void
}

type ModalState =
  | { kind: 'day'; day: Date }
  | { kind: 'event'; event: CalEvent | null; day: Date }
  | { kind: 'newCalendar' }
  | { kind: 'join' }
  | { kind: 'settings'; calendarId: string }
  | null

const HIDDEN_KEY = 'calender-hidden-calendars'

function loadHidden(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(HIDDEN_KEY) ?? '[]') as string[])
  } catch {
    return new Set()
  }
}

function saveHidden(s: Set<string>) {
  try {
    localStorage.setItem(HIDDEN_KEY, JSON.stringify([...s]))
  } catch {
    /* 무시 */
  }
}

const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e))

export function CalendarApp({ store, userLabel, onSignOut }: Props) {
  const [month, setMonth] = useState(() => startOfMonth(new Date()))
  const [calendars, setCalendars] = useState<Calendar[]>([])
  const [events, setEvents] = useState<CalEvent[]>([])
  const [hidden, setHidden] = useState(loadHidden)
  const [version, setVersion] = useState(0)
  const [modal, setModal] = useState<ModalState>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(() => setVersion((v) => v + 1), [])

  useEffect(() => store.subscribe(refresh), [store, refresh])

  useEffect(() => {
    let cancelled = false
    store
      .listCalendars()
      .then((list) => !cancelled && setCalendars(list))
      .catch((e) => !cancelled && setError(errorText(e)))
    return () => {
      cancelled = true
    }
  }, [store, version])

  const visibleIds = calendars.filter((c) => !hidden.has(c.id)).map((c) => c.id)
  const visibleKey = visibleIds.join(',')

  useEffect(() => {
    let cancelled = false
    const from = startOfWeek(startOfMonth(month))
    const to = endOfWeek(endOfMonth(month))
    store
      .listEvents(visibleKey ? visibleKey.split(',') : [], from, to)
      .then((list) => !cancelled && setEvents(list))
      .catch((e) => !cancelled && setError(errorText(e)))
    return () => {
      cancelled = true
    }
  }, [store, month, visibleKey, version])

  const calendarMap = useMemo(() => new Map(calendars.map((c) => [c.id, c])), [calendars])
  const editableCalendars = calendars.filter(canEdit)
  const defaultCalendarId = editableCalendars.find((c) => !hidden.has(c.id))?.id

  const toggleHidden = (id: string) => {
    const next = new Set(hidden)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setHidden(next)
    saveHidden(next)
  }

  const closeModal = useCallback(() => setModal(null), [])
  const settingsCalendar = modal?.kind === 'settings' ? calendarMap.get(modal.calendarId) : undefined

  return (
    <div className="app">
      <aside className={`sidebar ${drawerOpen ? 'open' : ''}`}>
        <div className="brand">🗓️ 우리 캘린더</div>

        <button
          className="btn primary wide"
          disabled={editableCalendars.length === 0}
          onClick={() => {
            setDrawerOpen(false)
            setModal({ kind: 'event', event: null, day: new Date() })
          }}
        >
          + 새 일정
        </button>

        <h3 className="side-title">내 캘린더 목록</h3>
        <ul className="cal-list">
          {calendars.map((c) => (
            <li key={c.id}>
              <label className="cal-item">
                <input
                  type="checkbox"
                  checked={!hidden.has(c.id)}
                  onChange={() => toggleHidden(c.id)}
                  style={{ accentColor: c.color }}
                />
                <span className="cal-name">{c.name}</span>
                {!c.is_personal && c.role !== 'owner' && <span className="badge">공유받음</span>}
              </label>
              <button
                className="icon-btn"
                aria-label={`${c.name} 설정`}
                onClick={() => {
                  setDrawerOpen(false)
                  setModal({ kind: 'settings', calendarId: c.id })
                }}
              >
                ⚙
              </button>
            </li>
          ))}
        </ul>

        <div className="side-actions">
          <button className="btn" onClick={() => setModal({ kind: 'newCalendar' })}>
            + 새 캘린더
          </button>
          <button className="btn" onClick={() => setModal({ kind: 'join' })}>
            초대 코드로 참여
          </button>
        </div>

        <div className="side-footer">
          {store.mode === 'local' && (
            <p className="hint">
              로컬 모드: 이 브라우저에만 저장돼요. Supabase를 연결하면 로그인과 공유가 켜져요.
            </p>
          )}
          <div className="user">
            <span>{userLabel}</span>
            {onSignOut && (
              <button className="link" onClick={onSignOut}>
                로그아웃
              </button>
            )}
          </div>
        </div>
      </aside>
      {drawerOpen && <div className="drawer-backdrop" onClick={() => setDrawerOpen(false)} />}

      <main className="main">
        <header className="toolbar">
          <button className="icon-btn menu-btn" aria-label="메뉴" onClick={() => setDrawerOpen(true)}>
            ☰
          </button>
          <h1>{format(month, 'yyyy년 M월')}</h1>
          <div className="nav">
            <button className="icon-btn" aria-label="이전 달" onClick={() => setMonth((m) => addMonths(m, -1))}>
              ‹
            </button>
            <button className="btn" onClick={() => setMonth(startOfMonth(new Date()))}>
              오늘
            </button>
            <button className="icon-btn" aria-label="다음 달" onClick={() => setMonth((m) => addMonths(m, 1))}>
              ›
            </button>
          </div>
        </header>

        {error && (
          <div className="banner error" onClick={() => setError(null)}>
            {error} <small>(닫기)</small>
          </div>
        )}

        <MonthView
          month={month}
          events={events}
          calendars={calendarMap}
          onDayClick={(day) => setModal({ kind: 'day', day })}
          onEventClick={(ev) => setModal({ kind: 'event', event: ev, day: new Date(ev.start_at) })}
        />
      </main>

      {modal?.kind === 'day' && (
        <DayPanel
          day={modal.day}
          events={events}
          calendars={calendarMap}
          canAdd={editableCalendars.length > 0}
          onAdd={() => setModal({ kind: 'event', event: null, day: modal.day })}
          onOpen={(ev) => setModal({ kind: 'event', event: ev, day: modal.day })}
          onClose={closeModal}
        />
      )}

      {modal?.kind === 'event' && (
        <EventModal
          key={modal.event?.id ?? 'new'}
          event={modal.event}
          day={modal.day}
          calendars={calendars}
          defaultCalendarId={defaultCalendarId}
          onSave={async (input) => {
            if (modal.event) await store.updateEvent(modal.event.id, input)
            else await store.createEvent(input)
            refresh()
          }}
          onDelete={async () => {
            if (modal.event) await store.deleteEvent(modal.event.id)
            refresh()
          }}
          onClose={closeModal}
        />
      )}

      {modal?.kind === 'newCalendar' && (
        <NewCalendarModal
          onCreate={async (name, color) => {
            await store.createCalendar(name, color)
            refresh()
          }}
          onClose={closeModal}
        />
      )}

      {modal?.kind === 'join' && (
        <JoinCalendarModal
          onJoin={async (code) => {
            await store.joinCalendar(code)
            refresh()
          }}
          onClose={closeModal}
        />
      )}

      {settingsCalendar && (
        <CalendarSettings calendar={settingsCalendar} store={store} onChanged={refresh} onClose={closeModal} />
      )}
    </div>
  )
}
