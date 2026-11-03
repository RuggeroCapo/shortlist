import type { Session } from './session'

const KEY = 'shortlist.session.v1'

export function saveSession(session: Session) {
  sessionStorage.setItem(KEY, JSON.stringify(session))
}

export function loadSession(): Session | null {
  try {
    const raw = sessionStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as Session) : null
  } catch {
    return null
  }
}
