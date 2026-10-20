import { forwardRef, useEffect, useRef, useState } from 'react'
import PixelIcon from '../PixelIcon'
import { SONG } from '../content/music'
import { analyzeBeat } from '../music/beat'
import { setBeat, startDance, stopDance } from '../music/dance'

// The song is downloaded once (starting on hover/focus/press): the same bytes become the
// player's source (a blob URL) and, when the browser is idle, feed the beat analysis.
let songPromise = null
let songUrl = null // set once downloaded; until then the player streams SONG.src directly
function loadSong() {
  songPromise ??= fetch(SONG.src)
    .then((r) => {
      if (!r.ok) throw new Error(`song: ${r.status}`)
      return r.arrayBuffer()
    })
    .then((buf) => {
      songUrl = URL.createObjectURL(new Blob([buf], { type: 'audio/mpeg' })) // copies, before decoding detaches buf
      whenIdle(() => analyzeBeat(buf).then((b) => setBeat(b.bpm, b.offset)).catch(() => {})) // else: default tempo
    })
    .catch(() => { songPromise = null }) // try again next time
  return songPromise
}
const whenIdle = (fn) => (window.requestIdleCallback ? requestIdleCallback(fn, { timeout: 1500 }) : setTimeout(fn, 200))

// notes that drift up out of the record while it plays (pixel icon, start offset in px)
const NOTES = [['note', 0], ['notes', 10], ['note', -6]]

/**
 * The record player desktop icon: plays Lauren's song (public/music) and makes the butterflies
 * dance to its beat (see music/dance.js). While it plays the record spins, little notes float up
 * out of it and the label reads "Stop dance"; pressing it again stops the music and the dance.
 * The song loops while it's on.
 */
const DanceButton = forwardRef(function DanceButton(_, btnRef) {
  const [open, setOpen] = useState(false)
  const [spinning, setSpinning] = useState(false)
  const audio = useRef(null)

  const getAudio = () => {
    if (!audio.current) {
      // the downloaded copy if it's ready (it usually is: hover starts the download); otherwise
      // stream the file, so the press still plays straight away
      const a = new Audio(songUrl ?? SONG.src)
      a.loop = true
      a.preload = 'auto'
      a.addEventListener('playing', () => { startDance(() => a.currentTime); setSpinning(true) })
      a.addEventListener('pause', () => { stopDance(); setSpinning(false) })
      audio.current = a
    }
    return audio.current
  }

  const start = () => {
    setOpen(true)
    loadSong()
    // play straight from the click so the browser allows the sound
    getAudio().play().catch(() => setOpen(false))
  }

  const stop = () => {
    const a = audio.current
    if (a) { a.pause(); a.currentTime = 0 }
    stopDance()
    setSpinning(false)
    setOpen(false)
  }

  // leaving the page (route change) stops the music
  useEffect(() => () => { audio.current?.pause(); stopDance() }, [])

  return (
    <li className="icon-slot dance-slot">
      <button
        ref={btnRef}
        type="button"
        className={`desktop-file dance-button ${open ? 'is-open' : ''} ${spinning ? 'is-spinning' : ''}`}
        onClick={open ? stop : start}
        onPointerEnter={loadSong}
        onPointerDown={loadSong}
        onFocus={loadSong}
        aria-pressed={open}
        aria-label={open ? 'Stop the music' : `Dance: play ${SONG.title} and make the butterflies dance`}
      >
        <span className="record" aria-hidden="true">
          {[0, 1, 2, 3].map((k) => (
            <PixelIcon key={k} name={`record${k}`} size={56} className={`record-frame f${k}`} />
          ))}
          {spinning && NOTES.map(([name, x], i) => (
            <span key={i} className={`record-note n${i}`} style={{ '--note-x': `${x}px` }}>
              <PixelIcon name={name} size={16} />
            </span>
          ))}
        </span>
        <span className="desktop-file-label">{open ? 'Stop dance' : 'Dance'}</span>
      </button>
    </li>
  )
})

export default DanceButton
