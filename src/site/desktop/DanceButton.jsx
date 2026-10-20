import { forwardRef, useEffect, useRef, useState } from 'react'
import PixelIcon from '../PixelIcon'
import WindowChrome from './WindowChrome'
import { bpmFor } from '../bpm'
import { startDance, stopDance } from '../dance'

// Spotify's iFrame Embed API: loaded on first hover/focus/click, never on page load.
// Logged-out visitors hear 30s previews; logged-in visitors hear full songs.
const API_SRC = 'https://open.spotify.com/embed/iframe-api/v1'
let apiPromise = null
function loadSpotify() {
  apiPromise ??= new Promise((resolve, reject) => {
    window.onSpotifyIframeApiReady = resolve
    const s = document.createElement('script')
    s.src = API_SRC
    s.async = true
    s.onerror = () => { apiPromise = null; reject(new Error('Spotify embed failed to load')) }
    document.body.appendChild(s)
  })
  return apiPromise
}

// The playlist is public/playlist.json, refreshed at build time by scripts/fetch-playlist.mjs.
let playlistPromise = null
function loadPlaylist() {
  playlistPromise ??= fetch(`${import.meta.env.BASE_URL}playlist.json`)
    .then((r) => (r.ok ? r.json() : []))
    .catch(() => [])
  return playlistPromise
}

/** Random track, never the one that just played (unless it's the only one). */
function pickTrack(list, lastId) {
  const pool = list.length > 1 ? list.filter((t) => t.id !== lastId) : list
  return pool[Math.floor(Math.random() * pool.length)]
}

/**
 * The record player desktop icon: plays a random song from Lauren's Spotify playlist in a
 * "now playing" window and makes the butterflies dance to its tempo (see dance.js).
 * Clicking again, or the window's ×, stops the music and the dance.
 */
const DanceButton = forwardRef(function DanceButton(_, btnRef) {
  const [open, setOpen] = useState(false)
  const [spinning, setSpinning] = useState(false)
  const [failed, setFailed] = useState(false)
  const holderRef = useRef(null)
  const ctl = useRef(null) // Spotify EmbedController
  const run = useRef({ list: [], track: null, lastPos: 0, advancing: false })

  const playNext = () => {
    const r = run.current
    const next = pickTrack(r.list, r.track?.id)
    if (!next || !ctl.current) return
    r.track = next
    r.advancing = true
    r.lastPos = 0
    ctl.current.loadUri(`spotify:track:${next.id}`)
    ctl.current.play()
  }

  const onUpdate = ({ data }) => {
    const r = run.current
    const { isPaused, position = 0, duration = 0 } = data ?? {}
    if (!isPaused) {
      // playing: (re)start the beat clock, offset by where the song actually is
      if (r.advancing && position > 1500) return // stale update from the previous song
      r.advancing = false
      startDance(bpmFor(r.track?.id), position)
      setSpinning(true)
    }
    const ended = duration > 0 && (position >= duration - 400 || (isPaused && r.lastPos >= duration - 1500))
    if (ended && !r.advancing) {
      playNext() // keep dancing: another random song
    } else if (isPaused && !r.advancing) {
      stopDance() // paused from the embed's own controls: the butterflies rest
      setSpinning(false)
    }
    r.lastPos = position
  }

  const stop = () => {
    stopDance()
    setSpinning(false)
    setOpen(false)
    try { ctl.current?.destroy() } catch {}
    ctl.current = null
  }

  const start = () => {
    setFailed(false)
    setOpen(true)
  }

  // once the window (and its holder div) is mounted, build the player and press play
  useEffect(() => {
    if (!open) return
    let cancelled = false
    Promise.all([loadSpotify(), loadPlaylist()])
      .then(([api, list]) => {
        if (cancelled || !holderRef.current) return
        const r = run.current
        r.list = list
        r.track = pickTrack(list, r.track?.id)
        if (!r.track) { setFailed(true); return }
        r.advancing = true
        api.createController(
          holderRef.current,
          { uri: `spotify:track:${r.track.id}`, width: '100%', height: 80 },
          (controller) => {
            if (cancelled) { controller.destroy(); return }
            ctl.current = controller
            controller.addListener('ready', () => controller.play())
            controller.addListener('playback_update', onUpdate)
          },
        )
      })
      .catch(() => setFailed(true))
    return () => { cancelled = true }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  // leaving the page (route change) stops the music
  useEffect(() => () => { stopDance(); try { ctl.current?.destroy() } catch {} }, [])

  return (
    // raised while open so the window sits above the README and the contact dock
    <li className={`icon-slot dance-slot ${open ? 'is-raised' : ''}`}>
      <button
        ref={btnRef}
        type="button"
        className={`desktop-file dance-button ${open ? 'is-open' : ''} ${spinning ? 'is-spinning' : ''}`}
        onClick={open ? stop : start}
        onPointerEnter={() => { loadSpotify().catch(() => {}); loadPlaylist() }}
        onFocus={() => { loadSpotify().catch(() => {}); loadPlaylist() }}
        aria-pressed={open}
        aria-label={open ? 'Stop the music' : 'Dance: play a song and make the butterflies dance'}
      >
        <span className="record" aria-hidden="true">
          {[0, 1, 2, 3].map((k) => (
            <PixelIcon key={k} name={`record${k}`} size={56} className={`record-frame f${k}`} />
          ))}
        </span>
        <span className="desktop-file-label">Dance</span>
      </button>

      {open && (
        <div className="now-playing win" role="dialog" aria-labelledby="now-playing-title">
          <WindowChrome title="now playing" titleId="now-playing-title" closeLabel="Stop the music" onClose={stop} />
          <div className="win-body">
            {failed ? (
              <p className="now-playing-error win-pane">Couldn't reach Spotify. Try again in a bit.</p>
            ) : (
              <div className="now-playing-embed">
                <div ref={holderRef} />
              </div>
            )}
          </div>
        </div>
      )}
    </li>
  )
})

export default DanceButton
