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
