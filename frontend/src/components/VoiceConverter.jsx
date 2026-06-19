import React, { useState, useEffect, useRef } from 'react'
import axios from 'axios'
import JSZip from 'jszip'
import VinylPlayer, { triggerDownload } from './VinylPlayer'

// How many documents to synthesize at once in bulk mode. Small enough to stay
// well under Sarvam's rate limits, large enough to cut wall-clock meaningfully.
const BULK_CONCURRENCY = 3

// Rough spoken-duration estimate from character count (~14 chars/sec at normal
// pace). Used as a pre-flight sanity signal so a mis-parsed/oversized document
// (e.g. one that would render 30+ minutes) is visible BEFORE spending on it.
function estimateDuration(chars) {
  const secs = Math.round(chars / 14)
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return m > 0 ? `~${m}m ${s}s` : `~${s}s`
}

// Rough wall-clock estimate to SYNTHESIZE a document: one TTS call per ~2400-char
// chunk at ~9s/call. Used to drive the per-document progress bar so the user can
// see whether a file is actually making progress.
function estimateProcessingSeconds(chars) {
  const chunks = Math.max(1, Math.ceil(chars / 2400))
  return Math.max(6, chunks * 9)
}

function fmtClock(totalSecs) {
  const m = Math.floor(totalSecs / 60)
  const s = Math.max(0, Math.floor(totalSecs % 60))
  return `${m}:${s < 10 ? '0' : ''}${s}`
}

