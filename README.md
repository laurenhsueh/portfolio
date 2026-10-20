# laurenhsueh.com

Lauren Hsueh's portfolio: a little personal operating system with ghost butterflies.
React + Vite, with three.js / react-three-fiber for the butterflies.

```
npm install
npm run dev      # http://localhost:5173
npm run build    # production build in dist/
```

## Deploying
Every push to `main` builds the site and publishes it to GitHub Pages
(`.github/workflows/deploy.yml`). The custom domain is set in `public/CNAME`.

## Where things are
- `src/site/` – the site: taskbar, desktop hero (README window, icons, contact dock), Work, Garden, About, footer
- `src/site/desktop/GhostButterflies.jsx` – the two ghost butterflies (perch land / fly-off, follow)
- `src/site/desktop/LightOverlay.jsx` + `public/art/` – the light image behind the README
- `src/site/contact.js` – LinkedIn + email
- `src/ButterflyLab.jsx` – the butterfly shader lab (Garden → Butterfly lab)
- `src/wingMath.js` – the Blender Geometry Nodes wing flap, ported to JS

## Dance playlist (Spotify sync)

The Dance button plays a random song from `public/playlist.json`. On every deploy (and daily at
about 8am Pacific), `scripts/fetch-playlist.mjs` refreshes that file from the Spotify playlist,
signed in as Lauren, because Spotify only lets a playlist's owner list its songs. If the secrets
are missing or Spotify fails, the build keeps the existing file.

One-time setup:

1. At [developer.spotify.com/dashboard](https://developer.spotify.com/dashboard), create an app
   (any name, Web API) and add the Redirect URI `http://127.0.0.1:8888/callback`.
2. In your own terminal (it prints a secret), run:
   `SPOTIFY_CLIENT_ID=... SPOTIFY_CLIENT_SECRET=... node scripts/spotify-login.mjs`
   Log in when the browser opens, then copy the refresh token it prints.
3. In the GitHub repo, go to Settings → Secrets and variables → Actions and add
   `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET` and `SPOTIFY_REFRESH_TOKEN`.
4. Actions → "Deploy to GitHub Pages" → Run workflow, then check the
   "Pull the Spotify playlist" step says `wrote N tracks`.

If that step ever says `invalid_grant`, the login expired or was revoked: repeat steps 2–3.
Tempos for the dance live in `src/site/bpm.js`; songs without one dance at 110 BPM.
