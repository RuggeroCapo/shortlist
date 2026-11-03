import { widgetDefs } from '#/lib/widgets'

/**
 * Server halves of the widget tools. Rendering happens in the browser from
 * the streamed tool-call arguments; the server only acknowledges, so the
 * agent loop continues in a single request instead of a client round-trip
 * per widget. Zod validates the arguments first: a malformed call returns an
 * error result the model can see and correct.
 */
export const serverWidgetTools = widgetDefs.map((def) =>
  (def as (typeof widgetDefs)[number]).server(async () => ({ ok: true })),
)
