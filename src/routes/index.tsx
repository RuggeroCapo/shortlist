import { createFileRoute, Link } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { AppShell } from '#/components/AppShell'
import { Intake, type SampleKind } from '#/components/Intake'
import type { Session } from '#/lib/session'
import { COMPONENTS } from '#/lib/dashboard'
import { loadSession } from '#/lib/store'

export const Route = createFileRoute('/')({
  validateSearch: (s: Record<string, unknown>): { sample?: SampleKind } =>
    s.sample === 'compare' || s.sample === 'nurse' ? { sample: s.sample } : {},
  component: Setup,
})

/** [tool the agent calls, what the mounted component shows] */
const WIDGETS: Array<[string, string]> = [
  ['set_dashboard', 'Role, one-line finding, what the role is judged on'],
  ['show_fit', '0–100 per candidate, with relevant years'],
  ['show_requirements', 'Each requirement scored 0–5 with the CV line behind it'],
  ['show_dimensions', 'Competencies chosen for this job, as a dot plot'],
  ['show_metrics', 'Numbers that matter for the role, read from the CV'],
  ['show_timeline', 'Every position, coloured by relevance'],
  ['show_gaps', 'Severity and how to test each one'],
  ['show_signals', 'Strengths and risks with evidence'],
  ['show_questions', 'Questions and what to listen for'],
  ['show_verdict', 'Recommendation and confidence'],
]

function Setup() {
  const { sample } = Route.useSearch()
  const [last, setLast] = useState<Session | null>(null)
  useEffect(() => setLast(loadSession()), [])

  return (
    <AppShell
      topbar={
        <>
          <div>
            <h1 className="page-title">New analysis</h1>
            <p className="page-sub">
              An agent builds the dashboard by calling typed tools. Each call streams over AG-UI and mounts a React
              component, live.
            </p>
          </div>
          <span className="spacer" />
          <span className="chip">
            <span className="status-dot" data-tier="free" aria-hidden />
            AG-UI over SSE
          </span>
        </>
      }
    >
      <div className="setup-grid">
        <Intake sample={sample} />

        <div className="setup-side">
          {last && (
            <section className="panel">
              <div className="panel-head">
                <h2>Last analysis</h2>
                <span className="panel-meta">This tab</span>
              </div>
              <p className="last-role">{last.role || 'Role from the job description'}</p>
              <ul className="last-cands">
                {last.candidates.map((c) => (
                  <li key={c.label}>
                    <i className={`dot dot-${c.label.toLowerCase()}`} aria-hidden />
                    {c.name}
                    <small>{c.fileName}</small>
                  </li>
                ))}
              </ul>
              <Link to="/workspace" className="btn btn-quiet btn-block">
                Open the dashboard again
              </Link>
            </section>
          )}

          <section className="panel">
            <div className="panel-head">
              <h2>Component registry</h2>
              <span className="panel-meta">{WIDGETS.length} tools → {WIDGETS.length} components</span>
            </div>
            <ul className="catalog">
              {WIDGETS.map(([tool, desc]) => (
                <li key={tool}>
                  <strong>
                    <code>{tool}</code> → <code>&lt;{COMPONENTS[tool]} /&gt;</code>
                  </strong>
                  <span>{desc}</span>
                </li>
              ))}
            </ul>
            <p className="panel-note">
              The agent never sends HTML or a JSON blob. It decides which components to use and with what props; the
              client owns how they look. Follow-ups in plain words add, update or unmount components by id.
            </p>
          </section>

          <section className="panel">
            <div className="panel-head">
              <h2>What happens on the wire</h2>
            </div>
            <ol className="pipeline">
              <li>
                <strong>RunAgentInput</strong>
                <span>The browser posts an AG-UI run with the CV text in forwardedProps. Nothing is stored.</span>
              </li>
              <li>
                <strong>TOOL_CALL_START / ARGS / END</strong>
                <span>Each component the agent chooses streams as tool-call events; props render while still partial.</span>
              </li>
              <li>
                <strong>TOOL_CALL_RESULT</strong>
                <span>The server validates props with Zod. A rejected call goes back to the agent, which fixes it.</span>
              </li>
            </ol>
          </section>
        </div>
      </div>
    </AppShell>
  )
}
