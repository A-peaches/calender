import type { SupabaseClient } from '@supabase/supabase-js'
import type { CalEvent, Calendar, EventInput, Member, Role } from '../types'

/** UI가 사용하는 데이터 계층. Supabase 구현과 로컬(브라우저 저장소) 구현이 있다. */
export interface Store {
  readonly mode: 'supabase' | 'local'
  readonly userId: string
  listCalendars(): Promise<Calendar[]>
  createCalendar(name: string, color: string): Promise<void>
  updateCalendar(id: string, patch: { name?: string; color?: string }): Promise<void>
  deleteCalendar(id: string): Promise<void>
  leaveCalendar(id: string): Promise<void>
  joinCalendar(code: string): Promise<void>
  regenerateInviteCode(id: string): Promise<void>
  listMembers(calendarId: string): Promise<Member[]>
  setMemberRole(calendarId: string, userId: string, role: Role): Promise<void>
  removeMember(calendarId: string, userId: string): Promise<void>
  listEvents(calendarIds: string[], from: Date, to: Date): Promise<CalEvent[]>
  createEvent(input: EventInput): Promise<void>
  updateEvent(id: string, input: EventInput): Promise<void>
  deleteEvent(id: string): Promise<void>
  /** 데이터가 바뀌면 onChange 호출. 해제 함수를 반환한다. */
  subscribe(onChange: () => void): () => void
}

const sortCalendars = (list: Calendar[]) =>
  [...list].sort(
    (a, b) =>
      Number(b.is_personal) - Number(a.is_personal) || a.created_at.localeCompare(b.created_at),
  )

// ---------------------------------------------------------------------------
// Supabase
// ---------------------------------------------------------------------------

type Result<T> = { data: T; error: { message: string } | null }

function check<T>(r: Result<T>): T {
  if (r.error) throw new Error(r.error.message)
  return r.data
}

export function createSupabaseStore(sb: SupabaseClient, userId: string): Store {
  return {
    mode: 'supabase',
    userId,

    async listCalendars() {
      const rows = check(
        await sb.from('calendar_members').select('role, calendar:calendars(*)').eq('user_id', userId),
      ) as unknown as { role: Role; calendar: Omit<Calendar, 'role'> | null }[]
      return sortCalendars(
        rows.filter((r) => r.calendar).map((r) => ({ ...r.calendar!, role: r.role })),
      )
    },

    async createCalendar(name, color) {
      check(await sb.from('calendars').insert({ name, color }))
    },

    async updateCalendar(id, patch) {
      check(await sb.from('calendars').update(patch).eq('id', id))
    },

    async deleteCalendar(id) {
      check(await sb.from('calendars').delete().eq('id', id))
    },

    async leaveCalendar(id) {
      check(await sb.from('calendar_members').delete().eq('calendar_id', id).eq('user_id', userId))
    },

    async joinCalendar(code) {
      check(await sb.rpc('join_calendar', { code }))
    },

    async regenerateInviteCode(id) {
      check(await sb.rpc('regenerate_invite_code', { cal: id }))
    },

    async listMembers(calendarId) {
      const rows = check(
        await sb
          .from('calendar_members')
          .select('user_id, role, profile:profiles(display_name)')
          .eq('calendar_id', calendarId)
          .order('joined_at'),
      ) as unknown as { user_id: string; role: Role; profile: { display_name: string } | null }[]
      return rows.map((r) => ({
        user_id: r.user_id,
        role: r.role,
        display_name: r.profile?.display_name || '(이름 없음)',
      }))
    },

    async setMemberRole(calendarId, uid, role) {
      check(
        await sb
          .from('calendar_members')
          .update({ role })
          .eq('calendar_id', calendarId)
          .eq('user_id', uid),
      )
    },

    async removeMember(calendarId, uid) {
      check(
        await sb.from('calendar_members').delete().eq('calendar_id', calendarId).eq('user_id', uid),
      )
    },

    async listEvents(calendarIds, from, to) {
      if (calendarIds.length === 0) return []
      return check(
        await sb
          .from('events')
          .select('id, calendar_id, title, description, location, start_at, end_at, all_day, created_by')
          .in('calendar_id', calendarIds)
          .lte('start_at', to.toISOString())
          .gte('end_at', from.toISOString())
          .order('start_at'),
      ) as CalEvent[]
    },

    async createEvent(input) {
      check(await sb.from('events').insert(input))
    },

    async updateEvent(id, input) {
      check(await sb.from('events').update(input).eq('id', id))
    },

    async deleteEvent(id) {
      check(await sb.from('events').delete().eq('id', id))
    },

    subscribe(onChange) {
      const channel = sb.channel(`calendar-sync-${crypto.randomUUID()}`)
      for (const table of ['events', 'calendars', 'calendar_members']) {
        channel.on('postgres_changes', { event: '*', schema: 'public', table }, () => onChange())
      }
      channel.subscribe()
      return () => {
        void sb.removeChannel(channel)
      }
    },
  }
}

