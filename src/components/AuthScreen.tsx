import type { SupabaseClient } from '@supabase/supabase-js'
import { useState, type FormEvent } from 'react'

export function AuthScreen({ client }: { client: SupabaseClient }) {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setMessage(null)
    try {
      if (mode === 'signin') {
        const { error } = await client.auth.signInWithPassword({ email, password })
        if (error) throw error
      } else {
        const { data, error } = await client.auth.signUp({
          email,
          password,
          options: { data: { display_name: name.trim() } },
        })
        if (error) throw error
        if (!data.session) setMessage('가입 확인 메일을 보냈어요. 메일의 링크를 누른 뒤 로그인해 주세요.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth">
      <form className="auth-card form" onSubmit={submit}>
        <h1>🗓️ 우리 캘린더</h1>
        <div className="tabs">
          <button type="button" className={mode === 'signin' ? 'active' : ''} onClick={() => setMode('signin')}>
            로그인
          </button>
          <button type="button" className={mode === 'signup' ? 'active' : ''} onClick={() => setMode('signup')}>
            회원가입
          </button>
        </div>
        {mode === 'signup' && (
          <label className="field">
            <span>이름 (다른 멤버에게 보여요)</span>
            <input value={name} onChange={(e) => setName(e.target.value)} required maxLength={30} />
          </label>
        )}
        <label className="field">
          <span>이메일</span>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
        </label>
        <label className="field">
          <span>비밀번호</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
          />
        </label>
        <button className="btn primary" disabled={busy}>
          {mode === 'signin' ? '로그인' : '가입하기'}
        </button>
        {message && <p className="hint">{message}</p>}
        {error && <p className="error">{error}</p>}
      </form>
    </div>
  )
}
