// One-time helper: log in to Spotify as Lauren and print a refresh token for the playlist sync.
// Run it yourself in your own terminal; it prints a secret, so don't paste the output into chat.
//
//   SPOTIFY_CLIENT_ID=... SPOTIFY_CLIENT_SECRET=... node scripts/spotify-login.mjs
//
// It opens Spotify's login page, catches the redirect on http://127.0.0.1:8888/callback (add
// that exact Redirect URI in your Spotify app's settings), and prints the refresh token. Save it
// as the GitHub Actions secret SPOTIFY_REFRESH_TOKEN. It only asks to READ your playlists.
import { createServer } from 'node:http'
import { randomBytes } from 'node:crypto'
import { spawn } from 'node:child_process'

const PORT = 8888
const REDIRECT_URI = `http://127.0.0.1:${PORT}/callback`
const SCOPES = 'playlist-read-private playlist-read-collaborative'

const { SPOTIFY_CLIENT_ID: id, SPOTIFY_CLIENT_SECRET: secret } = process.env
if (!id || !secret) {
  console.error('Set SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET first, e.g.\n' +
    '  SPOTIFY_CLIENT_ID=... SPOTIFY_CLIENT_SECRET=... node scripts/spotify-login.mjs')
  process.exit(1)
}

const state = randomBytes(16).toString('hex')
const authUrl = `https://accounts.spotify.com/authorize?${new URLSearchParams({
  response_type: 'code',
  client_id: id,
  scope: SCOPES,
  redirect_uri: REDIRECT_URI,
  state,
})}`

const page = (msg) => `<!doctype html><meta charset="utf-8"><title>Spotify login</title>
<body style="font:16px system-ui;padding:40px;background:#1d191d;color:#f4eaf0">${msg}</body>`

const server = createServer(async (req, res) => {
  const url = new URL(req.url, REDIRECT_URI)
  if (url.pathname !== '/callback') { res.writeHead(404).end(); return }
  const finish = (code, msg) => {
    res.writeHead(code, { 'Content-Type': 'text/html' }).end(page(msg))
    server.close()
  }
  if (url.searchParams.get('state') !== state) return finish(400, 'State mismatch. Run the script again.')
  if (url.searchParams.get('error')) return finish(400, `Spotify said: ${url.searchParams.get('error')}`)

  try {
    const r = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ grant_type: 'authorization_code', code: url.searchParams.get('code'), redirect_uri: REDIRECT_URI }),
    })
    const body = await r.json()
    if (!r.ok || !body.refresh_token) throw new Error(`${r.status} ${body.error_description || body.error || ''}`)
    console.log('\nLogged in. Save this as the GitHub secret SPOTIFY_REFRESH_TOKEN:\n')
    console.log(body.refresh_token)
    console.log('\n(GitHub repo → Settings → Secrets and variables → Actions → New repository secret)\n')
    finish(200, 'All set. Go back to your terminal to copy the refresh token. You can close this tab.')
  } catch (err) {
    console.error(`Token exchange failed: ${err.message}`)
    finish(500, 'Something went wrong. Check your terminal.')
  }
})

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Opening Spotify login… If nothing opens, visit:\n${authUrl}\n`)
  const opener = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'explorer' : 'xdg-open'
  spawn(opener, [authUrl], { stdio: 'ignore', detached: true }).on('error', () => {}).unref()
})
