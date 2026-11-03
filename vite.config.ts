import { defineConfig, loadEnv } from 'vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import { nitro } from 'nitro/vite'

export default defineConfig(({ mode }) => {
  // Expose .env to server routes (process.env), not only VITE_* to the client.
  Object.assign(process.env, loadEnv(mode, process.cwd(), ''))
  return {
    resolve: { tsconfigPaths: true },
    // nitro() emits a Vercel Build Output when built on Vercel (preset auto-detected).
    plugins: [tanstackStart(), nitro(), viteReact()],
  }
})
