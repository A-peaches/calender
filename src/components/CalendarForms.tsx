import { useState, type FormEvent } from 'react'
import { CALENDAR_COLORS } from '../types'
import { Modal } from './Modal'

export function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div className="colors">
      {CALENDAR_COLORS.map((c) => (
        <button
          key={c}
          type="button"
          className={`swatch ${c === value ? 'selected' : ''}`}
          style={{ background: c }}
          onClick={() => onChange(c)}
          aria-label={`색상 ${c}`}
        />
      ))}
    </div>
  )
}

function useSubmit(action: () => Promise<void>, onClose: () => void) {
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await action()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setBusy(false)
    }
  }
  return { error, busy, submit }
}

export function NewCalendarModal({
  onCreate,
  onClose,
}: {
  onCreate: (name: string, color: string) => Promise<void>
  onClose: () => void
}) {
  const [name, setName] = useState('')
  const [color, setColor] = useState(CALENDAR_COLORS[1])
  const { error, busy, submit } = useSubmit(() => onCreate(name.trim(), color), onClose)

  return (
    <Modal
      title="새 캘린더"
      onClose={onClose}
      footer={
        <button className="btn primary" type="submit" form="new-cal" disabled={busy || !name.trim()}>
          만들기
        </button>
      }
    >
      <form id="new-cal" className="form" onSubmit={submit}>
        <label className="field">
          <span>이름</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="예: 우리 가족, 커플 캘린더"
            maxLength={50}
            autoFocus
          />
        </label>
        <div className="field">
          <span>색상</span>
          <ColorPicker value={color} onChange={setColor} />
        </div>
        <p className="hint">만든 뒤 ⚙ 설정에서 초대 코드를 친구에게 보내면 함께 쓸 수 있어요.</p>
        {error && <p className="error">{error}</p>}
      </form>
    </Modal>
  )
}

export function JoinCalendarModal({
  onJoin,
  onClose,
}: {
  onJoin: (code: string) => Promise<void>
  onClose: () => void
}) {
  const [code, setCode] = useState('')
  const { error, busy, submit } = useSubmit(() => onJoin(code.trim()), onClose)

  return (
    <Modal
      title="초대 코드로 참여"
      onClose={onClose}
      footer={
        <button className="btn primary" type="submit" form="join-cal" disabled={busy || !code.trim()}>
          참여하기
        </button>
      }
    >
      <form id="join-cal" className="form" onSubmit={submit}>
        <label className="field">
          <span>초대 코드</span>
          <input
            className="code-input"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="8자리 코드"
            maxLength={8}
            autoFocus
          />
        </label>
        {error && <p className="error">{error}</p>}
      </form>
    </Modal>
  )
}
