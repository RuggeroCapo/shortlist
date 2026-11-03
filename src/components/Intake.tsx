import { useEffect, useRef, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { type CandidateDoc, type CandidateLabel } from '#/lib/session'
import { saveSession } from '#/lib/store'

type SlotState = { status: 'empty' } | { status: 'reading'; fileName: string } | { status: 'ready'; doc: CandidateDoc } | { status: 'error'; message: string }

async function extract(file: File, label: CandidateLabel): Promise<CandidateDoc> {
  const body = new FormData()
  body.append('file', file)
  const res = await fetch('/api/extract', { method: 'POST', body })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error ?? 'Could not read this file')
  return { label, ...json }
}

async function fetchFile(url: string, name: string, type: string) {
  const blob = await (await fetch(url)).blob()
  return new File([blob], name, { type })
}

export type SampleKind = 'compare' | 'nurse'

export function Intake({ sample }: { sample?: SampleKind }) {
  const navigate = useNavigate()
  const [slots, setSlots] = useState<Record<CandidateLabel, SlotState>>({
    A: { status: 'empty' },
    B: { status: 'empty' },
  })
  const [role, setRole] = useState('')
  const [jd, setJd] = useState('')
  const roleRef = useRef<HTMLInputElement>(null)

  const upload = async (label: CandidateLabel, file: File | undefined) => {
    if (!file) return
    setSlots((s) => ({ ...s, [label]: { status: 'reading', fileName: file.name } }))
    try {
      const doc = await extract(file, label)
      setSlots((s) => ({ ...s, [label]: { status: 'ready', doc } }))
    } catch (e) {
      setSlots((s) => ({ ...s, [label]: { status: 'error', message: (e as Error).message } }))
    }
  }

  const loadSample = async (kind: SampleKind) => {
    setSlots({ A: { status: 'empty' }, B: { status: 'empty' } })
    if (kind === 'nurse') {
      setRole('ICU Charge Nurse, Night Shift')
      setJd('')
      await upload(
        'A',
        await fetchFile(
          '/samples/amara-okafor-icu-nurse.docx',
          'amara-okafor-icu-nurse.docx',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        ),
      )
      return
    }
    setRole('Senior Frontend Engineer, Design Systems')
    const [a, b, job] = await Promise.all([
      fetchFile('/samples/giulia.pdf', 'giulia-marchetti-cv.pdf', 'application/pdf'),
      fetchFile('/samples/tomas.pdf', 'tomas-reyes-cv.pdf', 'application/pdf'),
      fetch('/samples/job.txt').then((r) => r.text()),
    ])
    setJd(job)
    await Promise.all([upload('A', a), upload('B', b)])
  }

  // Sample sets are deep-linkable from the sidebar (/?sample=compare).
  useEffect(() => {
    if (sample) void loadSample(sample)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sample])

  const docs = (['A', 'B'] as const)
    .map((l) => slots[l])
    .filter((s): s is { status: 'ready'; doc: CandidateDoc } => s.status === 'ready')
    .map((s) => s.doc)
  const busy = slots.A.status === 'reading' || slots.B.status === 'reading'
  const canStart = slots.A.status === 'ready' && (role.trim() || jd.trim()) && !busy

  const start = () => {
    if (!canStart) return
    saveSession({ role: role.trim(), jobDescription: jd.trim(), candidates: docs })
    navigate({ to: '/workspace' })
  }

  return (
    <form
      className="panel intake"
      id="start"
      onSubmit={(e) => {
        e.preventDefault()
        start()
      }}
    >
      <div className="panel-head">
        <h2>Candidates and role</h2>
        <span className="panel-meta">{docs.length === 2 ? 'Comparison of two CVs' : 'Add a second CV to compare'}</span>
      </div>

      <div className="slots">
        {(['A', 'B'] as const).map((label) => (
          <Slot
            key={label}
            label={label}
            state={slots[label]}
            disabled={label === 'B' && slots.A.status !== 'ready'}
            onFile={(f) => upload(label, f)}
            onClear={() => setSlots((s) => ({ ...s, [label]: { status: 'empty' } }))}
          />
        ))}
      </div>

      <div className="intake-row">
        <div className="field">
          <label htmlFor="role">Role you are hiring for</label>
          <input
            id="role"
            ref={roleRef}
            value={role}
            onChange={(e) => setRole(e.target.value)}
            placeholder="e.g. ICU Nurse, Night Shift"
            autoComplete="off"
          />
        </div>
      </div>

      <div className="field">
        <label htmlFor="jd">Job description (optional, makes the dashboard sharper)</label>
        <textarea id="jd" value={jd} onChange={(e) => setJd(e.target.value)} rows={7} placeholder="Paste the job ad" />
      </div>

      <div className="intake-actions">
        <span className="panel-meta">
          {busy ? 'Reading files…' : canStart ? 'Ready. The agent streams widgets as AG-UI events.' : 'Add CV A and a role to start.'}
        </span>
        <button type="submit" className="btn" disabled={!canStart}>
          {docs.length === 2 ? 'Compare both CVs' : 'Build the dashboard'}
        </button>
      </div>
    </form>
  )
}

function Slot({
  label,
  state,
  disabled,
  onFile,
  onClear,
}: {
  label: CandidateLabel
  state: SlotState
  disabled: boolean
  onFile: (f: File | undefined) => void
  onClear: () => void
}) {
  const [drag, setDrag] = useState(false)
  const id = `cv-${label}`
  return (
    <div
      className="slot"
      data-drag={drag}
      data-filled={state.status === 'ready'}
      aria-disabled={disabled}
      style={disabled ? { opacity: 0.55, cursor: 'not-allowed' } : undefined}
      onDragOver={(e) => {
        if (disabled) return
        e.preventDefault()
        setDrag(true)
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDrag(false)
        if (!disabled) onFile(e.dataTransfer.files[0])
      }}
    >
      <span className="slot-label">
        <i className={`dot dot-${label.toLowerCase()}`} aria-hidden />
        CV {label}
        {label === 'B' && <span className="slot-meta">· optional</span>}
      </span>
      {state.status === 'empty' && (
        <span className="slot-meta">{disabled ? 'Add CV A first' : 'Drop a PDF, DOCX or TXT, or click to choose'}</span>
      )}
      {state.status === 'reading' && <span className="slot-meta">Reading {state.fileName}…</span>}
      {state.status === 'error' && <span className="error-text">{state.message}</span>}
      {state.status === 'ready' && (
        <>
          <span className="slot-name">{state.doc.name}</span>
          <span className="slot-meta tnum">
            {state.doc.fileName} · {state.doc.pages ? `${state.doc.pages} ${state.doc.pages === 1 ? 'page' : 'pages'} · ` : ''}
            {state.doc.words.toLocaleString()} words
          </span>
        </>
      )}
      {state.status !== 'ready' && !disabled && (
        <input
          id={id}
          type="file"
          accept=".pdf,.docx,.txt,.md,application/pdf"
          aria-label={`Upload CV ${label}`}
          onChange={(e) => onFile(e.target.files?.[0])}
        />
      )}
      {state.status === 'ready' && (
        <button type="button" className="slot-clear" onClick={onClear} aria-label={`Remove CV ${label}`}>
          ×
        </button>
      )}
    </div>
  )
}
