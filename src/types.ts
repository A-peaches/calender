export type Role = 'owner' | 'editor' | 'viewer'

export interface Calendar {
  id: string
  name: string
  color: string
  owner_id: string
  invite_code: string
  is_personal: boolean
  created_at: string
  /** 현재 사용자의 권한 */
  role: Role
}

export interface Member {
  user_id: string
  role: Role
  display_name: string
}

export interface CalEvent {
  id: string
  calendar_id: string
  title: string
  description: string | null
  location: string | null
  start_at: string
  end_at: string
  all_day: boolean
  created_by: string | null
}

export type EventInput = Omit<CalEvent, 'id' | 'created_by'>

export const ROLE_LABEL: Record<Role, string> = {
  owner: '주인',
  editor: '편집 가능',
  viewer: '보기만',
}

export const CALENDAR_COLORS = [
  '#4f7cff',
  '#ef5b5b',
  '#f59e0b',
  '#22a06b',
  '#14b8a6',
  '#a855f7',
  '#ec4899',
  '#64748b',
]

export const canEdit = (c: Calendar | undefined) => !!c && c.role !== 'viewer'
