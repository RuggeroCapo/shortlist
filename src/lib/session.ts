export type CandidateLabel = 'A' | 'B'

export interface CandidateDoc {
  label: CandidateLabel
  fileName: string
  /** Best guess at the candidate's name, read from the top of the CV. */
  name: string
  text: string
  pages: number | null
  words: number
}

export interface Session {
  role: string
  jobDescription: string
  candidates: Array<CandidateDoc>
}

/**
 * Server-side model fallback order on the Vercel AI Gateway. Not exposed in
 * the UI: the point of the POC is the AG-UI protocol, not the model. The
 * first entry works on free-tier keys; on a 403 the server moves down the list.
 */
export const MODELS: ReadonlyArray<{ id: string }> = [
  { id: 'openai/gpt-4.1-mini' },
  { id: 'google/gemini-2.5-flash-lite' },
  { id: 'anthropic/claude-haiku-5.5' },
]

export const CANDIDATE_COLOURS: Record<CandidateLabel, string> = {
  A: 'var(--cand-a)',
  B: 'var(--cand-b)',
}
