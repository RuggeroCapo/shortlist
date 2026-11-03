/**
 * Generative-dashboard contract, shared by server and client.
 *
 * The agent never returns a dashboard as one JSON blob. It *composes* one by
 * calling these tools; every call streams to the browser as AG-UI
 * TOOL_CALL_START → TOOL_CALL_ARGS* → TOOL_CALL_END events, and the client
 * renders the widget from the (partial) arguments while they stream in.
 */
import { toolDefinition } from '@tanstack/ai'
import { z } from 'zod'

const candidate = z
  .enum(['A', 'B'])
  .meta({ description: 'Which CV: A is the first CV, B the second (only when two CVs are given).' })

const widgetId = z
  .string()
  .meta({ description: 'Stable kebab-case id. Reuse an existing id to replace that widget.' })

const widgetTitle = z
  .string()
  .meta({ description: 'Short title in sentence case, at most 40 characters, specific to the role.' })

const ack = z.object({ ok: z.boolean() })

export const setDashboardDef = toolDefinition({
  name: 'set_dashboard',
  description:
    'Call exactly once, first. Names the role being hired for and the few things this role is judged on.',
  inputSchema: z.object({
    role: z.string().meta({ description: 'Normalised job title, e.g. "Senior Backend Engineer (Payments)".' }),
    summary: z.string().meta({ description: 'One plain sentence (max 170 chars) with the headline finding.' }),
    focus: z
      .array(z.string())
      .meta({ description: '3 to 5 criteria this specific role is judged on, most important first.' }),
  }),
  outputSchema: ack,
})

export const showFitDef = toolDefinition({
  name: 'show_fit',
  description: 'Overall fit score per candidate. Always include one entry per CV.',
  inputSchema: z.object({
    id: widgetId,
    title: widgetTitle,
    candidates: z.array(
      z.object({
        candidate,
        name: z.string().meta({ description: 'Candidate name as written on the CV, or "Candidate A/B".' }),
        currentTitle: z.string(),
        fitScore: z.number().meta({ description: 'Integer 0-100. Be strict: 85+ is exceptional.' }),
        yearsRelevant: z.number().meta({ description: 'Years of experience relevant to THIS role.' }),
        oneLiner: z.string().meta({ description: 'Max 90 characters: why this score.' }),
      }),
    ),
  }),
  outputSchema: ack,
})

export const showRequirementsDef = toolDefinition({
  name: 'show_requirements',
  description:
    'Requirement-by-requirement evidence matrix. 5 to 8 requirements taken from the job (explicit or implied by the role).',
  inputSchema: z.object({
    id: widgetId,
    title: widgetTitle,
    requirements: z.array(
      z.object({
        requirement: z.string().meta({ description: 'Max 48 characters.' }),
        weight: z.enum(['must', 'strong', 'nice']),
        scores: z.array(
          z.object({
            candidate,
            level: z.number().meta({ description: 'Integer 0-5. 0 = no evidence, 5 = proven at a higher level than asked.' }),
            evidence: z.string().meta({ description: 'Max 110 characters, paraphrasing the CV. "No evidence in CV" if none.' }),
          }),
        ),
      }),
    ),
  }),
  outputSchema: ack,
})

export const showDimensionsDef = toolDefinition({
  name: 'show_dimensions',
  description:
    'Scores on 4 to 7 competency dimensions chosen for THIS role (e.g. clinical judgement for a nurse, system design for an architect).',
  inputSchema: z.object({
    id: widgetId,
    title: widgetTitle,
    dimensions: z.array(
      z.object({
        name: z.string().meta({ description: 'Max 28 characters.' }),
        scores: z.array(z.object({ candidate, score: z.number().meta({ description: '0-10, one decimal allowed.' }) })),
      }),
    ),
  }),
  outputSchema: ack,
})

export const showTimelineDef = toolDefinition({
  name: 'show_timeline',
  description: 'Career timeline with the relevance of each position to the target role.',
  inputSchema: z.object({
    id: widgetId,
    title: widgetTitle,
    entries: z.array(
      z.object({
        candidate,
        role: z.string(),
        org: z.string(),
        start: z.number().meta({ description: 'Start year, e.g. 2019.' }),
        end: z.number().meta({ description: 'End year; use the current year for ongoing roles.' }),
        relevance: z.enum(['high', 'medium', 'low']),
        note: z.string().meta({ description: 'Max 80 characters on why it matters (or not) for the role.' }),
      }),
    ),
  }),
  outputSchema: ack,
})

export const showMetricsDef = toolDefinition({
  name: 'show_metrics',
  description:
    '2 to 4 role-specific quantitative indicators read from the CVs (e.g. "Team size led", "Languages spoken", "Publications").',
  inputSchema: z.object({
    id: widgetId,
    title: widgetTitle,
    metrics: z.array(
      z.object({
        label: z.string().meta({ description: 'Max 32 characters.' }),
        unit: z.string().meta({ description: 'Unit shown after the value, or empty string.' }),
        values: z.array(z.object({ candidate, value: z.number() })),
        note: z.string().meta({ description: 'Max 70 characters: what good looks like for this role.' }),
      }),
    ),
  }),
  outputSchema: ack,
})