export default function VoiceConverter({ apiKey, pendingText, workspace, showToast }) {
  const languages = {
    "en-IN": "English (India)",
    "hi-IN": "Hindi / हिन्दी",
    "ta-IN": "Tamil / தமிழ்",
    "te-IN": "Telugu / తెలుగు",
    "kn-IN": "Kannada / ಕನ್ನಡ",
    "ml-IN": "Malayalam / മലയാളം",
    "mr-IN": "Marathi / मराठी",
    "gu-IN": "Gujarati / ગુજરાતી",
    "pa-IN": "Punjabi / ਪੰਜਾਬੀ",
    "or-IN": "Odia / ଓଡ଼ିଆ",
    "bn-IN": "Bengali / বাংলা",
  }

  const voices = {
    "Male - Shubh (Recommended)": "shubh",
    "Male - Aditya": "aditya",
    "Male - Dev": "dev",
    "Male - Kabir": "kabir",
    "Male - Mani": "mani",
    "Male - Rohan": "rohan",
    "Male - Rahul": "rahul",
    "Male - Amit": "amit",
    "Male - Ratan": "ratan",
    "Male - Varun": "varun",
    "Male - Manan": "manan",
    "Male - Sumit": "sumit",
    "Male - Aayan": "aayan",
    "Male - Ashutosh": "ashutosh",
    "Male - Advait": "advait",
    "Male - Anand": "anand",
    "Male - Tarun": "tarun",
    "Male - Sunny": "sunny",
    "Male - Gokul": "gokul",
    "Male - Vijay": "vijay",
    "Male - Mohit": "mohit",
    "Female - Ritu (Recommended)": "ritu",
    "Female - Priya": "priya",
    "Female - Neha": "neha",
    "Female - Pooja": "pooja",
    "Female - Kavya": "kavya",
    "Female - Ishita": "ishita",
    "Female - Tanya": "tanya",
    "Female - Simran": "simran",
    "Female - Shreya": "shreya",
    "Female - Roopa": "roopa",
    "Female - Amelia": "amelia",
    "Female - Sophia": "sophia",
    "Female - Shruti": "shruti",
    "Female - Suhani": "suhani",
    "Female - Kavitha": "kavitha",
  }

  const presets = {
    "Instructional / Explainer": {"pace": 0.9, "desc": "Clear, measured delivery for presentation and explainer audio"},
    "Conversational": {"pace": 1.0, "desc": "Natural walkthrough tone"},
    "Professional / BFSI": {"pace": 1.1, "desc": "Crisp, authoritative delivery for formal training"},
    "Storytelling": {"pace": 0.9, "desc": "Warm, expressive narration"},
    "Custom": {"pace": 0.9, "desc": "Set your own parameters"},
  }

  const sampleTexts = {
    "en-IN": "Welcome to this tutorial. Today we'll explore how to create and manage your projects efficiently.",
    "hi-IN": "इस tutorial में आपका स्वागत है। आज हम देखेंगे कि आप अपने projects को कैसे efficiently manage कर सकते हैं।",
    "ta-IN": "இந்த பயிற்சியில் உங்களை வரவேற்கிறோம். இன்று நாம் திட்டங்களை எவ்வாறு திறமையாக நிர்வகிப்பது என்று காண்போம்.",
    "te-IN": "ఈ ట్యుటోరియల్‌కు స్వాగతం. నేడు మనం ప్రాజెక్టులను సమర్థవంతంగా నిర్వహించడం ఎలాగో నేర్చుకుంటాం.",
    "kn-IN": "ಈ ಟ್ಯುಟೋರಿಯಳಿಗೆ ಸ್ವಾಗತ. ಇಂದು ನಾವು ಪ್ರಾಜೆಕ್ಟ್‌ಗಳನ್ನು ಹೇಗೆ ಪರಿಣಾಮಕಾರಿಯಾಗಿ ನಿರ್ವಹಿಸಬೇಕು ಎಂದು ನೋಡೋಣ.",
    "ml-IN": "ഈ ട്യൂட்டோറിയലിലേക്ക് સ્વાഗതം. ഇന്ന് നമ്മൾ പ്രോജക്ടുകൾ എങ്ങനെ കാര്യക്ഷമമായി കൈകാര్యం ചെയ്യാം എന്ന് പഠിക്കും.",
    "mr-IN": "या tutorial मध्ये आपले स्वागत आहे. आज आपण projects कसे कार्यक्षमतेने व्यवस्थापित करायचे ते पाहू.",
    "gu-IN": "આ ટ્યુટોરીયલમાં આપનું સ્વાગત છે. આજે આપણે projects ને કેવી રીતે કાર્યક્ષમ રીતે manage કરવા તે જોઈશું.",
    "pa-IN": "ਇਸ tutorial ਵਿੱਚ ਤੁਹਾਡਾ ਸੁਆਗਤ ਹੈ। ਅੱਜ ਅਸੀਂ ਦੇਖਾਂਗੇ ਕਿ projects ਨੂੰ ਕੁਸ਼ਲਤਾ ਨਾਲ ਕਿਵੇਂ manage ਕਰਨਾ ਹੈ।",
    "or-IN": "ଏହି tutorial କୁ ସ୍ୱାଗତ। ଆଜି ଆମେ ଦେଖିବା କିପରି projects କୁ ଦକ୍ଷତାର ସହ manage କରାଯାଇପାରିବ।",
    "bn-IN": "এই টিউটোরিয়ালে আপনাকে স্বাগতম। আজ আমরা দেখব কীভাবে কার্যকরভাবে প্রজেক্টগুলি পরিচালনা করা যায়।",
  }

  // Preview States
  const [prevLang, setPrevLang] = useState('en-IN')
  const [prevVoice, setPrevVoice] = useState('Male - Shubh (Recommended)')
  const [prevPreset, setPrevPreset] = useState('Instructional / Explainer')
  const [prevPace, setPrevPace] = useState(0.9)
  const [prevSampleRate, setPrevSampleRate] = useState(24000)
  const [prevTemperature, setPrevTemperature] = useState(0.6)
  const [prevModel, setPrevModel] = useState('bulbul:v3')
  const [prevPitch, setPrevPitch] = useState(0.0)
  const [prevText, setPrevText] = useState('')
  const [prevAudioUrl, setPrevAudioUrl] = useState('')
  const [prevLoading, setPrevLoading] = useState(false)

  // Converter States
  const [inputText, setInputText] = useState('')
  const [fileName, setFileName] = useState('')
  
  const [convLang, setConvLang] = useState('en-IN')
  const [selectedSpeakers, setSelectedSpeakers] = useState(['Male - Shubh (Recommended)'])
  const [convPreset, setConvPreset] = useState('Instructional / Explainer')
  const [convPace, setConvPace] = useState(0.9)
  const [convSampleRate, setConvSampleRate] = useState(24000)
  const [convTemperature, setConvTemperature] = useState(0.6)
  const [convModel, setConvModel] = useState('bulbul:v3')
  const [convPitch, setConvPitch] = useState(0.0)
  const [paraPause, setParaPause] = useState(900)
  const [wantMp3, setWantMp3] = useState(true)

  const [loading, setLoading] = useState(false)
  const [progressMsg, setProgressMsg] = useState('')
  const [audios, setAudios] = useState({})

  // Bulk document conversion state ('single' = one script, 'bulk' = many files, one voice)
  const [convMode, setConvMode] = useState('single')
  const [bulkFiles, setBulkFiles] = useState([])        // [{ name, text, parseError }]
  const [bulkSpeaker, setBulkSpeaker] = useState('Male - Shubh (Recommended)')
  const [bulkResults, setBulkResults] = useState([])    // [{ name, status, audio, error }]
  const [bulkRunning, setBulkRunning] = useState(false)
  const [bulkProgress, setBulkProgress] = useState('')
  const [nowTick, setNowTick] = useState(0)   // ticks every second while a batch runs
  const [bulkIndex, setBulkIndex] = useState(0)  // which result is shown in the carousel

  // Active Pronunciation Dictionary State
  const [dictId, setDictId] = useState(null)

  // 1-second heartbeat so per-document elapsed timers/bars advance visibly.
  useEffect(() => {
    if (!bulkRunning) return
    const id = setInterval(() => setNowTick((t) => t + 1), 1000)
    return () => clearInterval(id)
  }, [bulkRunning])

  useEffect(() => {
    setPrevText(sampleTexts[prevLang])
  }, [prevLang])

  useEffect(() => {
    if (pendingText) {
      setInputText(pendingText)
    }
  }, [pendingText])

  // Resolve the shared pronunciation dictionary id for this API key from the
  // Sarvam cloud, so conversions apply the shared dict even if the user never
  // opened the Dictionary tab. Falls back to the local cache when offline.
  useEffect(() => {
    let cancelled = false
    const readLocalDictId = () => {
      try {
        const localData = localStorage.getItem(`sunai_dict_${workspace}`)
        const parsed = localData ? JSON.parse(localData) : null
        return parsed?.sarvam_dict_id || null
      } catch (err) {
        console.error(err)
        return null
      }
    }
    const resolveDictId = async () => {
      try {
        const response = await axios.post('/api/dictionary/load', { apiKey, workspace })
        if (!cancelled && response.data.success) {
          setDictId(response.data.dictionary_id || null)
          return
        }
      } catch (err) {
        console.error('Falling back to cached dict id:', err)
      }
      if (!cancelled) setDictId(readLocalDictId())
    }
    resolveDictId()
    return () => { cancelled = true }
  }, [workspace, apiKey])


  const handlePreviewPresetChange = (e) => {
    const key = e.target.value
    setPrevPreset(key)
    if (key !== 'Custom') {
      setPrevPace(presets[key].pace)
      setPrevTemperature(key === 'Professional / BFSI' ? 0.35 : 0.6)
      setPrevSampleRate(key === 'Conversational' ? 16000 : 24000)
    }
  }

  const handleConvPresetChange = (e) => {
    const key = e.target.value
    setConvPreset(key)
    if (key !== 'Custom') {
      setConvPace(presets[key].pace)
      setConvTemperature(key === 'Professional / BFSI' ? 0.35 : 0.6)
      setConvSampleRate(key === 'Conversational' ? 16000 : 24000)
    }
  }

  const handlePreviewSynth = async () => {
    if (!prevText.trim()) return

    setPrevLoading(true)
    setPrevAudioUrl('')

    try {
      const response = await axios.post('/api/convert-speech', {
        apiKey: apiKey,
        text: prevText,
        filename: 'preview.txt',
        langCode: prevLang,
        speakers: [prevVoice],
        pace: prevPace,
        temperature: prevTemperature,
        sampleRate: prevSampleRate,
        paraPauseMs: 0,
        wantMp3: true,
        model: prevModel,
        pitch: prevPitch,
        workspace: workspace,
        dictId: dictId
      })

      if (response.data.success) {
        const audioData = response.data.audios[prevVoice]
        if (audioData.error) {
          showToast(audioData.error, 'error')
        } else {
          setPrevAudioUrl(`data:audio/mp3;base64,${audioData.data}`)
          showToast('Preview track generated successfully!', 'success')
        }

        // Save usage log client-side
        if (response.data.usages && Array.isArray(response.data.usages)) {
          try {
            const existing = localStorage.getItem('sunai_usage_logs')
            const logs = existing ? JSON.parse(existing) : []
            logs.push(...response.data.usages)
            localStorage.setItem('sunai_usage_logs', JSON.stringify(logs))
          } catch (logErr) {
            console.error('Error logging preview usage client-side:', logErr)
          }
        }
      }
    } catch (err) {
      console.error(err)
      showToast('Preview synthesis failed.', 'error')
    } finally {
      setPrevLoading(false)
    }
  }


  const handleFileUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    setFileName(file.name)
    const formData = new FormData()
    formData.append('file', file)

    try {
      const response = await axios.post('/api/parse-file', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      })
      if (response.data.success) {
        setInputText(response.data.text)
      }
    } catch (err) {
      console.error(err)
      showToast(err.response?.data?.detail || 'Failed to parse the uploaded file.', 'error')
    }
  }

  const handleConvert = async () => {
    if (!inputText.trim()) {
      showToast('Please provide script content.', 'error')
      return
    }
    if (selectedSpeakers.length === 0) {
      showToast('Please select at least one speaker.', 'error')
      return
    }

    setLoading(true)
    setAudios({})
    setProgressMsg('Synthesizing audio tracks')

    try {
      const response = await axios.post('/api/convert-speech', {
        apiKey: apiKey,
        text: inputText,
        filename: fileName || 'script.txt',
        langCode: convLang,
        speakers: selectedSpeakers,
        pace: convPace,
        temperature: convTemperature,
        sampleRate: convSampleRate,
        paraPauseMs: paraPause,
        wantMp3: wantMp3,
        model: convModel,
        pitch: convPitch,
        workspace: workspace,
        dictId: dictId
      })

      if (response.data.success) {
        setAudios(response.data.audios)
        showToast('All speech audio tracks generated successfully!', 'success')

        // Save usage logs client-side
        if (response.data.usages && Array.isArray(response.data.usages)) {
          try {
            const existing = localStorage.getItem('sunai_usage_logs')
            const logs = existing ? JSON.parse(existing) : []
            logs.push(...response.data.usages)
            localStorage.setItem('sunai_usage_logs', JSON.stringify(logs))
          } catch (logErr) {
            console.error('Error logging convert usage client-side:', logErr)
          }
        }
      }
    } catch (err) {
      console.error(err)
      showToast(err.response?.data?.detail || 'Synthesis failed.', 'error')
    } finally {
      setLoading(false)
      setProgressMsg('')
    }
  }


  const downloadAllZip = async () => {
    const validAudios = Object.entries(audios).filter(([_, r]) => !r.error)
    if (validAudios.length === 0) return

    try {
      const zip = new JSZip()
      validAudios.forEach(([_, r]) => {
        zip.file(r.filename, r.data, { base64: true })
      })
      const blob = await zip.generateAsync({ type: 'blob' })
      triggerDownload(blob, 'sunai_audio_tracks.zip')
    } catch (err) {
      console.error('Failed to build zip archive:', err)
      showToast('Failed to package tracks into a zip.', 'error')
    }
  }

  // ── Bulk document conversion ──────────────────────────────────────────────
  const handleBulkFileUpload = async (e) => {
    const files = Array.from(e.target.files || [])
    if (!files.length) return

    const parsed = []
    for (const file of files) {
      const formData = new FormData()
      formData.append('file', file)
      try {
        const res = await axios.post('/api/parse-file', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        })
        parsed.push(res.data.success
          ? { name: file.name, text: res.data.text, parseError: null }
          : { name: file.name, text: '', parseError: 'Could not parse file.' })
      } catch (err) {
        parsed.push({ name: file.name, text: '', parseError: err.response?.data?.detail || 'Could not parse file.' })
      }
    }
    setBulkFiles((prev) => [...prev, ...parsed])
    setBulkResults([])
    e.target.value = '' // allow re-selecting the same files
  }

  const removeBulkFile = (idx) => {
    setBulkFiles(bulkFiles.filter((_, i) => i !== idx))
  }

  const handleBulkConvert = async () => {
    const valid = bulkFiles.filter((f) => !f.parseError && f.text.trim())
    if (valid.length === 0) {
      showToast('Add at least one readable script file.', 'error')
      return
    }
    if (!bulkSpeaker) {
      showToast('Select a voice for the batch.', 'error')
      return
    }

    setBulkRunning(true)
    const out = valid.map((f) => ({ name: f.name, chars: f.text.length, status: 'pending', audio: null, error: null, startedAt: null }))
    setBulkResults([...out])

    const total = valid.length
    let completed = 0
    let cursor = 0

    const convertOne = async (i) => {
      const f = valid[i]
      out[i] = { ...out[i], status: 'processing', startedAt: Date.now() }
      setBulkResults([...out])
      try {
        const response = await axios.post('/api/convert-speech', {
          apiKey: apiKey,
          text: f.text,
          filename: f.name,
          langCode: convLang,
          speakers: [bulkSpeaker],
          pace: convPace,
          temperature: convTemperature,
          sampleRate: convSampleRate,
          paraPauseMs: paraPause,
          wantMp3: wantMp3,
          model: convModel,
          pitch: convPitch,
          workspace: workspace,
          dictId: dictId
        }, { timeout: 240000 })
        if (response.data.success) {
          const r = response.data.audios[bulkSpeaker]
          out[i] = r?.error
            ? { ...out[i], status: 'error', error: r.error }
            : { ...out[i], status: 'done', audio: r }
          if (Array.isArray(response.data.usages)) {
            try {
              const existing = localStorage.getItem('sunai_usage_logs')
              const logs = existing ? JSON.parse(existing) : []
              logs.push(...response.data.usages)
              localStorage.setItem('sunai_usage_logs', JSON.stringify(logs))
            } catch (logErr) {
              console.error('Error logging bulk usage client-side:', logErr)
            }
          }
        } else {
          out[i] = { ...out[i], status: 'error', error: 'Synthesis failed.' }
        }
      } catch (err) {
        const msg = err.code === 'ECONNABORTED'
          ? 'Timed out — document may be too large; try splitting it.'
          : (err.response?.data?.detail || 'Synthesis failed.')
        out[i] = { ...out[i], status: 'error', error: msg }
      }
      completed += 1
      setBulkProgress(`Completed ${completed} / ${total}`)
      setBulkResults([...out])
    }

    // Process a few documents concurrently (bounded) so a batch finishes far
    // faster than strictly sequential, without hammering Sarvam's rate limits.
    const worker = async () => {
      while (cursor < total) {
        const i = cursor
        cursor += 1
        await convertOne(i)
      }
    }
    const lanes = Math.min(BULK_CONCURRENCY, total)
    await Promise.all(Array.from({ length: lanes }, () => worker()))

    setBulkRunning(false)
    setBulkProgress('')
    const okCount = out.filter((o) => o.status === 'done').length
    showToast(`Batch complete: ${okCount}/${total} tracks generated.`, okCount ? 'success' : 'error')
  }

  const downloadBulkZip = async () => {
    const done = bulkResults.filter((r) => r.status === 'done' && r.audio)
    if (done.length === 0) return
    try {
      const zip = new JSZip()
      const used = {}
      done.forEach((r) => {
        let name = r.audio.filename
        if (used[name]) {
          const dot = name.lastIndexOf('.')
          const base = dot === -1 ? name : name.slice(0, dot)
          const ext = dot === -1 ? '' : name.slice(dot)
          name = `${base}_${used[r.audio.filename]}${ext}`
        }
        used[r.audio.filename] = (used[r.audio.filename] || 0) + 1
        zip.file(name, r.audio.data, { base64: true })
      })
      const blob = await zip.generateAsync({ type: 'blob' })
      triggerDownload(blob, 'sunai_bulk_audio.zip')
    } catch (err) {
      console.error('Failed to build bulk zip:', err)
      showToast('Failed to package batch into a zip.', 'error')
    }
  }

  return (
    <div className="space-y-8 select-none">
      
      {/* Title */}
      <div className="flex flex-col">
        <h2 className="text-3xl font-black text-[#0c0c0e]">
          Voice <span className="grad-text">Converter</span>
        </h2>
        <p className="text-zinc-400 text-xs mt-1 font-bold uppercase tracking-wider">
          Perform speech synthesis with dual-voice options and pronunciation corrections
        </p>
      </div>

      {/* Preview Panel (Top) */}
      <div className="premium-card shadow-[4px_4px_0px_var(--accent-red)]">
        <h3 className="text-sm font-bold text-black mb-6 border-b border-[#1a1a1d] pb-4 uppercase tracking-wider">
          Premium Voice Preview
        </h3>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* STEP 01: Configure Preview Persona */}
          <div className="lg:col-span-5 border border-black p-5 bg-zinc-50/10 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 bg-black text-white flex items-center justify-center text-[10px] font-black shrink-0">01</span>
                  <span className="text-[10px] font-bold text-black uppercase tracking-wider">Configure Persona</span>
                </div>
                {dictId && (
                  <span className="geo-badge green text-[8px] tracking-wider animate-pulse">DICT ACTIVE</span>
                )}
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-[9px] font-bold text-zinc-500 uppercase tracking-wider mb-1">Language</label>
                  <select
                    className="form-input py-2 text-xs"
                    value={prevLang}
                    onChange={(e) => setPrevLang(e.target.value)}
                  >
                    {Object.entries(languages).map(([code, name]) => (
                      <option key={code} value={code}>{name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[9px] font-bold text-zinc-500 uppercase tracking-wider mb-1">Voice Persona</label>
                  <select
                    className="form-input py-2 text-xs"
                    value={prevVoice}
                    onChange={(e) => setPrevVoice(e.target.value)}
                  >
                    {Object.keys(voices).map((v) => (
                      <option key={v} value={v}>{v}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[9px] font-bold text-zinc-500 uppercase tracking-wider mb-1">Narrative Preset Style</label>
                  <select
                    className="form-input py-2 text-xs"
                    value={prevPreset}
                    onChange={handlePreviewPresetChange}
                  >
                    {Object.keys(presets).map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[9px] font-bold text-zinc-500 uppercase tracking-wider mb-1">Sample Rate (Quality)</label>
                  <select
                    className="form-input py-2 text-xs"
                    value={prevSampleRate}
                    onChange={(e) => {
                      setPrevSampleRate(parseInt(e.target.value))
                      setPrevPreset('Custom')
                    }}
                  >
                    <option value={8000}>8000 Hz (Low / Telephony)</option>
                    <option value={16000}>16000 Hz (Medium / Conversational)</option>
                    <option value={22050}>22050 Hz (High)</option>
                    <option value={24000}>24000 Hz (Recommended Default)</option>
                    <option value={32000}>32000 Hz (Ultra High)</option>
                    <option value={44100}>44100 Hz (CD Master)</option>
                    <option value={48000}>48000 Hz (Studio Master)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[9px] font-bold text-zinc-500 uppercase tracking-wider mb-1">Temperature (Creativity: {prevTemperature})</label>
                  <input
                    type="range"
                    min="0.01"
                    max="1.0"
                    step="0.05"
                    className="w-full h-2 bg-zinc-200 rounded-none appearance-none cursor-pointer mt-1"
                    value={prevTemperature}
                    onChange={(e) => {
                      setPrevTemperature(parseFloat(e.target.value))
                      setPrevPreset('Custom')
                    }}
                  />
                </div>

                <div>
                  <label className="block text-[9px] font-bold text-zinc-500 uppercase tracking-wider mb-1">Speech Model</label>
                  <select
                    className="form-input py-2 text-xs"
                    value={prevModel}
                    onChange={(e) => {
                      const m = e.target.value
                      setPrevModel(m)
                      if (m !== 'bulbul:v2') {
                        setPrevPitch(0.0)
                      }
                    }}
                  >
                    <option value="bulbul:v3">bulbul:v3 (Recommended / High Quality)</option>
                    <option value="bulbul:v2">bulbul:v2 (Legacy / Supports Pitch)</option>
                  </select>
                </div>

                <div>
                  <label className={`block text-[9px] font-bold uppercase tracking-wider mb-1 ${prevModel === 'bulbul:v2' ? 'text-zinc-500' : 'text-zinc-300'}`}>
                    Pitch (Tone Adjustment: {prevPitch})
                  </label>
                  <input
                    type="range"
                    min="-0.75"
                    max="0.75"
                    step="0.05"
                    className={`w-full h-2 rounded-none appearance-none mt-1 ${prevModel === 'bulbul:v2' ? 'bg-zinc-200 cursor-pointer' : 'bg-zinc-100 cursor-not-allowed opacity-50'}`}
                    value={prevPitch}
                    disabled={prevModel !== 'bulbul:v2'}
                    onChange={(e) => setPrevPitch(parseFloat(e.target.value))}
                  />
                  {prevModel !== 'bulbul:v2' && (
                    <span className="text-[8px] text-zinc-400 block mt-1 uppercase tracking-wide">* Switch model to bulbul:v2 to enable pitch control</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* STEP 02: Enter Target Text & Synthesize */}
          <div className="lg:col-span-7 border border-black p-5 bg-zinc-50/10 space-y-4 flex flex-col justify-start">
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-5 h-5 bg-black text-white flex items-center justify-center text-[10px] font-black shrink-0">02</span>
                <span className="text-[10px] font-bold text-black uppercase tracking-wider">Enter Sample Text</span>
              </div>

              <div>
                <label className="block text-[9px] font-bold text-zinc-500 uppercase tracking-wider mb-1">Preview Segment</label>
                <textarea
                  className="form-input min-h-[90px] text-xs"
                  value={prevText}
                  onChange={(e) => setPrevText(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                <div>
                  <label className="block text-[9px] font-bold text-zinc-500 uppercase tracking-wider mb-1">Pace (Speed: {prevPace})</label>
                  <input
                    type="range"
                    min="0.5"
                    max="2.0"
                    step="0.05"
                    className="w-full h-2 bg-zinc-200 rounded-none appearance-none cursor-pointer mt-2"
                    value={prevPace}
                    onChange={(e) => {
                      setPrevPace(parseFloat(e.target.value))
                      setPrevPreset('Custom')
                    }}
                  />
                </div>
                <div className="bg-zinc-100 border border-zinc-300 p-2 text-center text-[9px] font-bold uppercase tracking-wider h-full flex items-center justify-center">
                  Preset Default: {presets[prevPreset].pace} speed
                </div>
              </div>
            </div>

            <button
              onClick={handlePreviewSynth}
              className="w-full py-3.5 btn-primary text-white flex items-center justify-center gap-2 text-xs mt-4 shrink-0"
              disabled={prevLoading}
            >
              {prevLoading ? 'Synthesizing...' : 'Generate Preview Audio'}
            </button>

            {/* Dedicated Audio Output Pane right under the button */}
            {prevAudioUrl && (
              <div className="mt-4 pt-4 border-t border-black w-full">
                <div className="max-w-md mx-auto w-full">
                  <VinylPlayer
                    src={prevAudioUrl}
                    filename={`preview_${voices[prevVoice]}.mp3`}
                    label={`Preview - ${prevVoice}`}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="premium-card">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6 border-b border-[#1a1a1d] pb-4">
          <h3 className="text-sm font-bold text-black uppercase tracking-wider">
            Document Audio Converter
          </h3>
          {/* Single / Bulk mode toggle */}
          <div className="inline-flex border border-black bg-white shadow-[2px_2px_0px_var(--border-geo)] self-start">
            {[['single', 'Single Script'], ['bulk', 'Bulk Documents']].map(([m, label]) => (
              <button
                key={m}
                type="button"
                onClick={() => setConvMode(m)}
                className={`px-4 py-1.5 text-[9px] font-black uppercase tracking-widest transition-all duration-150 ${
                  convMode === m ? 'bg-black text-white' : 'bg-white text-black hover:bg-zinc-100'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-8">

          {/* Uploader and Settings */}
          <div className="space-y-6">

            {/* STEP 01: Source Script */}
            <div className="border border-black p-5 bg-zinc-50/10 space-y-4">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 bg-black text-white flex items-center justify-center text-[10px] font-black shrink-0">01</span>
                <span className="text-[10px] font-bold text-black uppercase tracking-wider">
                  {convMode === 'single' ? 'Upload or Paste Script' : 'Upload Script Documents'}
                </span>
              </div>

              {convMode === 'single' ? (
                <>
                  <div className="border border-dashed border-black hover:bg-zinc-50 p-4 transition-all duration-200 text-center relative bg-white">
                    <input
                      type="file"
                      accept=".txt,.srt,.docx"
                      onChange={handleFileUpload}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    />
                    <div className="flex flex-col items-center justify-center pointer-events-none py-2">
                      <div className="text-black mb-1">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                        {fileName ? fileName : 'Upload Script file'}
                      </span>
                    </div>
                  </div>

                  <div>
                    <textarea
                      className="form-input min-h-[110px]"
                      value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                      placeholder="Or paste script directly here..."
                    />
                  </div>
                </>
              ) : (
                <>
                  <div className="border border-dashed border-black hover:bg-zinc-50 p-4 transition-all duration-200 text-center relative bg-white">
                    <input
                      type="file"
                      accept=".txt,.srt,.docx"
                      multiple
                      onChange={handleBulkFileUpload}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    />
                    <div className="flex flex-col items-center justify-center pointer-events-none py-2">
                      <div className="text-black mb-1">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                        Upload multiple scripts (.txt, .srt, .docx)
                      </span>
                      <span className="text-[9px] font-semibold text-zinc-400 uppercase tracking-wider mt-1">
                        Each document becomes its own audio file
                      </span>
                    </div>
                  </div>

                  {bulkFiles.length > 0 && (
                    <div className="border border-black bg-white divide-y divide-zinc-200 max-h-[180px] overflow-y-auto">
                      {bulkFiles.map((f, idx) => (
                        <div key={`${f.name}-${idx}`} className="flex items-center justify-between gap-3 px-3 py-2">
                          <div className="min-w-0">
                            <p className="text-[11px] font-bold text-black truncate">{f.name}</p>
                            <p className={`text-[8px] font-bold uppercase tracking-wider ${f.parseError ? 'text-red-600' : 'text-zinc-400'}`}>
                              {f.parseError ? f.parseError : `${f.text.length.toLocaleString()} chars · ${estimateDuration(f.text.length)} audio`}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeBulkFile(idx)}
                            className="text-[9px] font-black text-red-600 border border-red-600 px-2 py-1 hover:bg-red-50 uppercase tracking-wider shrink-0"
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-400">
                    {bulkFiles.length > 0
                      ? `${bulkFiles.filter((f) => !f.parseError && f.text.trim()).length} of ${bulkFiles.length} file(s) ready · ${estimateDuration(bulkFiles.filter((f) => !f.parseError).reduce((sum, f) => sum + f.text.length, 0))} total audio`
                      : 'No files added yet'}
                  </p>
                </>
              )}
            </div>

            {/* STEP 02: Voice settings */}
            <div className="border border-black p-5 bg-zinc-50/10 space-y-4">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 bg-black text-white flex items-center justify-center text-[10px] font-black shrink-0">02</span>
                <span className="text-[10px] font-bold text-black uppercase tracking-wider">Select Voice Options</span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[9px] font-bold text-zinc-500 uppercase tracking-wider mb-1">Select Language</label>
                  <select
                    className="form-input py-2 text-xs"
                    value={convLang}
                    onChange={(e) => setConvLang(e.target.value)}
                  >
                    {Object.entries(languages).map(([code, name]) => (
                      <option key={code} value={code}>{name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[9px] font-bold text-zinc-500 uppercase tracking-wider mb-1">Select Narrative Preset</label>
                  <select
                    className="form-input py-2 text-xs"
                    value={convPreset}
                    onChange={handleConvPresetChange}
                  >
                    {Object.keys(presets).map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[9px] font-bold text-zinc-500 uppercase tracking-wider mb-1">Pace (Speed: {convPace})</label>
                  <input
                    type="range"
                    min="0.5"
                    max="2.0"
                    step="0.05"
                    className="w-full h-2 bg-zinc-200 rounded-none appearance-none cursor-pointer mt-2"
                    value={convPace}
                    onChange={(e) => {
                      setConvPace(parseFloat(e.target.value))
                      setConvPreset('Custom')
                    }}
                  />
                </div>

                <div>
                  <label className="block text-[9px] font-bold text-zinc-500 uppercase tracking-wider mb-1">Temperature ({convTemperature})</label>
                  <input
                    type="range"
                    min="0.01"
                    max="1.0"
                    step="0.05"
                    className="w-full h-2 bg-zinc-200 rounded-none appearance-none cursor-pointer mt-2"
                    value={convTemperature}
                    onChange={(e) => {
                      setConvTemperature(parseFloat(e.target.value))
                      setConvPreset('Custom')
                    }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[9px] font-bold text-zinc-500 uppercase tracking-wider mb-1">Speech Model</label>
                  <select
                    className="form-input py-2 text-xs"
                    value={convModel}
                    onChange={(e) => {
                      const m = e.target.value
                      setConvModel(m)
                      if (m !== 'bulbul:v2') {
                        setConvPitch(0.0)
                      }
                    }}
                  >
                    <option value="bulbul:v3">bulbul:v3 (Recommended / High Quality)</option>
                    <option value="bulbul:v2">bulbul:v2 (Legacy / Supports Pitch)</option>
                  </select>
                </div>

                <div>
                  <label className={`block text-[9px] font-bold uppercase tracking-wider mb-1 ${convModel === 'bulbul:v2' ? 'text-zinc-500' : 'text-zinc-300'}`}>
                    Pitch (Tone: {convPitch})
                  </label>
                  <input
                    type="range"
                    min="-0.75"
                    max="0.75"
                    step="0.05"
                    className={`w-full h-2 rounded-none appearance-none mt-2 ${convModel === 'bulbul:v2' ? 'bg-zinc-200 cursor-pointer' : 'bg-zinc-100 cursor-not-allowed opacity-50'}`}
                    value={convPitch}
                    disabled={convModel !== 'bulbul:v2'}
                    onChange={(e) => setConvPitch(parseFloat(e.target.value))}
                  />
                  {convModel !== 'bulbul:v2' && (
                    <span className="text-[8px] text-zinc-400 block mt-1 uppercase tracking-wide">* Switch model to bulbul:v2 to enable pitch control</span>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-[9px] font-bold text-zinc-500 uppercase tracking-wider mb-1">Sample Rate (Quality)</label>
                <select
                  className="form-input py-2 text-xs"
                  value={convSampleRate}
                  onChange={(e) => {
                    setConvSampleRate(parseInt(e.target.value))
                    setConvPreset('Custom')
                  }}
                >
                  <option value={8000}>8000 Hz (Low / Telephony)</option>
                  <option value={16000}>16000 Hz (Medium / Conversational)</option>
                  <option value={22050}>22050 Hz (High)</option>
                  <option value={24000}>24000 Hz (Recommended Default)</option>
                  <option value={32000}>32000 Hz (Ultra High)</option>
                  <option value={44100}>44100 Hz (CD Master)</option>
                  <option value={48000}>48000 Hz (Studio Master)</option>
                </select>
              </div>

              {convMode === 'single' ? (
                <div>
                  <label className="block text-[9px] font-bold text-zinc-500 uppercase tracking-wider mb-1.5">Select Voice Speakers (Select Multiple)</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[160px] overflow-y-auto border border-black p-3 bg-white">
                    {Object.keys(voices).map((v) => {
                      const isSelected = selectedSpeakers.includes(v);
                      return (
                        <label
                          key={v}
                          className={`flex items-center gap-3 p-2 border cursor-pointer select-none transition-all duration-150 ${
                            isSelected
                              ? 'bg-zinc-50 border-black font-bold shadow-[1.5px_1.5px_0px_var(--border-geo)]'
                              : 'bg-white border-zinc-200 hover:border-zinc-400'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {
                              if (isSelected) {
                                setSelectedSpeakers(selectedSpeakers.filter((s) => s !== v));
                              } else {
                                setSelectedSpeakers([...selectedSpeakers, v]);
                              }
                            }}
                            className="w-3.5 h-3.5 rounded-none border-black text-black focus:ring-0 cursor-pointer"
                          />
                          <span className="text-[10px] text-black tracking-wide">{v}</span>
                        </label>
                      );
                    })}
                  </div>
                  <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-400 mt-1.5">Toggle checkboxes to select one or multiple speakers for batch exports.</p>
                </div>
              ) : (
                <div>
                  <label className="block text-[9px] font-bold text-zinc-500 uppercase tracking-wider mb-1.5">Batch Voice (one voice for all documents)</label>
                  <select
                    className="form-input py-2 text-xs"
                    value={bulkSpeaker}
                    onChange={(e) => setBulkSpeaker(e.target.value)}
                  >
                    {Object.keys(voices).map((v) => (
                      <option key={v} value={v}>{v}</option>
                    ))}
                  </select>
                  <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-400 mt-1.5">Every uploaded script is narrated in this single voice.</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[9px] font-bold text-zinc-500 uppercase tracking-wider mb-1">Paragraph Pause (ms)</label>
                  <input
                    type="number"
                    min="0"
                    max="2000"
                    step="100"
                    className="form-input text-xs py-1.5"
                    value={paraPause}
                    onChange={(e) => setParaPause(parseInt(e.target.value) || 0)}
                  />
                </div>

                <div className="flex flex-col justify-center">
                  <div className="flex items-center gap-2 mt-4">
                    <input
                      type="checkbox"
                      id="conv_want_mp3"
                      checked={wantMp3}
                      onChange={(e) => setWantMp3(e.target.checked)}
                      className="rounded-none text-black border-black focus:ring-0"
                    />
                    <label htmlFor="conv_want_mp3" className="text-[11px] font-bold uppercase tracking-wider text-slate-600 cursor-pointer">
                      Export in MP3 format
                    </label>
                  </div>
                </div>
              </div>
            </div>

            {/* STEP 03: Run Conversion */}
            <div className="border border-black p-5 bg-zinc-50/10 space-y-4">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 bg-black text-white flex items-center justify-center text-[10px] font-black shrink-0">03</span>
                <span className="text-[10px] font-bold text-black uppercase tracking-wider">Run Speech Conversion</span>
              </div>

              <button
                onClick={convMode === 'single' ? handleConvert : handleBulkConvert}
                className="w-full py-4 btn-primary text-white flex items-center justify-center gap-2 text-xs"
                disabled={convMode === 'single' ? loading : bulkRunning}
              >
                {(convMode === 'single' ? loading : bulkRunning) ? (
                  <>
                    <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>{convMode === 'single' ? `${progressMsg}...` : `${bulkProgress || 'Processing'}...`}</span>
                  </>
                ) : (
                  <span>{convMode === 'single' ? 'Generate Audio Tracks' : `Generate ${bulkFiles.filter((f) => !f.parseError && f.text.trim()).length || ''} Audio File(s)`}</span>
                )}
              </button>
            </div>

          </div>

          {/* Results Panel */}
          <div className="border border-black p-6 bg-zinc-50/10 flex flex-col justify-between min-h-[300px]">
            <div>
              <h4 className="text-sm font-bold text-black mb-4 border-b border-[#1a1a1d] pb-2 uppercase tracking-wider">Audio Output Results</h4>

              {convMode === 'single' ? (
                Object.keys(audios).length > 0 ? (
                  <div className="space-y-6 max-h-[360px] overflow-y-auto pr-1">
                    {Object.entries(audios).map(([label, r]) => {
                      if (r.error) {
                        return (
                          <div key={label} className="p-3 bg-red-50 border border-red-100 text-red-600 text-xs font-bold uppercase tracking-wider">
                            <strong>{label}:</strong> {r.error}
                          </div>
                        )
                      }

                      const audioSrc = `data:audio/${r.ext};base64,${r.data}`
                      return (
                        <div key={label} className="max-w-md mx-auto w-full">
                          <VinylPlayer
                            src={audioSrc}
                            filename={r.filename}
                            label={`${label} (${r.size_kb.toFixed(0)} KB)`}
                          />
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-20 text-zinc-400">
                    <div className="text-black mb-3">
                      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                      </svg>
                    </div>
                    <p className="text-[10px] font-bold uppercase tracking-wider">Audio players will appear here after generation.</p>
                  </div>
                )
              ) : (
                bulkResults.length > 0 ? (
                  <>
                    {(() => {
                      const total = bulkResults.length
                      const done = bulkResults.filter((r) => r.status === 'done').length
                      const failed = bulkResults.filter((r) => r.status === 'error').length
                      const processing = bulkResults.filter((r) => r.status === 'processing').length
                      const finished = done + failed
                      const queued = total - finished - processing
                      const pct = total ? Math.round((finished / total) * 100) : 0
                      return (
                        <div className="mb-5">
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[9px] font-black uppercase tracking-widest text-black">
                              {bulkRunning ? `Processing ${finished} / ${total}` : `Finished ${finished} / ${total}`}
                            </span>
                            <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-400">{pct}%</span>
                          </div>
                          <div className="w-full h-2.5 bg-zinc-200 border border-black overflow-hidden">
                            <div
                              className={`h-full transition-all duration-300 ${bulkRunning ? 'bg-black animate-pulse' : 'bg-black'}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-[8px] font-black uppercase tracking-wider">
                            <span className="text-emerald-600">{done} done</span>
                            {processing > 0 && <span className="text-zinc-600">{processing} synthesizing</span>}
                            {failed > 0 && <span className="text-red-600">{failed} failed</span>}
                            {queued > 0 && <span className="text-zinc-400">{queued} queued</span>}
                          </div>
                        </div>
                      )
                    })()}
                  <div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setBulkIndex((i) => Math.max(0, Math.min(i, bulkResults.length - 1) - 1))}
                        disabled={Math.min(bulkIndex, bulkResults.length - 1) === 0}
                        className="shrink-0 w-9 h-9 flex items-center justify-center border border-black bg-white hover:bg-zinc-100 disabled:opacity-30 disabled:cursor-not-allowed shadow-[2px_2px_0px_var(--border-geo)]"
                        aria-label="Previous document"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
                      </button>

                      <div className="flex-1 min-w-0">
                        {(() => {
                          const safeIdx = Math.min(bulkIndex, bulkResults.length - 1)
                          const r = bulkResults[safeIdx]
                          if (!r) return null
                          if (r.status === 'done' && r.audio) {
                            const audioSrc = `data:audio/${r.audio.ext};base64,${r.audio.data}`
                            return (
                              <div className="max-w-md mx-auto w-full">
                                <div className="flex items-center justify-center gap-2 mb-1.5">
                                  <span className="text-[8px] font-black text-emerald-600 bg-emerald-50 border border-emerald-300 px-1.5 py-0.5 uppercase tracking-wider">✓ Ready</span>
                                  <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider truncate">{r.name}</span>
                                </div>
                                <VinylPlayer
                                  src={audioSrc}
                                  filename={r.audio.filename}
                                  label={`${r.name} (${r.audio.size_kb.toFixed(0)} KB)`}
                                />
                              </div>
                            )
                          }
                          if (r.status === 'error') {
                            return (
                              <div className="p-4 bg-red-50 border border-red-100 text-red-600 text-xs font-bold uppercase tracking-wider text-center">
                                <strong>{r.name}:</strong> {r.error}
                              </div>
                            )
                          }
                          if (r.status === 'processing') {
                            const elapsed = r.startedAt ? (Date.now() - r.startedAt) / 1000 : 0
                            const est = estimateProcessingSeconds(r.chars || 0)
                            const pct = Math.min(95, Math.round((elapsed / est) * 100))
                            return (
                              <div className="p-4 border border-black bg-white shadow-[2px_2px_0px_var(--border-geo)]">
                                <div className="flex items-center justify-between gap-3 mb-2">
                                  <span className="text-[11px] font-bold text-black truncate">{r.name}</span>
                                  <span className="flex items-center gap-1.5 text-[8px] font-black uppercase tracking-wider shrink-0 text-black">
                                    <svg className="animate-spin h-3 w-3 text-black" fill="none" viewBox="0 0 24 24">
                                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Synthesizing…
                                  </span>
                                </div>
                                <div className="w-full h-1.5 bg-zinc-200 overflow-hidden">
                                  <div className="h-full bg-black transition-all duration-500" style={{ width: `${pct}%` }} />
                                </div>
                                <div className="flex items-center justify-between mt-1 text-[8px] font-bold uppercase tracking-wider text-zinc-400">
                                  <span>{fmtClock(elapsed)} elapsed</span>
                                  <span>~{fmtClock(est)} est</span>
                                </div>
                              </div>
                            )
                          }
                          return (
                            <div className="flex items-center justify-between gap-3 p-4 border border-zinc-200 bg-white">
                              <span className="text-[11px] font-bold truncate text-zinc-400">{r.name}</span>
                              <span className="text-[8px] font-black uppercase tracking-wider shrink-0 text-zinc-400">Queued</span>
                            </div>
                          )
                        })()}
                      </div>

                      <button
                        type="button"
                        onClick={() => setBulkIndex((i) => Math.min(bulkResults.length - 1, Math.min(i, bulkResults.length - 1) + 1))}
                        disabled={Math.min(bulkIndex, bulkResults.length - 1) >= bulkResults.length - 1}
                        className="shrink-0 w-9 h-9 flex items-center justify-center border border-black bg-white hover:bg-zinc-100 disabled:opacity-30 disabled:cursor-not-allowed shadow-[2px_2px_0px_var(--border-geo)]"
                        aria-label="Next document"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                      </button>
                    </div>

                    {/* Index + clickable status dots */}
                    <div className="flex flex-col items-center gap-2 mt-3">
                      <span className="text-[9px] font-black uppercase tracking-widest text-zinc-400">
                        {Math.min(bulkIndex, bulkResults.length - 1) + 1} / {bulkResults.length}
                      </span>
                      <div className="flex flex-wrap items-center justify-center gap-1.5 max-w-full">
                        {bulkResults.map((rr, di) => {
                          const active = di === Math.min(bulkIndex, bulkResults.length - 1)
                          const color = rr.status === 'done' ? 'bg-emerald-500'
                            : rr.status === 'error' ? 'bg-red-500'
                            : rr.status === 'processing' ? 'bg-black animate-pulse'
                            : 'bg-zinc-300'
                          return (
                            <button
                              key={di}
                              type="button"
                              onClick={() => setBulkIndex(di)}
                              className={`w-2.5 h-2.5 ${color} ${active ? 'ring-2 ring-black ring-offset-1' : ''}`}
                              aria-label={`Go to ${rr.name}`}
                              title={rr.name}
                            />
                          )
                        })}
                      </div>
                    </div>
                  </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center py-20 text-zinc-400">
                    <div className="text-black mb-3">
                      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                      </svg>
                    </div>
                    <p className="text-[10px] font-bold uppercase tracking-wider">Upload scripts and generate to see per-file audio here.</p>
                  </div>
                )
              )}
            </div>

            {convMode === 'single' && Object.keys(audios).length > 1 && (
              <div className="pt-4 border-t border-[#1a1a1d] mt-6">
                <button
                  onClick={downloadAllZip}
                  className="w-full py-3.5 btn-primary text-white text-xs font-bold uppercase tracking-wider"
                >
                  Download All Tracks
                </button>
              </div>
            )}

            {convMode === 'bulk' && bulkResults.filter((r) => r.status === 'done').length > 1 && (
              <div className="pt-4 border-t border-[#1a1a1d] mt-6">
                <button
                  onClick={downloadBulkZip}
                  className="w-full py-3.5 btn-primary text-white text-xs font-bold uppercase tracking-wider"
                >
                  Download All ({bulkResults.filter((r) => r.status === 'done').length}) as ZIP
                </button>
              </div>
            )}
          </div>

        </div>
      </div>

    </div>
  )
}
