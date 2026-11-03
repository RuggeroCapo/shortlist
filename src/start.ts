import { createMiddleware, createStart } from '@tanstack/react-start'
import { gate } from '#/server/gate'

/** Runs before every server request: SSR pages, server routes (/api/*) and /login. */
const passwordGate = createMiddleware({ type: 'request' }).server(async ({ request, next }) => {
  const blocked = await gate(request)
  if (blocked) return blocked
  return next()
})

export const startInstance = createStart(() => ({ requestMiddleware: [passwordGate] }))