export const showGapsDef = toolDefinition({
  name: 'show_gaps',
  description: 'Gaps against the role, each with a severity and a concrete way to close or test it.',
  inputSchema: z.object({
    id: widgetId,
    title: widgetTitle,
    items: z.array(
      z.object({
        candidate,
        gap: z.string().meta({ description: 'Max 70 characters.' }),
        severity: z.enum(['critical', 'serious', 'warning']),
        mitigation: z.string().meta({ description: 'Max 110 characters.' }),
      }),
    ),
  }),
  outputSchema: ack,
})

export const showSignalsDef = toolDefinition({
  name: 'show_signals',
  description: 'Strongest evidence for and against hiring, with the CV line that supports each point.',
  inputSchema: z.object({
    id: widgetId,
    title: widgetTitle,
    items: z.array(
      z.object({
        candidate,
        kind: z.enum(['strength', 'risk']),
        point: z.string().meta({ description: 'Max 70 characters.' }),
        evidence: z.string().meta({ description: 'Max 110 characters, paraphrasing the CV.' }),
      }),
    ),
  }),
  outputSchema: ack,
})

export const showQuestionsDef = toolDefinition({
  name: 'show_questions',
  description: 'Interview questions that test the riskiest assumptions for this role.',
  inputSchema: z.object({
    id: widgetId,
    title: widgetTitle,
    questions: z.array(
      z.object({
        candidate: z.enum(['A', 'B', 'both']),
        question: z.string(),
        listenFor: z.string().meta({ description: 'Max 100 characters: what a strong answer contains.' }),
      }),
    ),
  }),
  outputSchema: ack,
})

export const showVerdictDef = toolDefinition({
  name: 'show_verdict',
  description: 'Final recommendation. Call last.',
  inputSchema: z.object({
    id: widgetId,
    headline: z.string().meta({ description: 'Max 60 characters, e.g. "Advance A to the system-design round".' }),
    pick: z.enum(['A', 'B', 'tie', 'none']).meta({ description: 'Preferred CV; "none" if no one fits.' }),
    confidence: z.enum(['low', 'medium', 'high']),
    reasons: z.array(z.string()).meta({ description: '2 to 4 reasons, each max 110 characters.' }),
  }),
  outputSchema: ack,
})

export const removeWidgetDef = toolDefinition({
  name: 'remove_widget',
  description: 'Remove a widget from the dashboard by id.',
  inputSchema: z.object({ id: widgetId }),
  outputSchema: ack,
})

export const widgetDefs = [
  setDashboardDef,
  showFitDef,
  showRequirementsDef,
  showDimensionsDef,
  showTimelineDef,
  showMetricsDef,
  showGapsDef,
  showSignalsDef,
  showQuestionsDef,
  showVerdictDef,
  removeWidgetDef,
] as const

export type WidgetToolName = (typeof widgetDefs)[number]['name']

type InputOf<T> = T extends { inputSchema: infer S } ? (S extends z.ZodType ? z.infer<S> : never) : never

export type DashboardHeader = InputOf<typeof setDashboardDef>
export type FitWidget = InputOf<typeof showFitDef>
export type RequirementsWidget = InputOf<typeof showRequirementsDef>
export type DimensionsWidget = InputOf<typeof showDimensionsDef>
export type TimelineWidget = InputOf<typeof showTimelineDef>
export type MetricsWidget = InputOf<typeof showMetricsDef>
export type GapsWidget = InputOf<typeof showGapsDef>
export type SignalsWidget = InputOf<typeof showSignalsDef>
export type QuestionsWidget = InputOf<typeof showQuestionsDef>
export type VerdictWidget = InputOf<typeof showVerdictDef>

export type Widget =
  | { kind: 'show_fit'; data: Partial<FitWidget> }
  | { kind: 'show_requirements'; data: Partial<RequirementsWidget> }
  | { kind: 'show_dimensions'; data: Partial<DimensionsWidget> }
  | { kind: 'show_timeline'; data: Partial<TimelineWidget> }
  | { kind: 'show_metrics'; data: Partial<MetricsWidget> }
  | { kind: 'show_gaps'; data: Partial<GapsWidget> }
  | { kind: 'show_signals'; data: Partial<SignalsWidget> }
  | { kind: 'show_questions'; data: Partial<QuestionsWidget> }
  | { kind: 'show_verdict'; data: Partial<VerdictWidget> }

export type WidgetKind = Widget['kind']

export const WIDGET_KINDS: ReadonlyArray<WidgetKind> = [
  'show_fit',
  'show_requirements',
  'show_dimensions',
  'show_timeline',
  'show_metrics',
  'show_gaps',
  'show_signals',
  'show_questions',
  'show_verdict',
]
