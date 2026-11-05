import { forwardRef, useEffect, useRef, useState } from 'react'
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
      whenIdle(() =>
        analyzeBeat(buf)
          .then((b) => setBeat(b.bpm, b.offset))
          .catch(() => {}),
      ) // else: default tempo
    })
    .catch(() => {
      songPromise = null
    }) // try again next time
  return songPromise
}
const whenIdle = (fn) => (window.requestIdleCallback ? requestIdleCallback(fn, { timeout: 1500 }) : setTimeout(fn, 200))

/**
 * The record player desktop icon: plays Lauren's song (public/music) and makes the butterflies
 * dance to its beat (see music/dance.js). `icon(spinning)` draws it (the neon record spins while
 * it plays) and `label(open)` names it; pressing it again stops the music and the dance.
 * The song loops while it's on.
 */
const DanceButton = forwardRef(function DanceButton(
  {
    icon,
    label,
    slotClassName = 'icon-slot dance-slot',
    buttonClassName = 'desktop-file dance-button',
    labelClassName = 'desktop-file-label',
  },
  btnRef,
) {
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
      a.addEventListener('playing', () => {
        startDance(() => a.currentTime)
        setSpinning(true)
      })
      a.addEventListener('pause', () => {
        stopDance()
        setSpinning(false)
      })
      audio.current = a
    }
    return audio.current
  }

  const start = () => {
    setOpen(true)
    loadSong()
    // play straight from the click so the browser allows the sound
    getAudio()
      .play()
      .catch(() => setOpen(false))
  }

  const stop = () => {
    const a = audio.current
    if (a) {
      a.pause()
      a.currentTime = 0
    }
    stopDance()
    setSpinning(false)
    setOpen(false)
  }

  // leaving the page (route change) stops the music
  useEffect(
    () => () => {
      audio.current?.pause()
      stopDance()
    },
    [],
  )

  return (
    <li className={slotClassName}>
      <button
        ref={btnRef}
        type="button"
        className={`${buttonClassName} ${open ? 'is-open' : ''} ${spinning ? 'is-spinning' : ''}`}
        onClick={open ? stop : start}
        onPointerEnter={loadSong}
        onPointerDown={loadSong}
        onFocus={loadSong}
        // the name changes with the visible label (stop dance / dance), so no aria-pressed too
        aria-label={open ? 'Stop dance: stop the music' : `Dance: play ${SONG.title} and make the butterflies dance`}
      >
        {icon(spinning)}
        <span className={labelClassName}>{label(open)}</span>
      </button>
    </li>
  )
})

export default DanceButton
