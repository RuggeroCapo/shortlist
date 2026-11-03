/**
 * Password gate for the whole app (pages and /api). One shared password from
 * APP_PASSWORD; a successful login sets an HttpOnly cookie holding an HMAC of
 * the password, so changing the password logs everybody out.
 *
 * - Locally, with no APP_PASSWORD, the gate is off.
 * - On Vercel, with no APP_PASSWORD, everything is refused (fail closed).
 * - Static files (/assets, /samples) are served by the CDN and never reach this.
 */
const COOKIE = 'shortlist_auth'
const MAX_AGE = 60 * 60 * 24 * 30

const enc = new TextEncoder()

async function tokenFor(password: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode('shortlist-gate-v1'))
  return btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/[+/=]/g, (c) => ({ '+': '-', '/': '_', '=': '' })[c]!)
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

function readCookie(request: Request, name: string): string | null {
  const header = request.headers.get('cookie') ?? ''
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=')
    if (k === name) return v.join('=')
  }
  return null
}

/** Only same-site paths, so the login form can't be used as an open redirect. */
function safeNext(raw: string | null): string {
  return raw && raw.startsWith('/') && !raw.startsWith('//') ? raw : '/'
}

/** Returns a Response to send instead of the app, or null to let the request through. */
export async function gate(request: Request): Promise<Response | null> {
  const password = process.env.APP_PASSWORD
  if (!password) {
    if (!process.env.VERCEL) return null
    return new Response('APP_PASSWORD is not configured for this deployment.', { status: 503 })
  }

  const url = new URL(request.url)
  const expected = await tokenFor(password)

  if (url.pathname === '/login') {
    if (request.method === 'POST') {
      const form = await request.formData()
      const next = safeNext(String(form.get('next') ?? ''))
      const given = String(form.get('password') ?? '')
      if (given && safeEqual(await tokenFor(given), expected)) {
        const secure = url.protocol === 'https:' ? '; Secure' : ''
        return new Response(null, {
          status: 303,
          headers: {
            location: next,
            'set-cookie': `${COOKIE}=${expected}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${MAX_AGE}${secure}`,
          },
        })
      }
      return loginPage(next, true, 401)
    }
    return loginPage(safeNext(url.searchParams.get('next')), false, 200)
  }

  const cookie = readCookie(request, COOKIE)
  if (cookie && safeEqual(cookie, expected)) return null

  if (url.pathname.startsWith('/api/')) return new Response('Unauthorized', { status: 401 })
  return new Response(null, {
    status: 303,
    headers: { location: `/login?next=${encodeURIComponent(url.pathname + url.search)}` },
  })
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)

function loginPage(next: string, failed: boolean, status: number): Response {
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Shortlist · Sign in</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,600&display=swap">
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body { margin: 0; min-height: 100svh; display: grid; place-items: center; background: #0a0a0a; color: #efefef;
    font-family: 'Bricolage Grotesque', ui-sans-serif, system-ui, sans-serif; padding: 24px; }
  form { width: min(360px, 100%); display: grid; gap: 14px; background: #151515; padding: 28px; border-radius: 12px; }
  h1 { margin: 0; font-size: 26px; letter-spacing: -0.03em; font-weight: 600; }
  p { margin: 0; color: #9a9a9a; font-size: 14px; }
  label { font-size: 13px; color: #9a9a9a; }
  input { font: inherit; color: inherit; background: #0a0a0a; border: 1px solid #2a2a2a; border-radius: 8px; padding: 10px 12px; width: 100%; }
  input:focus { outline: 2px solid #3d93d6; outline-offset: 1px; border-color: transparent; }
  button { font: inherit; font-weight: 600; color: #fff; background: #b11226; border: 0; border-radius: 8px; padding: 10px 14px; cursor: pointer;
    transition: background 200ms cubic-bezier(0.22, 1, 0.36, 1); }
  button:hover { background: #c8172e; }
  .err { color: #ec835a; font-size: 13px; }
</style>
</head>
<body>
<form method="post" action="/login">
  <h1>Shortlist</h1>
  <p>Generative UI over AG-UI. This demo is private.</p>
  <input type="hidden" name="next" value="${esc(next)}">
  <div style="display:grid;gap:6px">
    <label for="password">Password</label>
    <input id="password" name="password" type="password" autocomplete="current-password" required autofocus>
  </div>
  ${failed ? '<span class="err" role="alert">Wrong password.</span>' : ''}
  <button type="submit">Enter</button>
</form>
</body>
</html>`
  return new Response(html, {
    status,
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': 'noindex' },
  })
}
