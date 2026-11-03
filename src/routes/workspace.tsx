import { createFileRoute, Link } from '@tanstack/react-router'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useChat, fetchServerSentEvents, type UIMessage } from '@tanstack/ai-react'
import type { CandidateLabel, Session } from '#/lib/session'
import { loadSession } from '#/lib/store'
import { COMPONENTS, deriveDashboard, TOOL_LABELS } from '#/lib/dashboard'
import { EMPTY_TRACE, reduceTrace, type Trace, type TraceRow } from '#/lib/trace'
import { DashboardProvider, WidgetView, type Names } from '#/components/Widgets'
import { AppShell } from '#/components/AppShell'
import { Kpis } from '#/components/Kpis'

export const Route = createFileRoute('/workspace')({
  ssr: false,
  head: () => ({ meta: [{ title: 'Dashboard · Shortlist' }] }),
  component: Workspace,
})

function Workspace() {
  const session = useMemo(loadSession, [])
  if (!session) {
    return (
      <AppShell topbar={<h1 className="page-title">Dashboard</h1>}>
        <div className="empty">
          <strong>No CV loaded in this tab.</strong>
          <Link to="/" className="btn">
            Upload a CV
          </Link>
        </div>
      </AppShell>
    )
  }
  return <Analysis session={session} />
}

function Analysis({ session }: { session: Session }) {
  const threadId = useMemo(() => `cv-${crypto.randomUUID()}`, [])
  const forwardedProps = useMemo(() => ({ session }), [session])
  const two = session.candidates.length > 1
  const [trace, setTrace] = useState<Trace>(EMPTY_TRACE)
  const [tab, setTab] = useState<'components' | 'events'>('components')

  const { messages, sendMessage, isLoading, error, stop } = useChat({
    connection: fetchServerSentEvents('/api/agent'),
    threadId,
    forwardedProps,
    onChunk: (chunk) => setTrace((t) => reduceTrace(t, chunk)),
  })

  // Kick off the first run once. Deferred a tick so a StrictMode mount/unmount
  // cycle (which stops the client and aborts its stream) cancels the timer
  // instead of the request.
  const started = useRef(false)
  useEffect(() => {
    const t = setTimeout(() => {
      if (started.current) return
      started.current = true
      const role = session.role || 'the role in the job description'
      void sendMessage(
        two ? `Compare both CVs for ${role} and build the dashboard.` : `Analyse this CV for ${role} and build the dashboard.`,
      )
    }, 0)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Keep the newest entries in view in the rail.
  const logRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = logRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages, trace.seq, tab])

  const dash = useMemo(() => deriveDashboard(messages as ReadonlyArray<UIMessage>), [messages])
  const labels = session.candidates.map((c) => c.label) as Array<CandidateLabel>
  const names = useMemo(() => {
    const n: Names = {}
    for (const c of session.candidates) n[c.label] = c.name
    const fit = dash.widgets.find((w) => w.kind === 'show_fit')
    for (const c of (fit?.data?.candidates ?? []) as Array<any>) if (c?.candidate && c?.name) n[c.candidate as CandidateLabel] = c.name
    return n
  }, [session, dash.widgets])

  const eventCount = Object.values(trace.totals).reduce((a, b) => a + b, 0)

  const rail = (
    <aside className="rail" aria-label="AG-UI stream">
      <div className="rail-head">
        <h2>AG-UI stream</h2>
        <span className="chip" data-state={isLoading ? 'busy' : 'idle'}>
          <span className="status-dot" data-tier={isLoading ? 'busy' : 'free'} aria-hidden />
          {isLoading ? 'Live' : 'Idle'}
        </span>
      </div>
      <NowDoing busy={isLoading} trace={trace} widgets={dash.widgets.length} events={eventCount} />
      <div className="rail-tabs" role="tablist">
        <button type="button" role="tab" aria-selected={tab === 'components'} onClick={() => setTab('components')}>
          Components <small>{dash.widgets.length + (dash.header ? 1 : 0)}</small>
        </button>
        <button type="button" role="tab" aria-selected={tab === 'events'} onClick={() => setTab('events')}>
          Raw events <small>{eventCount}</small>
        </button>
      </div>
      <div className="rail-log" ref={logRef}>
        {tab === 'components' ? (
          messages.map((m) => <MessageView key={m.id} m={m as UIMessage} />)
        ) : (
          <EventLog trace={trace} />
        )}
        {error && <p className="error-text">Run failed: {error.message}</p>}
      </div>
      <FollowUp busy={isLoading} onStop={stop} two={two} onSend={(t) => void sendMessage(t)} />
    </aside>
  )

  return (
    <DashboardProvider names={names} labels={labels}>
      <AppShell
        rail={rail}
        topbar={
          <>
            <div className="topbar-title">
              <h1 className="page-title">{dash.header?.data.role || session.role || 'Reading the CV'}</h1>
              <div className="ws-cands">
                {session.candidates.map((c) => (
                  <span key={c.label}>
                    <i className={`dot dot-${c.label.toLowerCase()}`} aria-hidden />
                    {names[c.label]}
                  </span>
                ))}
                <span className="page-sub">{two ? 'Comparison' : 'Single CV'}</span>
              </div>
            </div>
            <span className="spacer" />
            <button
              type="button"
              className="btn btn-quiet"
              disabled={isLoading}
              onClick={() => void sendMessage('Rebuild the whole dashboard from scratch with the same ids.')}
            >
              Rebuild
            </button>
          </>
        }
      >
        <Kpis widgets={dash.widgets} labels={labels} names={names} busy={isLoading} events={eventCount} />
        <DashHeader header={dash.header} />
        {dash.widgets.length === 0 && (
          <div className="empty">
            <strong>{isLoading ? 'The agent is reading the CV…' : 'Nothing on the dashboard yet.'}</strong>
            <span>Each tool call the agent makes arrives as AG-UI events and mounts a React component here.</span>
          </div>
        )}
        <div className="dash" aria-live="polite" style={{ gridAutoFlow: 'row dense' }}>
          {dash.widgets.map((w) => (
            <WidgetView key={w.id} w={w} />
          ))}
        </div>
      </AppShell>
    </DashboardProvider>
  )
}

