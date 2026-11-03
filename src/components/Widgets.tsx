import { createContext, useContext, useState, type ReactNode } from 'react'
import type { CandidateLabel } from '#/lib/session'
import { COMPONENTS, LAYOUT, type DerivedWidget } from '#/lib/dashboard'

/* ---------- shared bits ---------- */

export type Names = Partial<Record<CandidateLabel, string>>

const NamesCtx = createContext<{ names: Names; labels: Array<CandidateLabel> }>({ names: {}, labels: ['A'] })

type TipState = { x: number; y: number; content: ReactNode } | null
const TipCtx = createContext<(t: TipState) => void>(() => {})

export function DashboardProvider({
  names,
  labels,
  children,
}: {
  names: Names
  labels: Array<CandidateLabel>
  children: ReactNode
}) {
  const [tip, setTip] = useState<TipState>(null)
  return (
    <NamesCtx.Provider value={{ names, labels }}>
      <TipCtx.Provider value={setTip}>
        {children}
        {tip && (
          <div
            className="tip"
            role="tooltip"
            style={{
              left: Math.min(tip.x + 14, window.innerWidth - 300),
              top: tip.y + 14,
            }}
          >
            {tip.content}
          </div>
        )}
      </TipCtx.Provider>
    </NamesCtx.Provider>
  )
}

/** Hover + focus handlers that show a tooltip with the given content. */
function useTip() {
  const setTip = useContext(TipCtx)
  return (content: ReactNode) => ({
    onMouseMove: (e: React.MouseEvent) => setTip({ x: e.clientX, y: e.clientY, content }),
    onMouseLeave: () => setTip(null),
    onFocus: (e: React.FocusEvent) => {
      const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
      setTip({ x: r.left + 20, y: r.bottom - 6, content })
    },
    onBlur: () => setTip(null),
    tabIndex: 0,
  })
}

const cColor = (c?: string) => (c === 'B' ? 'var(--cand-b)' : 'var(--cand-a)')
const arr = <T,>(v: unknown): Array<T> => (Array.isArray(v) ? (v as Array<T>) : [])
const num = (v: unknown, d = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : d)
const str = (v: unknown) => (typeof v === 'string' ? v : '')

function useNames() {
  return useContext(NamesCtx)
}

function Who({ c }: { c?: string }) {
  const { names } = useNames()
  const label = (c === 'B' ? 'B' : 'A') as CandidateLabel
  return (
    <span className="item-tag">
      <i className={`dot dot-${label.toLowerCase()}`} aria-hidden />
      {names[label] ?? `Candidate ${label}`}
    </span>
  )
}

function Legend() {
  const { names, labels } = useNames()
  if (labels.length < 2) return null
  return (
    <div className="legend" aria-label="Legend">
      {labels.map((l) => (
        <span key={l}>
          <i className={`dot dot-${l.toLowerCase()}`} aria-hidden />
          {names[l] ?? `Candidate ${l}`}
        </span>
      ))}
    </div>
  )
}

function Shell({
  w,
  title,
  className = '',
  legend = true,
  children,
}: {
  w: DerivedWidget
  title: string
  className?: string
  legend?: boolean
  children: ReactNode
}) {
  const span = LAYOUT[w.kind].span
  return (
    <section id={`w-${w.id}`} className={`w w-${span} ${className}`} aria-busy={w.streaming} data-kind={w.kind} data-ui>
      <div className="w-origin" title="Rendered from an AG-UI tool call">
        <code className="w-comp">&lt;{COMPONENTS[w.kind]} /&gt;</code>
        <span>
          ← <code>{w.kind}</code> · id <code>{w.id}</code>
        </span>
        <span className="w-origin-state" data-streaming={w.streaming}>
          {w.streaming ? 'TOOL_CALL_ARGS streaming' : 'TOOL_CALL_END'}
        </span>
      </div>
      <header className="w-head">
        <h2>{title}</h2>
        {w.streaming ? (
          <span className="w-status">
            <i className="pulse" aria-hidden />
            Composing
          </span>
        ) : (
          legend && <Legend />
        )}
      </header>
      {children}
    </section>
  )
}

