import { openaiCompatible } from '@tanstack/ai-openai/compatible'
import type { StreamChunk } from '@tanstack/ai'
import { MODELS } from '#/lib/session'

const MODEL_IDS = MODELS.map((m) => m.id)

let provider: ReturnType<typeof createProvider> | null = null

function createProvider() {
  const apiKey = process.env.AI_GATEWAY_API_KEY
  if (!apiKey) throw new Error('AI_GATEWAY_API_KEY is not set (see .env.example)')
  return openaiCompatible({
    name: 'vercel-ai-gateway',
    baseURL: process.env.AI_GATEWAY_BASE_URL ?? 'https://ai-gateway.vercel.sh/v1',
    apiKey,
    models: MODEL_IDS as Array<string>,
  })
}

export function gatewayAdapter(model: string) {
  provider ??= createProvider()
  return provider(model as never)
}

/** Fallback order, set on the server only: the model is an implementation detail of the agent. */
export function modelChain(): Array<string> {
  return [...MODEL_IDS]
}

function isAccessError(chunk: StreamChunk): boolean {
  if (chunk.type !== 'RUN_ERROR') return false
  const c = chunk as { code?: string; message?: string }
  return c.code === '403' || c.code === '401' || /free tier|do not have access|not available|no_providers/i.test(c.message ?? '')
}

/**
 * Runs the agent on the first model the gateway key may use.
 *
 * The decision is taken before anything reaches the client: a refused model
 * answers RUN_STARTED → RUN_ERROR immediately, so we hold RUN_STARTED back,
 * and on an access error discard the attempt and try the next model. Once a
 * model streams real content we are committed. Every skipped model is
 * reported as an AG-UI CUSTOM event right after the winning RUN_STARTED.
 */
export async function* withModelFallback(
  chain: Array<string>,
  run: (model: string) => AsyncIterable<StreamChunk>,
): AsyncGenerator<StreamChunk> {
  const skipped: Array<{ model: string; reason: string }> = []
  for (let i = 0; i < chain.length; i++) {
    const model = chain[i]
    const held: Array<StreamChunk> = []
    let committed = false
    let fellThrough = false
    for await (const chunk of run(model)) {
      if (!committed) {
        if (chunk.type === 'RUN_STARTED') {
          held.push(chunk)
          continue
        }
        if (isAccessError(chunk) && i < chain.length - 1) {
          skipped.push({ model, reason: (chunk as { message?: string }).message ?? 'refused' })
          fellThrough = true
          break
        }
        committed = true
        yield* held
        yield {
          type: 'CUSTOM',
          name: 'agent.model',
          value: { model, skipped },
          timestamp: Date.now(),
        } as StreamChunk
      }
      yield chunk
    }
    if (!fellThrough) {
      if (!committed) yield* held
      return
    }
  }
}
