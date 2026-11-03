import { parsePartialJSON } from '@tanstack/ai-react'
import type { UIMessage } from '@tanstack/ai-react'
import { WIDGET_KINDS, type DashboardHeader, type WidgetKind } from './widgets'

export interface DerivedWidget {
  id: string
  kind: WidgetKind
  // Partial while streaming: every renderer must tolerate missing fields.
  data: any
  streaming: boolean
}

export interface DerivedDashboard {
  header: { data: Partial<DashboardHeader>; streaming: boolean } | null
  widgets: Array<DerivedWidget>
}

/** Layout order and column span per widget kind (the agent decides content, not position). */
export const LAYOUT: Record<WidgetKind, { rank: number; span: 5 | 6 | 7 | 12 }> = {
  show_fit: { rank: 0, span: 7 },
  show_verdict: { rank: 1, span: 5 },
  show_requirements: { rank: 2, span: 12 },
  show_dimensions: { rank: 3, span: 7 },
  show_metrics: { rank: 4, span: 5 },
  show_timeline: { rank: 5, span: 12 },
  show_signals: { rank: 6, span: 12 },
  show_gaps: { rank: 7, span: 6 },
  show_questions: { rank: 8, span: 6 },
}

function parseArgs(raw: string): any {
  if (!raw) return null
  try {
    return parsePartialJSON(raw)
  } catch {
    return null
  }
}

const isKind = (name: string): name is WidgetKind => (WIDGET_KINDS as ReadonlyArray<string>).includes(name)

/**
 * Folds the AG-UI tool-call stream (as TanStack AI UIMessage parts) into a
 * dashboard. Calls are applied in order: show_* upserts by id, remove_widget
 * deletes, set_dashboard sets the header. Calls that failed schema validation
 * on the server are ignored; the model's corrected retry wins.
 */
export function deriveDashboard(messages: ReadonlyArray<UIMessage>): DerivedDashboard {
  const failed = new Set<string>()
  for (const m of messages)
    for (const p of m.parts) if (p.type === 'tool-result' && p.state === 'error') failed.add(p.toolCallId)

  let header: DerivedDashboard['header'] = null
  const byId = new Map<string, DerivedWidget & { seq: number }>()
  let seq = 0

  for (const m of messages) {
    if (m.role !== 'assistant') continue
    for (const p of m.parts) {
      if (p.type !== 'tool-call' || failed.has(p.id) || p.state === 'error') continue
      const data = (p.input as any) ?? parseArgs(p.arguments)
      if (!data || typeof data !== 'object') continue
      const streaming = p.state === 'awaiting-input' || p.state === 'input-streaming'

      if (p.name === 'set_dashboard') {
        header = { data, streaming }
      } else if (p.name === 'remove_widget') {
        if (!streaming && typeof data.id === 'string') byId.delete(data.id)
      } else if (isKind(p.name)) {
        const id = typeof data.id === 'string' && data.id ? data.id : p.name.replace('show_', '')
        const prev = byId.get(id)
        byId.set(id, { id, kind: p.name, data, streaming, seq: prev?.seq ?? seq++ })
      }
    }
  }

  const widgets = [...byId.values()].sort(
    (a, b) => LAYOUT[a.kind].rank - LAYOUT[b.kind].rank || a.seq - b.seq,
  )
  return { header, widgets }
}

export const TOOL_LABELS: Record<string, string> = {
  set_dashboard: 'Framing the role',
  show_fit: 'Fit scores',
  show_requirements: 'Requirement evidence',
  show_dimensions: 'Role dimensions',
  show_timeline: 'Career timeline',
  show_metrics: 'Role metrics',
  show_gaps: 'Gaps',
  show_signals: 'Strengths and risks',
  show_questions: 'Interview plan',
  show_verdict: 'Verdict',
  remove_widget: 'Removed a widget',
}

/**
 * The client-side component registry: which React component renders each
 * AG-UI tool call. The agent only knows tool names and schemas; this map is
 * the whole contract between "what the model decided" and "what the user sees".
 */
export const COMPONENTS: Record<string, string> = {
  set_dashboard: 'RoleBrief',
  show_fit: 'FitScore',
  show_requirements: 'RequirementMatrix',
  show_dimensions: 'DimensionPlot',
  show_metrics: 'MetricCards',
  show_timeline: 'CareerTimeline',
  show_gaps: 'GapList',
  show_signals: 'SignalBoard',
  show_questions: 'InterviewPlan',
  show_verdict: 'Verdict',
  remove_widget: 'unmount',
}
