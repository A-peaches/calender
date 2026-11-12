import { useEffect, useState } from 'react'
import type { Store } from '../lib/store'
import { ROLE_LABEL, type Calendar, type Member, type Role } from '../types'
import { ColorPicker } from './CalendarForms'
import { Modal } from './Modal'

interface Props {
  calendar: Calendar
  store: Store
  /** 변경 후 상위에서 데이터를 다시 불러오도록 */
  onChanged: () => void
  onClose: () => void
}

export function CalendarSettings({ calendar, store, onChanged, onClose }: Props) {
  const isOwner = calendar.role === 'owner'
  const shareable = store.mode === 'supabase' && !calendar.is_personal
  const [name, setName] = useState(calendar.name)
  const [color, setColor] = useState(calendar.color)
  const [members, setMembers] = useState<Member[]>([])
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [reload, setReload] = useState(0)

  useEffect(() => {
    if (!shareable) return
    let cancelled = false
    store
      .listMembers(calendar.id)
      .then((m) => !cancelled && setMembers(m))
      .catch((e) => !cancelled && setError(String(e.message ?? e)))
    return () => {
      cancelled = true
    }
  }, [store, calendar.id, shareable, reload])

  const run = async (fn: () => Promise<void>, close = false) => {
    setError(null)
    try {
      await fn()
      onChanged()
      setReload((r) => r + 1)
      if (close) onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(calendar.invite_code)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      setError('복사하지 못했어요. 코드를 직접 선택해서 복사해 주세요.')
    }
  }

  const dirty = name.trim() !== calendar.name || color !== calendar.color

  return (
    <Modal title="캘린더 설정" onClose={onClose}>
      <div className="form">
        <label className="field">
          <span>이름</span>
          <input value={name} onChange={(e) => setName(e.target.value)} disabled={!isOwner} maxLength={50} />
        </label>
        {isOwner && (
          <>
            <div className="field">
              <span>색상</span>
              <ColorPicker value={color} onChange={setColor} />
            </div>
            <button
              className="btn primary"
              disabled={!dirty || !name.trim()}
              onClick={() => run(() => store.updateCalendar(calendar.id, { name: name.trim(), color }))}
            >
              변경 저장
            </button>
          </>
        )}

        {calendar.is_personal && <p className="hint">개인 캘린더는 나만 볼 수 있어요.</p>}
        {store.mode === 'local' && !calendar.is_personal && (
          <p className="hint">공유는 Supabase를 연결한 뒤에 사용할 수 있어요.</p>
        )}

        {shareable && (
          <>
            {calendar.role !== 'viewer' && (
              <section className="section">
                <h3>초대 코드</h3>
                <div className="invite">
                  <code>{calendar.invite_code}</code>
                  <button className="btn" onClick={copyCode}>
                    {copied ? '복사됨!' : '복사'}
                  </button>
                  {isOwner && (
                    <button
                      className="btn"
                      onClick={() =>
                        window.confirm('새 코드를 만들면 기존 코드는 더 이상 쓸 수 없어요. 바꿀까요?') &&
                        run(() => store.regenerateInviteCode(calendar.id))
                      }
                    >
                      새 코드
                    </button>
                  )}
                </div>
                <p className="hint">이 코드를 받은 사람은 '초대 코드로 참여'에서 입력하면 함께 쓸 수 있어요.</p>
              </section>
            )}

            <section className="section">
              <h3>멤버 {members.length}명</h3>
              <ul className="members">
                {members.map((m) => (
                  <li key={m.user_id}>
                    <span className="member-name">
                      {m.display_name}
                      {m.user_id === store.userId && <small> (나)</small>}
                    </span>
                    {isOwner && m.role !== 'owner' ? (
                      <>
                        <select
                          value={m.role}
                          onChange={(e) =>
                            run(() => store.setMemberRole(calendar.id, m.user_id, e.target.value as Role))
                          }
                        >
                          <option value="editor">{ROLE_LABEL.editor}</option>
                          <option value="viewer">{ROLE_LABEL.viewer}</option>
                        </select>
                        <button
                          className="icon-btn"
                          aria-label="내보내기"
                          title="내보내기"
                          onClick={() =>
                            window.confirm(`${m.display_name}님을 내보낼까요?`) &&
                            run(() => store.removeMember(calendar.id, m.user_id))
                          }
                        >
                          ✕
                        </button>
                      </>
                    ) : (
                      <span className="role">{ROLE_LABEL[m.role]}</span>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          </>
        )}

        {error && <p className="error">{error}</p>}

        {!calendar.is_personal && (
          <section className="section danger-zone">
            {isOwner ? (
              <button
                className="btn danger"
                onClick={() =>
                  window.confirm(`'${calendar.name}' 캘린더와 모든 일정을 삭제할까요? 멤버 모두에게서 사라져요.`) &&
                  run(() => store.deleteCalendar(calendar.id), true)
                }
              >
                캘린더 삭제
              </button>
            ) : (
              <button
                className="btn danger"
                onClick={() =>
                  window.confirm(`'${calendar.name}' 캘린더에서 나갈까요?`) &&
                  run(() => store.leaveCalendar(calendar.id), true)
                }
              >
                캘린더에서 나가기
              </button>
            )}
          </section>
        )}
      </div>
    </Modal>
  )
}