export function Meter({ c, level }: { c: string; level: number }) {
  const lv = Math.max(0, Math.min(5, Math.round(level)))
  return (
    <span className="meter-wrap">
      <span className="meter" data-c={c} role="img" aria-label={`${lv} of 5`}>
        {[1, 2, 3, 4, 5].map((i) => (
          <i key={i} data-on={i <= lv} />
        ))}
      </span>
      <span className="tnum">{lv}/5</span>
    </span>
  )
}

/* ---------- severity icons: shape + colour + label ---------- */

function SevIcon({ s }: { s: string }) {
  if (s === 'critical')
    return (
      <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
        <circle cx="8" cy="8" r="7" fill="var(--critical)" />
        <path d="M8 4v5M8 11.2v.6" stroke="#0a0a0a" strokeWidth="2" strokeLinecap="round" />
      </svg>
    )
  if (s === 'serious')
    return (
      <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
        <path d="M8 1.5 15 14H1z" fill="var(--serious)" />
        <path d="M8 6v4M8 11.8v.4" stroke="#0a0a0a" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    )
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
      <rect x="3" y="3" width="10" height="10" transform="rotate(45 8 8)" fill="var(--warning)" />
    </svg>
  )
}

const SEV_LABEL: Record<string, string> = { critical: 'Critical', serious: 'Serious', warning: 'Watch' }

