import React, { useState, useEffect, useRef } from 'react'
import axios from 'axios'

// ── Retro 90s Vinyl Record Player Component ──
function VinylPlayer({ src, filename, label }) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [currentTime, setCurrentTime] = useState('0:00')
  const [duration, setDuration] = useState('0:00')
  const audioRef = useRef(null)

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

  useEffect(() => {
    setIsPlaying(false)
    setProgress(0)
    setCurrentTime('0:00')
  }, [src])

  return (
    <div className="turntable-container select-none">
      <audio
        ref={audioRef}
        src={src}
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
            <span className="vinyl-subtext">LP</span>
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
            <a
              href={src}
              download={filename || 'track.mp3'}
              className="px-4 py-2 bg-white hover:bg-zinc-50 text-black text-[9px] font-black uppercase tracking-widest border border-black shadow-[2px_2px_0px_var(--accent-green)] transition-all duration-150 inline-block"
            >
              DOWNLOAD
            </a>
          )}
        </div>
      </div>
    </div>
  )
}

export default function CompletePipeline({ apiKey, workspace, showToast }) {
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

  const [inputText, setInputText] = useState('')
  const [fileName, setFileName] = useState('')
  const [fileExtension, setFileExtension] = useState('txt')
  
  const [pipelineLang, setPipelineLang] = useState('en-IN')
  const [selectedSpeakers, setSelectedSpeakers] = useState(['Male - Shubh (Recommended)'])
  const [pipelinePreset, setPipelinePreset] = useState('Instructional / Explainer')
  const [pipelinePace, setPipelinePace] = useState(0.9)
  const [paraPause, setParaPause] = useState(900)
  const [preserveSrt, setPreserveSrt] = useState(false)
  const [wantMp3, setWantMp3] = useState(true)

  const [pipelineSampleRate, setPipelineSampleRate] = useState(24000)
  const [pipelineTemperature, setPipelineTemperature] = useState(0.6)
  const [pipelineModel, setPipelineModel] = useState('bulbul:v3')
  const [pipelinePitch, setPipelinePitch] = useState(0.0)
  const [customPrompt, setCustomPrompt] = useState('')
  const [customPrompts, setCustomPrompts] = useState([])
  const [selectedPromptName, setSelectedPromptName] = useState('Default Sarvam Cookbook Editor')

  const [loading, setLoading] = useState(false)
  const [progressMsg, setProgressMsg] = useState('')
  const [dictId, setDictId] = useState(null)

  // Outputs
  const [cleanedText, setCleanedText] = useState('')
  const [warnings, setWarnings] = useState([])
  const [audios, setAudios] = useState({})

  useEffect(() => {
    const loadDictionary = () => {
      try {
        const localData = localStorage.getItem(`sunai_dict_${workspace}`)
        if (localData) {
          const parsed = JSON.parse(localData)
          if (parsed.sarvam_dict_id) {
            setDictId(parsed.sarvam_dict_id)
          } else {
            setDictId(null)
          }
        } else {
          setDictId(null)
        }
      } catch (err) {
        console.error(err)
      }
    }
    loadDictionary()
  }, [workspace])

  useEffect(() => {
    // Load custom prompts from localStorage
    const saved = localStorage.getItem('sunai_custom_prompts')
    if (saved) {
      try {
        setCustomPrompts(JSON.parse(saved))
      } catch (e) {
        console.error(e)
      }
    }
  }, [])


  const handleFileUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    setFileName(file.name)
    const ext = file.name.split('.').pop().toLowerCase()
    setFileExtension(ext)
    if (ext === 'srt') {
      setPreserveSrt(true)
    }

    const formData = new FormData()
    formData.append('file', file)

    try {
      const response = await axios.post('http://localhost:8000/api/parse-file', formData, {
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

  const handlePresetChange = (e) => {
    const key = e.target.value
    setPipelinePreset(key)
    if (key !== 'Custom') {
      setPipelinePace(presets[key].pace)
      setPipelineTemperature(key === 'Professional / BFSI' ? 0.35 : 0.6)
      setPipelineSampleRate(key === 'Conversational' ? 16000 : 24000)
    }
  }

  const handleRunPipeline = async () => {
    if (!inputText.trim()) {
      showToast('Please provide transcript/script content.', 'error')
      return
    }
    if (selectedSpeakers.length === 0) {
      showToast('Please select at least one speaker persona.', 'error')
      return
    }

    setLoading(true)
    setCleanedText('')
    setWarnings([])
    setAudios({})
    setProgressMsg('Processing automation pipeline')

    let promptContent = null
    if (selectedPromptName === 'Custom Formatting Prompt') {
      promptContent = customPrompt
    } else if (selectedPromptName !== 'Default Sarvam Cookbook Editor') {
      const match = customPrompts.find(p => p.name === selectedPromptName)
      if (match) {
        promptContent = match.content
      }
    }

    try {
      const response = await axios.post('http://localhost:8000/api/run-pipeline', {
        apiKey: apiKey,
        text: inputText,
        filename: fileName || 'script.txt',
        langCode: pipelineLang,
        speakers: selectedSpeakers,
        pace: pipelinePace,
        temperature: pipelineTemperature,
        sampleRate: pipelineSampleRate,
        paraPauseMs: paraPause,
        preserveSrt: preserveSrt,
        wantMp3: wantMp3,
        customPrompt: promptContent,
        model: pipelineModel,
        pitch: pipelinePitch,
        workspace: workspace,
        dictId: dictId
      })

      if (response.data.success) {
        setCleanedText(response.data.cleaned)
        setWarnings(response.data.warnings || [])
        setAudios(response.data.audios || {})

        // Save usage logs client-side
        if (response.data.usages && Array.isArray(response.data.usages)) {
          try {
            const existing = localStorage.getItem('sunai_usage_logs')
            const logs = existing ? JSON.parse(existing) : []
            logs.push(...response.data.usages)
            localStorage.setItem('sunai_usage_logs', JSON.stringify(logs))
          } catch (logErr) {
            console.error('Error logging pipeline usage client-side:', logErr)
          }
        }
        showToast('Automation pipeline executed successfully!', 'success')
      }
    } catch (err) {
      console.error(err)
      showToast(err.response?.data?.detail || 'Pipeline execution failed.', 'error')
    } finally {
      setLoading(false)
      setProgressMsg('')
    }
  }


  const downloadScript = () => {
    if (!cleanedText) return
    const mimeType = preserveSrt ? 'text/srt' : 'text/plain'
    const exportFileName = preserveSrt ? 'polished_pipeline_script.srt' : 'polished_pipeline_script.txt'
    const element = document.createElement("a")
    const file = new Blob([cleanedText], { type: mimeType })
    element.href = URL.createObjectURL(file)
    element.download = exportFileName
    document.body.appendChild(element)
    element.click()
    document.body.removeChild(element)
  }

  const downloadAllAudios = () => {
    const validAudios = Object.entries(audios).filter(([_, r]) => !r.error)
    if (validAudios.length === 0) return

    validAudios.forEach(([label, r]) => {
      const element = document.createElement("a")
      element.href = `data:audio/${r.ext};base64,${r.data}`
      element.download = r.filename
      document.body.appendChild(element)
      element.click()
      document.body.removeChild(element)
    })
  }

  return (
    <div className="space-y-8 select-none">
      
      {/* Title */}
      <div className="flex flex-col">
        <h2 className="text-3xl font-black text-[#0c0c0e]">
          Complete <span className="grad-text">Pipeline</span>
        </h2>
        <p className="text-zinc-400 text-xs mt-1 font-bold uppercase tracking-wider">
          Perform end-to-end optimization (105B LLM Script Polishing) & parallel high-fidelity speech synthesis
        </p>
      </div>

      <div className="flex flex-col gap-8">
        
        {/* Left Control Panel */}
        <div className="space-y-6">
          <div className="premium-card shadow-[4px_4px_0px_var(--accent-red)]">
            <h3 className="text-sm font-bold text-black mb-6 border-b border-[#1a1a1d] pb-4 uppercase tracking-wider">
              End-to-End Orchestrator
            </h3>

            <div className="space-y-6">
              
              {/* BLOCK 1: Source Script */}
              <div className="border border-black p-5 bg-zinc-50/10 space-y-4">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 bg-black text-white flex items-center justify-center text-[10px] font-black shrink-0">01</span>
                  <span className="text-[10px] font-bold text-black uppercase tracking-wider">Choose Source Text</span>
                </div>
                
                <div className="border border-dashed border-black hover:bg-zinc-50 p-4 transition-all duration-200 text-center relative bg-white">
                  <input
                    type="file"
                    accept=".txt,.srt,.docx"
                    onChange={handleFileUpload}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  />
                  <div className="flex flex-col items-center justify-center pointer-events-none py-1">
                    <div className="text-black mb-1">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                    </div>
                    <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                      {fileName ? fileName : 'Drag & drop transcript or browse'}
                    </span>
                  </div>
                </div>

                <div>
                  <textarea
                    className="form-input min-h-[110px]"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder="Or paste transcript/SRT block text here directly..."
                  />
                </div>

                <div className="space-y-3 pt-2">
                  <label className="block text-[9px] font-bold text-zinc-500 uppercase tracking-wider mb-0.5">
                    LLM Polishing Optimization Prompt
                  </label>
                  <select
                    className="form-input py-2 text-xs"
                    value={selectedPromptName}
                    onChange={(e) => setSelectedPromptName(e.target.value)}
                  >
                    <option value="Default Sarvam Cookbook Editor">Default Sarvam Cookbook Editor</option>
                    {customPrompts.map(p => (
                      <option key={p.name} value={p.name}>{p.name}</option>
                    ))}
                    <option value="Custom Formatting Prompt">Custom Formatting Prompt (One-time / Temp)</option>
                  </select>

                  {selectedPromptName === 'Custom Formatting Prompt' && (
                    <div className="pt-1">
                      <label className="block text-[9px] font-bold text-zinc-500 uppercase tracking-wider mb-1">Custom Instructions</label>
                      <textarea
                        className="form-input min-h-[80px] text-xs"
                        placeholder="Provide specific custom translation/polishing instructions..."
                        value={customPrompt}
                        onChange={(e) => setCustomPrompt(e.target.value)}
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* BLOCK 2: Voice Persona */}
              <div className="border border-black p-5 bg-zinc-50/10 space-y-4">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 bg-black text-white flex items-center justify-center text-[10px] font-black shrink-0">02</span>
                  <span className="text-[10px] font-bold text-black uppercase tracking-wider">Parallel Voice Settings</span>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[9px] font-bold text-zinc-500 uppercase tracking-wider mb-1">Language</label>
                    <select
                      className="form-input py-2 text-xs"
                      value={pipelineLang}
                      onChange={(e) => setPipelineLang(e.target.value)}
                    >
                      {Object.entries(languages).map(([code, name]) => (
                        <option key={code} value={code}>{name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[9px] font-bold text-zinc-500 uppercase tracking-wider mb-1">Presets</label>
                    <select
                      className="form-input py-2 text-xs"
                      value={pipelinePreset}
                      onChange={handlePresetChange}
                    >
                      {Object.keys(presets).map((p) => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[9px] font-bold text-zinc-500 uppercase tracking-wider mb-1">Pace (Speed: {pipelinePace})</label>
                    <input
                      type="range"
                      min="0.5"
                      max="2.0"
                      step="0.05"
                      className="w-full h-2 bg-zinc-200 rounded-none appearance-none cursor-pointer mt-1"
                      value={pipelinePace}
                      onChange={(e) => {
                        setPipelinePace(parseFloat(e.target.value))
                        setPipelinePreset('Custom')
                      }}
                    />
                  </div>

                  <div>
                    <label className="block text-[9px] font-bold text-zinc-500 uppercase tracking-wider mb-1">Temperature ({pipelineTemperature})</label>
                    <input
                      type="range"
                      min="0.01"
                      max="1.0"
                      step="0.05"
                      className="w-full h-2 bg-zinc-200 rounded-none appearance-none cursor-pointer mt-1"
                      value={pipelineTemperature}
                      onChange={(e) => {
                        setPipelineTemperature(parseFloat(e.target.value))
                        setPipelinePreset('Custom')
                      }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[9px] font-bold text-zinc-500 uppercase tracking-wider mb-1">Speech Model</label>
                    <select
                      className="form-input py-2 text-xs"
                      value={pipelineModel}
                      onChange={(e) => {
                        const m = e.target.value
                        setPipelineModel(m)
                        if (m !== 'bulbul:v2') {
                          setPipelinePitch(0.0)
                        }
                      }}
                    >
                      <option value="bulbul:v3">bulbul:v3 (Recommended / High Quality)</option>
                      <option value="bulbul:v2">bulbul:v2 (Legacy / Supports Pitch)</option>
                    </select>
                  </div>

                  <div>
                    <label className={`block text-[9px] font-bold uppercase tracking-wider mb-1 ${pipelineModel === 'bulbul:v2' ? 'text-zinc-500' : 'text-zinc-300'}`}>
                      Pitch (Tone: {pipelinePitch})
                    </label>
                    <input
                      type="range"
                      min="-0.75"
                      max="0.75"
                      step="0.05"
                      className={`w-full h-2 rounded-none appearance-none mt-1 ${pipelineModel === 'bulbul:v2' ? 'bg-zinc-200 cursor-pointer' : 'bg-zinc-100 cursor-not-allowed opacity-50'}`}
                      value={pipelinePitch}
                      disabled={pipelineModel !== 'bulbul:v2'}
                      onChange={(e) => setPipelinePitch(parseFloat(e.target.value))}
                    />
                    {pipelineModel !== 'bulbul:v2' && (
                      <span className="text-[8px] text-zinc-400 block mt-1 uppercase tracking-wide">* Switch model to bulbul:v2 to enable pitch control</span>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-[9px] font-bold text-zinc-500 uppercase tracking-wider mb-1">Sample Rate (Quality)</label>
                  <select
                    className="form-input py-2 text-xs"
                    value={pipelineSampleRate}
                    onChange={(e) => {
                      setPipelineSampleRate(parseInt(e.target.value))
                      setPipelinePreset('Custom')
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
                  <label className="block text-[9px] font-bold text-zinc-500 uppercase tracking-wider mb-1.5">Select Speaker Voice Personas (Select Multiple)</label>
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
                  <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-400 mt-1.5">Toggle checkboxes to select one or multiple speakers for automated dual conversions.</p>
                </div>
              </div>

              {/* BLOCK 3: Synthesis Tuning & Output Options */}
              <div className="border border-black p-5 bg-zinc-50/10 space-y-4">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 bg-black text-white flex items-center justify-center text-[10px] font-black shrink-0">03</span>
                  <span className="text-[10px] font-bold text-black uppercase tracking-wider">Tuning & Batch Export</span>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[9px] font-bold text-zinc-500 uppercase tracking-wider mb-1">Paragraph Pause (ms)</label>
                    <input
                      type="number"
                      className="form-input py-1.5 text-xs"
                      value={paraPause}
                      onChange={(e) => setParaPause(parseInt(e.target.value) || 0)}
                    />
                  </div>
                  
                  <div className="flex items-center gap-2 pt-4">
                    <input
                      type="checkbox"
                      id="pipeline_want_mp3"
                      checked={wantMp3}
                      onChange={(e) => setWantMp3(e.target.checked)}
                      className="rounded-none text-black border-black focus:ring-0"
                    />
                    <label htmlFor="pipeline_want_mp3" className="text-[11px] font-bold uppercase tracking-wider text-slate-600 cursor-pointer">
                      Export in MP3
                    </label>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="pipeline_preserve_srt"
                    checked={preserveSrt}
                    onChange={(e) => setPreserveSrt(e.target.checked)}
                    className="rounded-none text-black border-black focus:ring-0"
                  />
                  <label htmlFor="pipeline_preserve_srt" className="text-[11px] font-bold uppercase tracking-wider text-slate-600 cursor-pointer">
                    Preserve SRT file timestamp headers
                  </label>
                </div>

                {dictId && (
                  <div className="text-[9px] font-bold uppercase tracking-wider text-black bg-zinc-100 border border-zinc-300 p-2 text-center">
                    Active pronunciation dictionary applied automatically.
                  </div>
                )}
              </div>

              <button
                onClick={handleRunPipeline}
                className="w-full py-4 btn-primary text-white flex items-center justify-center gap-2 text-xs"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>{progressMsg}...</span>
                  </>
                ) : (
                  <span>Trigger Automated Pipeline</span>
                )}
              </button>

            </div>
          </div>
        </div>

        {/* Right Output Dashboard */}
        <div className="space-y-6">
          {cleanedText || Object.keys(audios).length > 0 ? (
            <div className="space-y-6">
              
              {/* Output Script Card */}
              <div className="premium-card flex flex-col justify-between shadow-[4px_4px_0px_var(--accent-red)]">
                <div>
                  <h4 className="text-xs font-bold text-black mb-4 pb-2 border-b border-black uppercase tracking-wider">
                    Optimized Script
                  </h4>
                  <textarea
                    className="form-input min-h-[300px] bg-zinc-50/10 font-medium text-xs leading-relaxed"
                    value={cleanedText}
                    onChange={(e) => setCleanedText(e.target.value)}
                  />
                  {warnings.length > 0 && (
                    <div className="mt-4 bg-zinc-50 border border-black p-3">
                      <h5 className="text-[9px] font-bold text-black uppercase mb-1">Quality Warning Insights</h5>
                      <ul className="text-[10px] text-zinc-600 font-semibold space-y-0.5 uppercase tracking-wider">
                        {warnings.map((w, idx) => <li key={idx}>• {w}</li>)}
                      </ul>
                    </div>
                  )}
                </div>
                
                <div className="mt-6 pt-4 border-t border-[#1a1a1d]">
                  <button
                    onClick={downloadScript}
                    className="w-full py-3 btn-secondary text-xs font-bold uppercase tracking-wider"
                  >
                    Download Polished Script
                  </button>
                </div>
              </div>

              {/* Output Audio Tracks Card */}
              <div className="premium-card flex flex-col justify-between shadow-[4px_4px_0px_var(--accent-red)]">
                <div>
                  <h4 className="text-xs font-bold text-black mb-4 pb-2 border-b border-black uppercase tracking-wider">
                    Generated Audios
                  </h4>
                  <div className="space-y-4 max-h-[380px] overflow-y-auto pr-1">
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
                </div>

                {Object.keys(audios).filter(([_, r]) => !r.error).length > 0 && (
                  <div className="mt-6 pt-4 border-t border-[#1a1a1d]">
                    <button
                      onClick={downloadAllAudios}
                      className="w-full py-3 btn-primary text-white text-xs font-bold uppercase tracking-wider shadow-[3px_3px_0px_var(--accent-red)]"
                    >
                      Batch Download All Tracks
                    </button>
                  </div>
                )}
              </div>

            </div>
          ) : (
            <div className="premium-card h-full flex flex-col justify-between p-8 border border-black shadow-[4px_4px_0px_var(--accent-red)] bg-white select-none">
              <div>
                <div className="flex items-center justify-between pb-4 border-b border-black mb-6">
                  <h4 className="text-xs font-bold text-black uppercase tracking-widest">Pipeline Blueprint Mapping</h4>
                  <span className="geo-badge red animate-pulse">SYSTEM IDLE</span>
                </div>
                
                {/* Visual Workflow Steps */}
                <div className="space-y-4">
                  <div className="bg-zinc-50 border border-black p-4 shadow-[2.5px_2.5px_0px_0px_rgba(0,0,0,1)] flex items-center justify-between hover:bg-white transition-all duration-150">
                    <div className="flex items-center gap-3">
                      <span className="w-5 h-5 bg-black text-white flex items-center justify-center text-[10px] font-black shrink-0 shadow-[1px_1px_0px_var(--accent-red)] border border-black">01</span>
                      <div>
                        <h5 className="text-[10px] font-bold text-black uppercase tracking-wider text-left">Semantic Script Polisher</h5>
                        <p className="text-[9px] text-zinc-400 mt-0.5 uppercase tracking-wide text-left">Sarvam-105B LLM optimized formatting</p>
                      </div>
                    </div>
                    <span className="text-[8px] font-bold text-[#ef4444] uppercase tracking-wider bg-red-50 border border-[#ef4444] px-2 py-0.5">READY</span>
                  </div>

                  <div className="flex justify-center py-1">
                    <svg className="w-4 h-4 text-zinc-400" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 13l-7 7-7-7m14-6l-7 7-7-7" />
                    </svg>
                  </div>

                  <div className="bg-zinc-50 border border-black p-4 shadow-[2.5px_2.5px_0px_0px_rgba(0,0,0,1)] flex items-center justify-between hover:bg-white transition-all duration-150">
                    <div className="flex items-center gap-3">
                      <span className="w-5 h-5 bg-black text-white flex items-center justify-center text-[10px] font-black shrink-0 shadow-[1px_1px_0px_var(--accent-red)] border border-black">02</span>
                      <div>
                        <h5 className="text-[10px] font-bold text-black uppercase tracking-wider text-left">Parallel Voice Dispatcher</h5>
                        <p className="text-[9px] text-zinc-400 mt-0.5 uppercase tracking-wide text-left">Multi-speaker target language audio paths</p>
                      </div>
                    </div>
                    <span className="text-[8px] font-bold text-[#ef4444] uppercase tracking-wider bg-red-50 border border-[#ef4444] px-2 py-0.5">READY</span>
                  </div>

                  <div className="flex justify-center py-1">
                    <svg className="w-4 h-4 text-zinc-400" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 13l-7 7-7-7m14-6l-7 7-7-7" />
                    </svg>
                  </div>

                  <div className="bg-zinc-50 border border-black p-4 shadow-[2.5px_2.5px_0px_0px_rgba(0,0,0,1)] flex items-center justify-between hover:bg-white transition-all duration-150">
                    <div className="flex items-center gap-3">
                      <span className="w-5 h-5 bg-black text-white flex items-center justify-center text-[10px] font-black shrink-0 shadow-[1px_1px_0px_var(--accent-red)] border border-black">03</span>
                      <div>
                        <h5 className="text-[10px] font-bold text-black uppercase tracking-wider text-left">Bulbul Synthesis Engine</h5>
                        <p className="text-[9px] text-zinc-400 mt-0.5 uppercase tracking-wide text-left">Parallel high-fidelity speech WAV/MP3 generation</p>
                      </div>
                    </div>
                    <span className="text-[8px] font-bold text-[#ef4444] uppercase tracking-wider bg-red-50 border border-[#ef4444] px-2 py-0.5">READY</span>
                  </div>
                </div>
              </div>

              {/* Status diagnostics grid */}
              <div className="grid grid-cols-3 gap-3 mt-6 pt-6 border-t border-black select-none text-center">
                <div className="bg-zinc-50 border border-zinc-200 p-2 flex flex-col justify-between">
                  <span className="text-[8px] font-bold text-zinc-400 uppercase tracking-widest leading-normal">Dict Profile</span>
                  <span className="text-[10px] font-extrabold text-black uppercase mt-1 leading-none">{dictId ? 'ACTIVE' : 'INACTIVE'}</span>
                </div>
                <div className="bg-zinc-50 border border-zinc-200 p-2 flex flex-col justify-between">
                  <span className="text-[8px] font-bold text-zinc-400 uppercase tracking-widest leading-normal">Target Latency</span>
                  <span className="text-[10px] font-extrabold text-[#ef4444] uppercase mt-1 leading-none">&lt; 180MS</span>
                </div>
                <div className="bg-zinc-50 border border-zinc-200 p-2 flex flex-col justify-between">
                  <span className="text-[8px] font-bold text-zinc-400 uppercase tracking-widest leading-normal">Parallel Synthesis</span>
                  <span className="text-[10px] font-extrabold text-[#10b981] uppercase mt-1 leading-none">ENABLED</span>
                </div>
              </div>
            </div>
          )}
        </div>

      </div>

    </div>
  )
}
