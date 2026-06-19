import React, { useState, useEffect, useRef } from 'react'

// ── Audio download helpers ──
// Browsers silently refuse `data:` URI downloads above a few MB, which is why
// full-document exports failed while short previews worked. Decoding to a Blob +
// object URL removes that size ceiling entirely.
export function dataUriToBlob(dataUri) {
  const [meta, b64] = dataUri.split(',')
  const mimeMatch = /data:([^;]+)/.exec(meta || '')
  const mime = mimeMatch ? mimeMatch[1] : 'application/octet-stream'
  const binary = atob(b64 || '')
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new Blob([bytes], { type: mime })
}

export function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

// ── Retro 90s Vinyl Record Player Component ──
export default function VinylPlayer({ src, filename, label }) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [currentTime, setCurrentTime] = useState('0:00')
  const [duration, setDuration] = useState('0:00')
  const [objectUrl, setObjectUrl] = useState('')
  const audioRef = useRef(null)

  // Convert the incoming base64 data URI into a Blob object URL. Used for both
  // playback and download so large (multi-MB) tracks aren't capped by the
  // browser's data: URI limits.
  useEffect(() => {
    if (!src) { setObjectUrl(''); return }
    let url = ''
    try {
      url = URL.createObjectURL(dataUriToBlob(src))
      setObjectUrl(url)
    } catch (e) {
      console.error('Failed to build audio object URL, falling back to data URI', e)
      setObjectUrl(src)
    }
    return () => { if (url) URL.revokeObjectURL(url) }
  }, [src])

  const togglePlay = () => {
    if (!audioRef.current) return
    if (isPlaying) {
      audioRef.current.pause()
    } else {
      audioRef.current.play()
    }
  }

  const handleTimeUpdate = () => {
    if (!audioRef.current) return
    const cur = audioRef.current.currentTime
    const dur = audioRef.current.duration || 0
    setProgress(dur > 0 ? (cur / dur) * 100 : 0)

    const formatTime = (time) => {
      if (isNaN(time)) return '0:00'
      const mins = Math.floor(time / 60)
      const secs = Math.floor(time % 60)
      return `${mins}:${secs < 10 ? '0' : ''}${secs}`
    }
    setCurrentTime(formatTime(cur))
  }

  const handleLoadedMetadata = () => {
    if (!audioRef.current) return
    const formatTime = (time) => {
      if (isNaN(time)) return '0:00'
      const mins = Math.floor(time / 60)
      const secs = Math.floor(time % 60)
      return `${mins}:${secs < 10 ? '0' : ''}${secs}`
    }
    setDuration(formatTime(audioRef.current.duration))
  }

  const handleSeek = (e) => {
    if (!audioRef.current) return
    const dur = audioRef.current.duration || 0
    const pct = parseFloat(e.target.value)
    audioRef.current.currentTime = (pct / 100) * dur
    setProgress(pct)
  }

  const handleDownload = () => {
    const href = objectUrl || src
    if (!href) return
    const a = document.createElement('a')
    a.href = href
    a.download = filename || 'track.mp3'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  useEffect(() => {
    setIsPlaying(false)
    setProgress(0)
    setCurrentTime('0:00')
  }, [src])

  return (
    <div className="turntable-container select-none">
      <audio
        ref={audioRef}
        src={objectUrl || src}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => setIsPlaying(false)}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
      />

      {/* Vinyl Deck */}
      <div className={`turntable-deck ${isPlaying ? 'active-play' : ''}`}>
        <div className={`vinyl-record ${isPlaying ? 'vinyl-spin' : ''}`}>

          <div className="vinyl-grooves" />
          <div className="vinyl-grooves-2" />
          <div className="vinyl-label">
            <span className="vinyl-brand">sunAI</span>
          </div>
          <div className="vinyl-center-spindle" />
        </div>

        {/* Tonearm */}
        <div className={`tonearm ${isPlaying ? 'active' : ''}`}>
          <div className="tonearm-pivot" />
          <div className="tonearm-arm" />
          <div className="tonearm-needle" />
        </div>
      </div>

      {/* Info & Controls */}
      <div className="w-full flex flex-col space-y-3 text-center items-center">
        <div className="flex flex-col items-center">
          <span className="text-xs font-black text-black uppercase tracking-wider block max-w-full truncate">{label || filename}</span>
          <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest mt-1">{currentTime} / {duration}</span>
        </div>

        {/* Progress Bar */}
        <input
          type="range"
          min="0"
          max="100"
          step="0.1"
          value={progress}
          onChange={handleSeek}
          className="w-full h-1.5 bg-zinc-200 rounded-none appearance-none cursor-pointer accent-black"
        />

        {/* Action Controls */}
        <div className="flex items-center justify-center gap-3 w-full">
          <button
            onClick={togglePlay}
            className="px-5 py-2 bg-black hover:bg-zinc-900 text-white text-[9px] font-black uppercase tracking-widest border border-black shadow-[2px_2px_0px_rgba(0,0,0,1)] transition-all duration-150 active:translate-x-[1px] active:translate-y-[1px]"
          >
            {isPlaying ? 'PAUSE' : 'PLAY'}
          </button>

          {src && (
            <button
              onClick={handleDownload}
              className="px-4 py-2 bg-white hover:bg-zinc-50 text-black text-[9px] font-black uppercase tracking-widest border border-black shadow-[2px_2px_0px_var(--accent-green)] transition-all duration-150 inline-block"
            >
              DOWNLOAD
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
