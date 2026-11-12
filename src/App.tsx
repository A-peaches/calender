import type { Session, SupabaseClient } from '@supabase/supabase-js'
import { useEffect, useMemo, useState } from 'react'
import { AuthScreen } from './components/AuthScreen'
import { CalendarApp } from './components/CalendarApp'
import { createLocalStore, createSupabaseStore } from './lib/store'
import { supabase } from './lib/supabase'

const localStore = createLocalStore()

export default function App() {
  if (!supabase) return <CalendarApp store={localStore} userLabel="나 (로컬 모드)" />
  return <SupabaseGate client={supabase} />
}

function SupabaseGate({ client }: { client: SupabaseClient }) {
  // undefined = 세션 확인 중
  const [session, setSession] = useState<Session | null | undefined>(undefined)

  useEffect(() => {
    client.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = client.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [client])

  const userId = session?.user.id
  const store = useMemo(() => (userId ? createSupabaseStore(client, userId) : null), [client, userId])

  if (session === undefined) return <div className="loading">불러오는 중…</div>
  if (!session || !store) return <AuthScreen client={client} />

  return (
    <CalendarApp
      store={store}
      userLabel={(session.user.user_metadata.display_name as string | undefined) || session.user.email || ''}
      onSignOut={() => void client.auth.signOut()}
    />
  )
}
