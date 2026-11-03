import type { StreamChunk } from '@tanstack/ai'
import { COMPONENTS } from './dashboard'

/**
 * A readable log of the raw AG-UI event stream, built from `useChat`'s
 * `onChunk`. Consecutive deltas (TOOL_CALL_ARGS for one call, TEXT_MESSAGE_CONTENT
 * for one message) collapse into a single row with a counter, so the log shows
 * the protocol's shape instead of hundreds of one-token lines.
 */
export interface TraceRow {
  seq: number
  type: string
  /** Tool or component this event is about, if any. */
  tool?: string
  component?: string
  toolCallId?: string
  messageId?: string
  /** Number of events folded into this row (deltas). */
  count: number
  /** Characters streamed in the folded deltas. */
  chars: number
  note?: string
  at: number
}

export interface Trace {
  rows: Array<TraceRow>
  totals: Record<string, number>
  /** toolCallId → tool name, from TOOL_CALL_START. */
  calls: Record<string, string>
  seq: number
}

export const EMPTY_TRACE: Trace = { rows: [], totals: {}, calls: {}, seq: 0 }

const MAX_ROWS = 400

export function reduceTrace(t: Trace, chunk: StreamChunk): Trace {
  const c = chunk as any
  const type: string = c.type
  const totals = { ...t.totals, [type]: (t.totals[type] ?? 0) + 1 }
  const calls = type === 'TOOL_CALL_START' && c.toolCallId ? { ...t.calls, [c.toolCallId]: c.toolCallName ?? c.toolName } : t.calls
  const tool = c.toolCallId ? calls[c.toolCallId] : undefined
  const delta = typeof c.delta === 'string' ? c.delta.length : 0

  const last = t.rows[t.rows.length - 1]
  const foldable = type === 'TOOL_CALL_ARGS' || type === 'TEXT_MESSAGE_CONTENT'
  if (
    foldable &&
    last &&
    last.type === type &&
    last.toolCallId === c.toolCallId &&
    last.messageId === c.messageId
  ) {
    const rows = t.rows.slice()
    rows[rows.length - 1] = { ...last, count: last.count + 1, chars: last.chars + delta, at: Date.now() }
    return { ...t, rows, totals, calls }
  }

  let note: string | undefined
  if (type === 'TOOL_CALL_RESULT') {
    const content = String(c.content ?? '')
    note = /error|invalid|fail/i.test(content) ? 'rejected by Zod, model retries' : 'acknowledged'
  } else if (type === 'RUN_ERROR') note = c.message
  else if (type === 'CUSTOM') note = c.name

  const row: TraceRow = {
    seq: t.seq + 1,
    type,
    tool,
    component: tool ? COMPONENTS[tool] : undefined,
    toolCallId: c.toolCallId,
    messageId: c.messageId,
    count: 1,
    chars: delta,
    note,
    at: Date.now(),
  }
  const rows = [...t.rows, row]
  return { rows: rows.length > MAX_ROWS ? rows.slice(-MAX_ROWS) : rows, totals, calls, seq: row.seq }
}
