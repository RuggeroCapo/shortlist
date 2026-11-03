import { Link, useRouterState } from '@tanstack/react-router'
import { useEffect, useState, type ReactNode } from 'react'
import { loadSession } from '#/lib/store'

function Icon({ d }: { d: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={d} />
    </svg>
  )
}

const ICONS = {
  plus: 'M12 5v14M5 12h14',
  grid: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  file: 'M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8zM14 3v5h5',
  compare: 'M8 3v18M16 3v18M3 8h5M16 16h5',
}

/**
 * Dashboard chrome shared by the setup screen and the analysis view:
 * a fixed sidebar (navigation, sample sets, protocol summary) and a page area
 * with its own top bar.
 */
export function AppShell({ topbar, children, rail }: { topbar: ReactNode; children: ReactNode; rail?: ReactNode }) {
  const path = useRouterState({ select: (s) => s.location.pathname })
  const [lastRole, setLastRole] = useState<string | null>(null)
  useEffect(() => {
    const s = loadSession()
    if (s) setLastRole(s.role || s.candidates[0]?.name || 'Last analysis')
  }, [])

  return (
    <div className="app" data-rail={rail ? 'true' : 'false'}>
      <aside className="side" aria-label="Navigation">
        <Link to="/" className="brand">
          Shortlist
          <small>an AG-UI generative-UI demo</small>
        </Link>

        <nav className="side-nav">
          <Link to="/" className="side-link" data-active={path === '/'}>
            <Icon d={ICONS.plus} />
            New analysis
          </Link>
          {lastRole ? (
            <Link to="/workspace" className="side-link" data-active={path === '/workspace'}>
              <Icon d={ICONS.grid} />
              <span className="side-link-text">
                Dashboard
                <small>{lastRole}</small>
              </span>
            </Link>
          ) : (
            <span className="side-link" aria-disabled="true">
              <Icon d={ICONS.grid} />
              Dashboard
            </span>
          )}
        </nav>

        <div className="side-group">
          <p className="side-title">Sample sets</p>
          <Link to="/" search={{ sample: 'compare' }} className="side-link">
            <Icon d={ICONS.compare} />
            <span className="side-link-text">
              Two CVs, one role
              <small>Design-systems engineer</small>
            </span>
          </Link>
          <Link to="/" search={{ sample: 'nurse' }} className="side-link">
            <Icon d={ICONS.file} />
            <span className="side-link-text">
              One CV, DOCX
              <small>ICU charge nurse</small>
            </span>
          </Link>
        </div>

        <div className="side-group side-proto">
          <p className="side-title">How the UI is built</p>
          <ol>
            <li>
              <b>Agent calls a tool</b>
              <small>typed with Zod, e.g. show_timeline</small>
            </li>
            <li>
              <b>AG-UI streams it</b>
              <small>TOOL_CALL_START → ARGS → END over SSE</small>
            </li>
            <li>
              <b>Client mounts a component</b>
              <small>the registry maps the tool to React</small>
            </li>
          </ol>
        </div>

        <p className="side-foot">AG-UI protocol · TanStack AI</p>
      </aside>

      <div className="page">
        <header className="topbar">{topbar}</header>
        <div className="page-body">
          <main className="content">{children}</main>
          {rail}
        </div>
      </div>
    </div>
  )
}
