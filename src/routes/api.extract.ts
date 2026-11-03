import { createFileRoute } from '@tanstack/react-router'
import { extractCv } from '#/server/extract'

export const Route = createFileRoute('/api/extract')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const form = await request.formData()
        const file = form.get('file')
        if (!(file instanceof File)) return Response.json({ error: 'No file uploaded' }, { status: 400 })
        if (file.size > 8 * 1024 * 1024) return Response.json({ error: 'File is larger than 8 MB' }, { status: 413 })
        try {
          return Response.json(await extractCv(file))
        } catch (error) {
          return Response.json(
            { error: error instanceof Error ? error.message : 'Could not read this file' },
            { status: 422 },
          )
        }
      },
    },
  },
})
