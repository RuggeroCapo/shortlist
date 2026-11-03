import type { DerivedWidget } from '#/lib/dashboard'
import type { CandidateLabel } from '#/lib/session'
import type { Names } from './Widgets'

const arr = (v: unknown): Array<any> => (Array.isArray(v) ? v : [])

/**
 * Headline numbers computed from the widgets the agent has streamed so far:
 * nothing here is asked of the model separately, so the strip can never
 * disagree with the panels below it.
 */
export function Kpis({
  widgets,
  labels,
  names,
  busy,
  events,
}: {
  widgets: Array<DerivedWidget>
  labels: Array<CandidateLabel>
  names: Names
  busy: boolean
  events: number
}) {
  const find = (k: string) => widgets.find((w) => w.kind === k)?.data
  const fit = arr(find('show_fit')?.candidates)
  const reqs = arr(find('show_requirements')?.requirements)
  const gaps = arr(find('show_gaps')?.items)
  const verdict = find('show_verdict')

  const musts = reqs.filter((r) => r?.weight === 'must')
  const mustMet = (l: CandidateLabel) =>
    musts.filter((r) => arr(r.scores).some((s) => s?.candidate === l && Number(s.level) >= 3)).length
  const gapCount = (l: CandidateLabel) => gaps.filter((g) => (g?.candidate ?? 'A') === l).length
  const critical = (l: CandidateLabel) => gaps.filter((g) => (g?.candidate ?? 'A') === l && g?.severity === 'critical').length

  const per = (render: (l: CandidateLabel) => React.ReactNode) =>
    labels.map((l) => (
      <span className="kpi-val" key={l}>
        {labels.length > 1 && <i className={`dot dot-${l.toLowerCase()}`} aria-label={names[l] ?? l} />}
        {render(l)}
      </span>
    ))

  const pick = verdict?.pick as string | undefined
  const pickText =
    pick === 'tie' ? 'Too close' : pick === 'none' ? 'No fit' : pick ? (labels.length > 1 ? (names[pick as CandidateLabel] ?? pick) : 'Advance') : '–'

  return (
    <section className="kpis" aria-label="Key figures">
      <div className="kpi">
        <span className="kpi-label">Fit score</span>
        <div className="kpi-vals">
          {per((l) => {
            const c = fit.find((x) => x?.candidate === l)
            return c?.fitScore != null ? Math.round(c.fitScore) : '–'
          })}
        </div>
        <span className="kpi-note">out of 100</span>
      </div>
      <div className="kpi">
        <span className="kpi-label">Must-haves met</span>
        <div className="kpi-vals">{per((l) => (musts.length ? `${mustMet(l)}/${musts.length}` : '–'))}</div>
        <span className="kpi-note">level 3 of 5 or better</span>
      </div>
      <div className="kpi">
        <span className="kpi-label">Open gaps</span>
        <div className="kpi-vals">{per((l) => (gaps.length ? gapCount(l) : '–'))}</div>
        <span className="kpi-note">
          {gaps.length ? `${labels.map((l) => critical(l)).reduce((a, b) => a + b, 0)} critical` : 'none reported yet'}
        </span>
      </div>
      <div className="kpi">
        <span className="kpi-label">Recommendation</span>
        <div className="kpi-vals">
          <span className="kpi-val kpi-text">{pickText}</span>
        </div>
        <span className="kpi-note">{verdict?.confidence ? `${verdict.confidence} confidence` : 'waiting for verdict'}</span>
      </div>
      <div className="kpi">
        <span className="kpi-label">Generated UI</span>
        <div className="kpi-vals">
          <span className="kpi-val">{widgets.length}</span>
        </div>
        <span className="kpi-note">
          components · {events} AG-UI events{busy ? ' · live' : ''}
        </span>
      </div>
    </section>
  )
}