// ---------------------------------------------------------------------------
// 로컬 (Supabase 설정 전 체험용, 이 브라우저에만 저장됨)
// ---------------------------------------------------------------------------

const LOCAL_KEY = 'calender-local-v1'
const LOCAL_USER = 'local-user'

interface LocalData {
  calendars: Calendar[]
  events: CalEvent[]
}

function seed(): LocalData {
  return {
    calendars: [
      {
        id: crypto.randomUUID(),
        name: '내 캘린더',
        color: '#4f7cff',
        owner_id: LOCAL_USER,
        invite_code: '',
        is_personal: true,
        created_at: new Date().toISOString(),
        role: 'owner',
      },
    ],
    events: [],
  }
}

export function createLocalStore(): Store {
  let memory: LocalData | null = null
  const listeners = new Set<() => void>()

  const read = (): LocalData => {
    try {
      const raw = localStorage.getItem(LOCAL_KEY)
      if (raw) return JSON.parse(raw) as LocalData
    } catch {
      /* 저장소 사용 불가 → 메모리 사용 */
    }
    memory ??= seed()
    return memory
  }

  const write = (data: LocalData) => {
    memory = data
    try {
      localStorage.setItem(LOCAL_KEY, JSON.stringify(data))
    } catch {
      /* 무시 */
    }
    listeners.forEach((fn) => fn())
  }

  const unsupported = async () => {
    throw new Error('공유 기능은 Supabase를 연결한 뒤에 사용할 수 있어요.')
  }

  return {
    mode: 'local',
    userId: LOCAL_USER,

    async listCalendars() {
      const data = read()
      if (!localStorage.getItem(LOCAL_KEY)) write(data)
      return sortCalendars(data.calendars)
    },

    async createCalendar(name, color) {
      const data = read()
      data.calendars.push({
        id: crypto.randomUUID(),
        name,
        color,
        owner_id: LOCAL_USER,
        invite_code: '',
        is_personal: false,
        created_at: new Date().toISOString(),
        role: 'owner',
      })
      write(data)
    },

    async updateCalendar(id, patch) {
      const data = read()
      data.calendars = data.calendars.map((c) => (c.id === id ? { ...c, ...patch } : c))
      write(data)
    },

    async deleteCalendar(id) {
      const data = read()
      data.calendars = data.calendars.filter((c) => c.id !== id)
      data.events = data.events.filter((e) => e.calendar_id !== id)
      write(data)
    },

    leaveCalendar: unsupported,
    joinCalendar: unsupported,
    regenerateInviteCode: unsupported,
    setMemberRole: unsupported,
    removeMember: unsupported,

    async listMembers() {
      return [{ user_id: LOCAL_USER, role: 'owner', display_name: '나' }]
    },

    async listEvents(calendarIds, from, to) {
      const ids = new Set(calendarIds)
      return read()
        .events.filter(
          (e) =>
            ids.has(e.calendar_id) &&
            new Date(e.start_at) <= to &&
            new Date(e.end_at) >= from,
        )
        .sort((a, b) => a.start_at.localeCompare(b.start_at))
    },

    async createEvent(input) {
      const data = read()
      data.events.push({ ...input, id: crypto.randomUUID(), created_by: LOCAL_USER })
      write(data)
    },

    async updateEvent(id, input) {
      const data = read()
      data.events = data.events.map((e) => (e.id === id ? { ...e, ...input } : e))
      write(data)
    },

    async deleteEvent(id) {
      const data = read()
      data.events = data.events.filter((e) => e.id !== id)
      write(data)
    },

    subscribe(onChange) {
      listeners.add(onChange)
      const onStorage = (e: StorageEvent) => {
        if (e.key === LOCAL_KEY) onChange()
      }
      window.addEventListener('storage', onStorage)
      return () => {
        listeners.delete(onChange)
        window.removeEventListener('storage', onStorage)
      }
    },
  }
}
