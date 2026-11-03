# Shortlist

A proof of concept for **generative UI over the AG-UI protocol**. Upload a CV (or two) and name a role: an agent composes a hiring dashboard for that exact job by choosing React components and streaming their props, one AG-UI tool call at a time. The UI shows, live, which component is being created, from which tool call, and the raw AG-UI event stream behind it.

The point of the POC is the protocol, not the model: the agent never emits HTML or a final JSON blob. It emits typed tool calls; the client owns a component registry and renders partial props as they stream.

- **TanStack AI** (`@tanstack/ai`, `@tanstack/ai-react`) runs the agent loop on the server (`chat()`) and drives the client (`useChat`).
- **AG-UI** is the wire protocol. The browser sends an AG-UI `RunAgentInput` (CV text in `forwardedProps`). The server streams AG-UI events back over SSE: `RUN_STARTED`, `TOOL_CALL_START/ARGS/END`, `TOOL_CALL_RESULT`, `TEXT_MESSAGE_*`, `CUSTOM`, `RUN_FINISHED`.
- **Vercel AI Gateway** is the only model provider, reached through TanStack AI's `openaiCompatible` adapter at `https://ai-gateway.vercel.sh/v1`.

## How the generative dashboard works

The agent never returns one JSON blob. It **composes** the dashboard by calling typed tools (`src/lib/widgets.ts`, Zod schemas):

| Tool | Widget |
| --- | --- |
| `set_dashboard` | role title, one-line finding, what the role is judged on |
| `show_fit` | 0–100 fit per candidate |
| `show_requirements` | requirement × candidate evidence matrix (level 0–5 + CV evidence) |
| `show_dimensions` | role-specific competency dot plot (dumbbell when comparing) |
| `show_metrics` | 2–4 role-specific numbers read from the CV |
| `show_timeline` | career timeline, coloured by relevance to the role |
| `show_gaps` | gaps with severity and how to test or close them |
| `show_signals` | strengths and risks with CV evidence |
| `show_questions` | interview questions and what to listen for |
| `show_verdict` | recommendation, confidence and reasons |
| `remove_widget` | delete a widget (follow-up turns) |

Each tool's arguments stream as `TOOL_CALL_ARGS` deltas. The client folds the tool-call parts into the dashboard (`src/lib/dashboard.ts`), using `parsePartialJSON` so widgets fill in while they stream. The server halves of the tools only acknowledge (`src/server/tools.ts`). That keeps the whole agent loop in one request, and Zod rejects malformed arguments so the model can retry.

The agent picks the requirements, dimensions and metrics to fit the job. An ICU nurse gets ventilation, CRRT and charge-nurse metrics; a design-systems engineer gets tokens, accessibility and adoption. Follow-up messages ("add a widget on leadership", "drop the timeline") upsert or remove widgets by id.

### Seeing the protocol

- Every widget carries an origin strip: `<FitScore />` ← `show_fit` · id, and whether its `TOOL_CALL_ARGS` are still streaming.
- The right rail (**AG-UI stream**) has a live sentence on what the agent is doing, a **Components** tab (each tool call → component, mounted / streaming / rejected by Zod / unmounted; click to jump to it) and a **Raw events** tab (event-type totals and a folded log built from `useChat`'s `onChunk`).
- The component registry lives in `src/lib/dashboard.ts` (`COMPONENTS`).

### Model

The model is a server-side detail (`MODELS` in `src/lib/session.ts`, via the Vercel AI Gateway). `src/server/gateway.ts` falls back down the list if a gateway key is refused (403) before any content reaches the client.

## Screens

- **New analysis** (`/`): sample sets, the upload and role panel, the component registry (tool → component) and what happens on the wire.
- **Dashboard** (`/workspace`): role, candidates and a Rebuild button; a KPI strip computed from the streamed widgets; the widget grid; and the AG-UI stream rail with follow-up input.

## Run

```bash
cp .env.example .env      # set AI_GATEWAY_API_KEY
npm install
npm run dev               # http://localhost:3000
```

Production: `npm run build && npx vite preview`. On Vercel, the `nitro()` Vite plugin emits a Build Output automatically; set `AI_GATEWAY_API_KEY` in the project's environment variables.

The sidebar's **Sample sets** load fictional candidates: two PDFs and a job ad (`/?sample=compare`), or one DOCX for a non-tech role (`/?sample=nurse`).

## Files

```
src/lib/widgets.ts        tool contract (shared by server and client)
src/lib/dashboard.ts      AG-UI tool-call parts → dashboard state
src/server/gateway.ts     Vercel AI Gateway adapter + model fallback
src/server/prompt.ts      system prompt (role, job ad, CV text)
src/server/extract.ts     PDF (unpdf) / DOCX (mammoth) / TXT → text
src/routes/api.agent.ts   AG-UI endpoint: chatParamsFromRequestBody → chat() → SSE
src/routes/api.extract.ts upload endpoint
src/components/AppShell.tsx sidebar + top bar shared by both screens
src/components/Kpis.tsx   KPI strip derived from widget data
src/routes/index.tsx      new-analysis screen (upload, role, registry)
src/routes/workspace.tsx  dashboard + AG-UI stream rail (useChat)
src/lib/trace.ts          raw AG-UI events (onChunk) → folded log
src/components/Widgets.tsx widget renderers
```

## Notes and limits

- CV text travels in `forwardedProps` on every turn. The server keeps no state, and nothing is stored.
- Scanned (image-only) PDFs are rejected; there is no OCR.
- Scores are a model's reading of the CV, not a hiring decision.