/** One sentence on what the agent is doing right now, read from the last AG-UI event. */
function NowDoing({ busy, trace, widgets, events }: { busy: boolean; trace: Trace; widgets: number; events: number }) {
  const last = trace.rows[trace.rows.length - 1]
  let text: React.ReactNode
  if (!busy) {
    text = events ? (
      <>
        Done. <b>{widgets}</b> components rendered from <b>{events}</b> AG-UI events.
      </>
    ) : (
      'Waiting for the first run.'
    )
  } else if (!last || last.type === 'RUN_STARTED' || last.type === 'CUSTOM') {
    text = 'Run started. The agent is reading the CV and choosing components.'
  } else if (last.type === 'TOOL_CALL_START' || last.type === 'TOOL_CALL_ARGS') {
    text = (
      <>
        Streaming props into <code>&lt;{last.component ?? last.tool} /&gt;</code> via <code>{last.tool}</code>
        {last.chars ? ` · ${last.chars} chars` : ''}
      </>
    )
  } else if (last.type === 'TOOL_CALL_END') {
    text = (
      <>
        <code>&lt;{last.component ?? last.tool} /&gt;</code> complete, waiting for schema validation.
      </>
    )
  } else if (last.type === 'TOOL_CALL_RESULT') {
    text = last.note?.startsWith('rejected') ? (
      <>
        Zod rejected <code>{last.tool}</code>; the model is correcting the call.
      </>
    ) : (
      'Server acknowledged the call. Choosing the next component.'
    )
  } else if (last.type.startsWith('TEXT_MESSAGE')) {
    text = 'Writing a short caption.'
  } else {
    text = <code>{last.type}</code>
  }
  return (
    <p className="now" data-busy={busy}>
      {busy && <i className="pulse" aria-hidden />}
      <span>{text}</span>
    </p>
  )
}

const FAMILY = (type: string) =>
  type.startsWith('TOOL_CALL') ? 'tool' : type.startsWith('TEXT') ? 'text' : type.startsWith('RUN') ? 'run' : 'other'

function EventLog({ trace }: { trace: Trace }) {
  const totals = Object.entries(trace.totals).sort((a, b) => b[1] - a[1])
  return (
    <>
      <div className="ev-totals">
        {totals.map(([type, n]) => (
          <span key={type} className="ev-pill" data-family={FAMILY(type)}>
            {type} <b>{n}</b>
          </span>
        ))}
      </div>
      {trace.rows.length === 0 && <p className="panel-meta">No events yet.</p>}
      <ol className="ev-raw">
        {trace.rows.map((r: TraceRow) => (
          <li key={r.seq} data-family={FAMILY(r.type)}>
            <code className="ev-type">{r.type}</code>
            <span className="ev-detail">
              {r.component && <code>&lt;{r.component} /&gt;</code>}
              {r.count > 1 && ` ×${r.count}`}
              {r.chars > 0 && ` · ${r.chars} chars`}
              {r.note && ` · ${r.note}`}
            </span>
          </li>
        ))}
      </ol>
    </>
  )
}