function PlusMinus({ kind }: { kind: 'strength' | 'risk' }) {
  return kind === 'strength' ? (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
      <circle cx="8" cy="8" r="7" fill="var(--good)" />
      <path d="M8 4.5v7M4.5 8h7" stroke="#0a0a0a" strokeWidth="2" strokeLinecap="round" />
    </svg>
  ) : (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
      <path d="M8 1.5 15 14H1z" fill="var(--serious)" />
      <path d="M5.5 10h5" stroke="#0a0a0a" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

/* ---------- widgets ---------- */

function Fit({ w }: { w: DerivedWidget }) {
  const cands = arr<any>(w.data.candidates)
  return (
    <Shell w={w} title={str(w.data.title) || 'Overall fit'} legend={false}>
      <div className="fit">
        {cands.map((c, i) => (
          <div key={c.candidate ?? i}>
            <div className="fit-score tnum">
              {c.fitScore != null ? Math.round(num(c.fitScore)) : '–'}
              <small> / 100</small>
            </div>
            <div className="fit-track" aria-hidden>
              <i style={{ width: `${Math.max(0, Math.min(100, num(c.fitScore)))}%`, background: cColor(c.candidate) }} />
            </div>
            <div className="fit-who">
              <i className={`dot dot-${c.candidate === 'B' ? 'b' : 'a'}`} aria-hidden />
              {str(c.name) || `Candidate ${c.candidate ?? ''}`}
            </div>
            <div className="fit-meta">
              {str(c.currentTitle)}
              {c.yearsRelevant != null && ` · ${num(c.yearsRelevant)} relevant years`}
            </div>
            {c.oneLiner && <p className="fit-line">{c.oneLiner}</p>}
          </div>
        ))}
      </div>
    </Shell>
  )
}

const WEIGHT: Record<string, string> = { must: 'Must have', strong: 'Strong plus', nice: 'Nice to have' }

function Requirements({ w }: { w: DerivedWidget }) {
  const { names, labels } = useNames()
  const reqs = arr<any>(w.data.requirements)
  return (
    <Shell w={w} title={str(w.data.title) || 'Requirement evidence'}>
      <table className="rtable">
        <thead>
          <tr>
            <th scope="col">Requirement</th>
            {labels.map((l) => (
              <th scope="col" key={l}>
                {labels.length > 1 ? (names[l] ?? `Candidate ${l}`) : 'Evidence in the CV'}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {reqs.map((r, i) => {
            const scores = arr<any>(r.scores)
            return (
              <tr key={i}>
                <td className="req">
                  <strong>{str(r.requirement)}</strong>
                  <span className="weight" data-weight={r.weight}>
                    {WEIGHT[r.weight] ?? ''}
                  </span>
                </td>
                {labels.map((l) => {
                  const s = scores.find((x) => x?.candidate === l)
                  return (
                    <td key={l}>
                      {s ? (
                        <>
                          <Meter c={l} level={num(s.level)} />
                          <p className="evid">{str(s.evidence)}</p>
                        </>
                      ) : (
                        <span className="evid">…</span>
                      )}
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
    </Shell>
  )
}

function Dimensions({ w }: { w: DerivedWidget }) {
  const { names, labels } = useNames()
  const tip = useTip()
  const dims = arr<any>(w.data.dimensions)
  const pos = (v: number) => `${(Math.max(0, Math.min(10, v)) / 10) * 100}%`
  return (
    <Shell w={w} title={str(w.data.title) || 'Role dimensions'}>
      <div className="dots" role="list">
        {dims.map((d, i) => {
          const scores = arr<any>(d.scores).filter((s) => s && s.score != null)
          const vals = scores.map((s) => num(s.score))
          const lo = Math.min(...vals)
          const hi = Math.max(...vals)
          return (
            <div
              className="dots-row"
              role="listitem"
              key={i}
              {...tip(
                <>
                  <strong>{str(d.name)}</strong>
                  {scores.map((s) => (
                    <div key={s.candidate}>
                      {names[s.candidate as CandidateLabel] ?? s.candidate}: {num(s.score).toFixed(1)} / 10
                    </div>
                  ))}
                </>,
              )}
            >
              <span className="dots-name">{str(d.name)}</span>
              <div className="dots-track" aria-hidden>
                {scores.length > 1 && <i className="dots-span" style={{ left: pos(lo), width: `${((hi - lo) / 10) * 100}%` }} />}
                {scores.map((s) => (
                  <i key={s.candidate} className="dots-mark" style={{ left: pos(num(s.score)), background: cColor(s.candidate) }} />
                ))}
              </div>
              <span className="dots-val tnum">
                {labels
                  .map((l) => scores.find((s) => s.candidate === l))
                  .filter(Boolean)
                  .map((s) => num(s.score).toFixed(1))
                  .join(' · ')}
              </span>
            </div>
          )
        })}
      </div>
      <div className="axis" aria-hidden>
        <span />
        <div>
          <span>0</span>
          <span>5</span>
          <span>10</span>
        </div>
        <span />
      </div>
    </Shell>
  )
}

function Metrics({ w }: { w: DerivedWidget }) {
  const metrics = arr<any>(w.data.metrics)
  return (
    <Shell w={w} title={str(w.data.title) || 'Role metrics'}>
      <div className="metrics">
        {metrics.map((m, i) => (
          <div className="metric" key={i}>
            <span className="metric-label">{str(m.label)}</span>
            <div className="metric-values">
              {arr<any>(m.values).map((v) => (
                <span key={v?.candidate} className="tnum">
                  <i className={`dot dot-${v?.candidate === 'B' ? 'b' : 'a'}`} aria-hidden />
                  {v?.value != null ? num(v.value).toLocaleString() : '–'}
                  {m.unit && <small>{m.unit}</small>}
                </span>
              ))}
            </div>
            {m.note && <span className="metric-note">{m.note}</span>}
          </div>
        ))}
      </div>
    </Shell>
  )
}

function Timeline({ w }: { w: DerivedWidget }) {
  const { names, labels } = useNames()
  const tip = useTip()
  const entries = arr<any>(w.data.entries).filter((e) => e && e.start != null)
  const thisYear = new Date().getFullYear()
  const starts = entries.map((e) => num(e.start, thisYear))
  const ends = entries.map((e) => num(e.end, thisYear))
  const min = Math.min(...starts, thisYear - 1)
  const max = Math.max(...ends, thisYear) + 1
  const span = Math.max(1, max - min)
  const x = (y: number) => ((y - min) / span) * 100
  const ticks: Array<number> = []
  const step = span > 14 ? 4 : span > 8 ? 2 : 1
  for (let y = Math.ceil(min / step) * step; y <= max; y += step) ticks.push(y)

  return (
    <Shell w={w} title={str(w.data.title) || 'Career timeline'}>
      <div className="legend" style={{ marginBottom: 16 }}>
        <span>Relevance to the role:</span>
        <span>
          <i className="dot" style={{ background: 'var(--ink)' }} aria-hidden /> High (solid)
        </span>
        <span>
          <i className="dot" style={{ background: 'color-mix(in srgb, var(--ink) 38%, transparent)' }} aria-hidden /> Medium
          (tint)
        </span>
        <span>
          <i className="dot" style={{ boxShadow: 'inset 0 0 0 1px #6a6a6a' }} aria-hidden /> Low (outline)
        </span>
      </div>
      <div className="tl">
        {labels.map((l) => {
          const mine = entries
            .filter((e) => (e.candidate ?? 'A') === l)
            .sort((a, b) => num(a.start) - num(b.start))
          const rowEnds: Array<number> = []
          const placed = mine.map((e) => {
            const s = num(e.start, thisYear)
            const en = Math.max(num(e.end, thisYear), s + 0.6)
            let row = rowEnds.findIndex((end) => end <= s)
            if (row === -1) {
              row = rowEnds.length
              rowEnds.push(en)
            } else rowEnds[row] = en
            return { e, s, en, row }
          })
          return (
            <div className="tl-lane" key={l}>
              <span className="tl-who">
                <i className={`dot dot-${l.toLowerCase()}`} aria-hidden />
                {names[l] ?? `Candidate ${l}`}
              </span>
              <div className="tl-rows" style={{ height: Math.max(1, rowEnds.length) * 36 }}>
                {placed.map(({ e, s, en, row }, i) => (
                  <div
                    key={i}
                    className="tl-bar"
                    data-rel={e.relevance}
                    style={{
                      left: `${x(s)}%`,
                      width: `calc(${x(en) - x(s)}% - 2px)`,
                      top: row * 36,
                      background:
                        e.relevance === 'high'
                          ? cColor(l)
                          : `color-mix(in srgb, ${cColor(l)} 38%, transparent)`,
                    }}
                    {...tip(
                      <>
                        <strong>
                          {str(e.role)} · {str(e.org)}
                        </strong>
                        <div>
                          {num(e.start)}–{num(e.end) >= thisYear ? 'now' : num(e.end)} · {str(e.relevance)} relevance
                        </div>
                        {e.note && <div style={{ marginTop: 4 }}>{e.note}</div>}
                      </>,
                    )}
                  >
                    {str(e.role)}
                  </div>
                ))}
              </div>
            </div>
          )
        })}
        <div className="tl-axis" aria-hidden>
          <span />
          <div>
            {ticks.map((t) => (
              <span key={t} style={{ left: `${x(t)}%` }} className="tnum">
                {t}
              </span>
            ))}
          </div>
        </div>
      </div>
    </Shell>
  )
}

function Gaps({ w }: { w: DerivedWidget }) {
  const { labels } = useNames()
  const items = arr<any>(w.data.items)
  const order = { critical: 0, serious: 1, warning: 2 } as Record<string, number>
  const sorted = [...items].sort((a, b) => (order[a?.severity] ?? 3) - (order[b?.severity] ?? 3))
  return (
    <Shell w={w} title={str(w.data.title) || 'Gaps to close'} legend={false}>
      <ul className="items">
        {sorted.map((g, i) => (
          <li className="item" key={i}>
            <SevIcon s={g?.severity} />
            <div>
              <div>
                <span className="sev">{SEV_LABEL[g?.severity] ?? ''}</span>
                {labels.length > 1 && (
                  <>
                    {' · '}
                    <Who c={g?.candidate} />
                  </>
                )}
              </div>
              <div className="item-title">{str(g?.gap)}</div>
              {g?.mitigation && <div className="item-sub">{g.mitigation}</div>}
            </div>
          </li>
        ))}
      </ul>
    </Shell>
  )
}

function Signals({ w }: { w: DerivedWidget }) {
  const { labels } = useNames()
  const items = arr<any>(w.data.items)
  const col = (kind: 'strength' | 'risk') => (
    <div>
      <h3>
        <PlusMinus kind={kind} />
        {kind === 'strength' ? 'Strengths' : 'Risks'}
      </h3>
      <ul className="items">
        {items
          .filter((s) => s?.kind === kind)
          .map((s, i) => (
            <li className="item" key={i} style={{ gridTemplateColumns: '1fr' }}>
              <div>
                {labels.length > 1 && <Who c={s.candidate} />}
                <div className="item-title">{str(s.point)}</div>
                {s.evidence && <div className="item-sub">{s.evidence}</div>}
              </div>
            </li>
          ))}
      </ul>
    </div>
  )
  return (
    <Shell w={w} title={str(w.data.title) || 'Strengths and risks'}>
      <div className="signals">
        {col('strength')}
        {col('risk')}
      </div>
    </Shell>
  )
}

function Questions({ w }: { w: DerivedWidget }) {
  const { labels, names } = useNames()
  const qs = arr<any>(w.data.questions)
  return (
    <Shell w={w} title={str(w.data.title) || 'Interview plan'} legend={false}>
      <ol className="qlist">
        {qs.map((q, i) => (
          <li key={i}>
            {labels.length > 1 && (
              <span className="item-tag">
                {q?.candidate === 'both' ? 'Both candidates' : (names[q?.candidate as CandidateLabel] ?? q?.candidate)}
              </span>
            )}
            <div className="q">{str(q?.question)}</div>
            {q?.listenFor && <div className="item-sub">Listen for: {q.listenFor}</div>}
          </li>
        ))}
      </ol>
    </Shell>
  )
}

function Verdict({ w }: { w: DerivedWidget }) {
  const { names, labels } = useNames()
  const pick = w.data.pick as string | undefined
  const pickText =
    pick === 'tie'
      ? 'Too close to call'
      : pick === 'none'
        ? 'No candidate fits'
        : pick
          ? labels.length > 1
            ? `Prefer ${names[pick as CandidateLabel] ?? pick}`
            : 'Advance'
          : ''
  return (
    <Shell w={w} title="Verdict" className="w-verdict" legend={false}>
      <p className="verdict-headline">{str(w.data.headline)}</p>
      <div className="verdict-meta">
        {pickText && <strong>{pickText}</strong>}
        {w.data.confidence && <span className="muted">Confidence: {w.data.confidence}</span>}
      </div>
      <ul className="verdict-reasons">
        {arr<string>(w.data.reasons).map((r, i) => (
          <li key={i}>{r}</li>
        ))}
      </ul>
    </Shell>
  )
}

export function WidgetView({ w }: { w: DerivedWidget }) {
  switch (w.kind) {
    case 'show_fit':
      return <Fit w={w} />
    case 'show_requirements':
      return <Requirements w={w} />
    case 'show_dimensions':
      return <Dimensions w={w} />
    case 'show_metrics':
      return <Metrics w={w} />
    case 'show_timeline':
      return <Timeline w={w} />
    case 'show_gaps':
      return <Gaps w={w} />
    case 'show_signals':
      return <Signals w={w} />
    case 'show_questions':
      return <Questions w={w} />
    case 'show_verdict':
      return <Verdict w={w} />
  }
}
