// Pulls Lauren's Spotify playlist into public/playlist.json at build time, so songs added to
// the playlist show up on the site after the next deploy (deploy.yml also runs daily).
//
// Spotify only lets a playlist's owner (or a collaborator) list its items, so this signs in AS
// Lauren with a refresh token from scripts/spotify-login.mjs. Needs three GitHub Actions secrets:
// SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET, SPOTIFY_REFRESH_TOKEN. Without them, or if Spotify
// fails, it keeps the committed playlist.json and exits 0 so the build never breaks.
import { readFile, writeFile } from 'node:fs/promises'

const PLAYLIST_ID = '5TYNhG2qSkiHOIdRHPNL6T'
const OUT = new URL('../public/playlist.json', import.meta.url)

async function main() {
  const { SPOTIFY_CLIENT_ID: id, SPOTIFY_CLIENT_SECRET: secret, SPOTIFY_REFRESH_TOKEN: refresh } = process.env
  if (!id || !secret || !refresh) {
    console.warn('[playlist] Spotify secrets not set; keeping existing playlist.json')
    return
  }

  const tokenRes = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refresh }),
  })
  if (!tokenRes.ok) {
    const err = await tokenRes.json().catch(() => ({}))
    // invalid_grant = the refresh token was revoked/expired: run scripts/spotify-login.mjs again
    throw new Error(`token request failed: ${tokenRes.status} ${err.error ?? ''}`)
  }
  const { access_token: token } = await tokenRes.json()

  const tracks = []
  // Get Playlist Items (the old /tracks endpoint is deprecated); `item` replaces `track`
  const fields = encodeURIComponent('items(is_local,item(id,name,type,artists(name))),next')
  let url = `https://api.spotify.com/v1/playlists/${PLAYLIST_ID}/items?fields=${fields}&limit=50`
  while (url) {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
    if (!res.ok) throw new Error(`playlist request failed: ${res.status} ${await res.text()}`)
    const page = await res.json()
    for (const { item, is_local: local } of page.items ?? []) {
      if (!item || local || !item.id || (item.type && item.type !== 'track')) continue // skip local files + podcasts
      tracks.push({ id: item.id, title: item.name, artist: item.artists.map((a) => a.name).join(', ') })
    }
    url = page.next
  }
  if (!tracks.length) throw new Error('playlist came back empty')

  const json = `${JSON.stringify(tracks, null, 2)}\n`
  const prev = await readFile(OUT, 'utf8').catch(() => '')
  if (json === prev) console.log(`[playlist] unchanged (${tracks.length} tracks)`)
  else { await writeFile(OUT, json); console.log(`[playlist] wrote ${tracks.length} tracks`) }
}

main().catch((err) => {
  console.warn(`[playlist] ${err.message}; keeping existing playlist.json`)
})
