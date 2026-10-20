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
- `src/site/` – the app shell: `Site.jsx` (routes, theme, cursor), `Taskbar.jsx` (menu bar + phone menu), `Footer.jsx`, `site.css`
  - `desktop/` – the landing "desktop": README window, desktop icons (Dance, Thought), contact dock, light overlay
  - `butterflies/` – the two ghost butterflies: `GhostButterflies.jsx` renders them, `motion.js` moves them (fly-ins, perch, dance choreography, swaps), `layout.js` tracks where the README/name/icons are, `perch.js` is the land/fly-off registry, `PixelButterflies.jsx` is the no-WebGL fallback
  - `music/` – `dance.js` (shared dance state + beat clock) and the beat detection (`beat.js` → `beatMath.js` in `beatWorker.js`)
  - `content/` – words and links: contact, projects, thoughts, the song
  - `hooks/`, `pages/` – theme / routing / reduced-motion hooks; Work, Garden, About
- `src/three/` – shared 3D: the Geometry Nodes wing flap (`wingMath.js`), materials, smoke
- `src/lab/` – the butterfly shader lab (Garden → Butterfly lab), loaded only on that page
- `public/art/` – the light overlay images; `public/music/` – the Dance song

## Dance music
The Dance button plays `public/music/jazz.mp3` (set in `src/site/content/music.js`) and the
butterflies dance to its beat, which `src/site/music/beat.js` detects from the audio in the
browser. Only use music you have the rights to put on a website, and keep its license next to
the file in `public/music/`.
