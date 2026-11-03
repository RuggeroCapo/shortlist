import { createFileRoute } from '@tanstack/react-router'
import {
  chat,
  chatParamsFromRequestBody,
  maxIterations,
  toServerSentEventsResponse,
} from '@tanstack/ai'
import { z } from 'zod'
import { gatewayAdapter, modelChain, withModelFallback } from '#/server/gateway'
import { buildSystemPrompt } from '#/server/prompt'
import { serverWidgetTools } from '#/server/tools'

/** Allow-list for AG-UI forwardedProps: the client sends the session, nothing else. */
const ForwardedProps = z.object({
  session: z.object({
    role: z.string().max(200),
    jobDescription: z.string().max(20000),
    candidates: z
      .array(
        z.object({
          label: z.enum(['A', 'B']),
          fileName: z.string().max(300),
          name: z.string().max(200),
          text: z.string().max(60000),
          pages: z.number().nullable(),
          words: z.number(),
        }),
      )
      .min(1)
      .max(2),
  }),
})

export const Route = createFileRoute('/api/agent')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let params
        try {
          params = await chatParamsFromRequestBody(await request.json())
        } catch (error) {
          return new Response(error instanceof Error ? error.message : 'Bad request', { status: 400 })
        }
        const forwarded = ForwardedProps.safeParse(params.forwardedProps)
        if (!forwarded.success) {
          return new Response(`Invalid forwardedProps: ${forwarded.error.message}`, { status: 400 })
        }
        const { session } = forwarded.data
        const abortController = new AbortController()
        request.signal.addEventListener('abort', () => abortController.abort())

        const stream = withModelFallback(modelChain(), (m) =>
          chat({
            adapter: gatewayAdapter(m),
            messages: params.messages,
            threadId: params.threadId,
            runId: params.runId,
            systemPrompts: [buildSystemPrompt(session)],
            tools: serverWidgetTools,
            agentLoopStrategy: maxIterations(16),
            modelOptions: { temperature: 0.2, max_tokens: 6000 } as never,
            abortController,
          }),
        )

        return toServerSentEventsResponse(stream, {
          abortController,
          headers: { 'X-Accel-Buffering': 'no' },
        })
      },
    },
  },
})