function summarise(name: string, input: any): string {
  if (!input) return ''
  const n = (k: string, one: string, many: string) => {
    const c = Array.isArray(input[k]) ? input[k].length : 0
    return `${c} ${c === 1 ? one : many}`
  }
  switch (name) {
    case 'show_requirements':
      return n('requirements', 'requirement', 'requirements')
    case 'show_dimensions':
      return n('dimensions', 'dimension', 'dimensions')
    case 'show_timeline':
      return n('entries', 'position', 'positions')
    case 'show_metrics':
      return n('metrics', 'metric', 'metrics')
    case 'show_gaps':
    case 'show_signals':
      return n('items', 'item', 'items')
    case 'show_questions':
      return n('questions', 'question', 'questions')
    case 'remove_widget':
      return input.id ?? ''
    default:
      return ''
  }
}

function MessageView({ m }: { m: UIMessage }) {
  if (m.role === 'user') {
    const text = m.parts.map((p) => (p.type === 'text' ? p.content : '')).join('')
    return <div className="msg-user">{text}</div>
  }
  const failed = new Set(m.parts.filter((p) => p.type === 'tool-result' && p.state === 'error').map((p: any) => p.toolCallId))
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <ul className="ev-list">
        {m.parts.map((p, i) => {
          if (p.type !== 'tool-call') return null
          const streaming = p.state === 'awaiting-input' || p.state === 'input-streaming'
          const state = failed.has(p.id) || p.state === 'error' ? 'error' : streaming ? 'streaming' : 'done'
          const input = (p.input ?? {}) as any
          const target = p.name === 'remove_widget' ? null : typeof input.id === 'string' && input.id ? input.id : p.name.replace('show_', '')
          const verb =
            p.name === 'remove_widget' ? 'unmounted' : p.name === 'set_dashboard' ? 'header' : state === 'error' ? 'rejected' : streaming ? 'streaming props' : 'mounted'
          return (
            <li className="ev" data-state={state} key={p.id ?? i}>
              <i className="ev-ico" aria-hidden />
              <button
                type="button"
                className="ev-main"
                disabled={!target}
                onClick={() => {
                  const el = target ? document.getElementById(`w-${target}`) : null
                  el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                  el?.animate([{ outlineColor: 'var(--accent)' }, { outlineColor: 'transparent' }], { duration: 1200 })
                }}
              >
                <code className="ev-comp">&lt;{COMPONENTS[p.name] ?? p.name} /&gt;</code>
                <span className="ev-sub">
                  {TOOL_LABELS[p.name] ?? p.name}
                  {summarise(p.name, p.input) && ` · ${summarise(p.name, p.input)}`}
                  {' · '}
                  <code>{p.name}</code>
                </span>
              </button>
              <span className="ev-verb">{state === 'error' ? 'Zod rejected · retrying' : verb}</span>
            </li>
          )
        })}
      </ul>
      {m.parts.map((p, i) =>
        p.type === 'text' && p.content.trim() ? (
          <p className="msg-text" key={`t${i}`}>
            {p.content}
          </p>
        ) : null,
      )}
    </div>
  )
}

function FollowUp({
  busy,
  two,
  onSend,
  onStop,
}: {
  busy: boolean
  two: boolean
  onSend: (t: string) => void
  onStop: () => void
}) {
  const [text, setText] = useState('')
  const suggestions = two
    ? ['Who ramps up faster in the first 90 days?', 'Add a widget on leadership evidence', 'Drop the timeline']
    : ['Add a widget on leadership evidence', 'Make the interview plan tougher', 'Drop the timeline']
  const send = (t: string) => {
    if (!t.trim() || busy) return
    onSend(t.trim())
    setText('')
  }
  return (
    <div className="rail-input">
      <div className="suggest">
        {suggestions.map((s) => (
          <button key={s} type="button" className="chip-btn" disabled={busy} onClick={() => send(s)}>
            {s}
          </button>
        ))}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          send(text)
        }}
      >
        <label className="sr-only" htmlFor="followup">
          Ask the agent to change the dashboard
        </label>
        <textarea
          id="followup"
          rows={1}
          value={text}
          placeholder="Change the dashboard…"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              send(text)
            }
          }}
        />
        {busy ? (
          <button type="button" className="btn btn-quiet" onClick={onStop}>
            Stop
          </button>
        ) : (
          <button type="submit" className="btn" disabled={!text.trim()}>
            Send
          </button>
        )}
      </form>
    </div>
  )
}

function DashHeader({ header }: { header: ReturnType<typeof deriveDashboard>['header'] }) {
  if (!header) return null
  const focus = (header.data.focus ?? []) as Array<string>
  return (
    <section className="brief">
      {header.data.summary && <p className="brief-summary">{header.data.summary}</p>}
      {focus.length > 0 && (
        <div className="brief-focus">
          <span className="panel-meta">Judged on</span>
          <ol>
            {focus.map((f, i) => (
              <li key={i}>{f}</li>
            ))}
          </ol>
        </div>
      )}
    </section>
  )
}

