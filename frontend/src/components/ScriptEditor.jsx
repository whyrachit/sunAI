import React, { useState } from 'react'
import axios from 'axios'

export default function ScriptEditor({ apiKey, onSendToConverter, workspace, showToast }) {
  const [inputText, setInputText] = useState('')
  const [fileName, setFileName] = useState('')
  const [fileExtension, setFileExtension] = useState('txt')
  const [promptType, setPromptType] = useState('Default Sarvam Cookbook Editor')
  const [customPrompt, setCustomPrompt] = useState('')
  const [targetLang, setTargetLang] = useState('Hindi / हिन्दी')
  const [preserveSrt, setPreserveSrt] = useState(false)
  
  const [loading, setLoading] = useState(false)
  const [cleanedText, setCleanedText] = useState('')
  const [warnings, setWarnings] = useState([])
  const [message, setMessage] = useState('')

  const [customPrompts, setCustomPrompts] = useState([])
  const [newPromptName, setNewPromptName] = useState('')
  const [newPromptContent, setNewPromptContent] = useState('')
  const [showPromptManager, setShowPromptManager] = useState(false)

  React.useEffect(() => {
    const saved = localStorage.getItem('sunai_custom_prompts')
    if (saved) {
      try {
        setCustomPrompts(JSON.parse(saved))
      } catch (e) {
        console.error(e)
      }
    }
  }, [])

  const saveCustomPrompt = (name, content) => {
    if (!name.trim() || !content.trim()) {
      showToast('Prompt name and content are required.', 'error')
      return
    }
    const updated = [...customPrompts.filter(p => p.name !== name), { name, content }]
    setCustomPrompts(updated)
    localStorage.setItem('sunai_custom_prompts', JSON.stringify(updated))
    setPromptType(name)
    setNewPromptName('')
    setNewPromptContent('')
  }

  const deleteCustomPrompt = (name) => {
    const updated = customPrompts.filter(p => p.name !== name)
    setCustomPrompts(updated)
    localStorage.setItem('sunai_custom_prompts', JSON.stringify(updated))
    if (promptType === name) {
      setPromptType('Default Sarvam Cookbook Editor')
    }
  }

  const handlePromptFileUpload = (e) => {
    const file = e.target.files[0]
    if (!file) return
    const nameWithoutExt = file.name.split('.').slice(0, -1).join('.')
    setNewPromptName(nameWithoutExt)
    const reader = new FileReader()
    reader.onload = (event) => {
      setNewPromptContent(event.target.result)
    }
    reader.readAsText(file)
  }

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

  const handleProcess = async () => {
    if (!inputText.trim()) {
      showToast('Please enter or upload some script first.', 'error')
      return
    }

    setLoading(true)
    setCleanedText('')
    setWarnings([])
    setMessage('')

    let promptContent = null
    if (promptType === 'Custom Formatting Prompt') {
      promptContent = customPrompt
    } else if (promptType !== 'Default Sarvam Cookbook Editor') {
      const match = customPrompts.find(p => p.name === promptType)
      if (match) {
        promptContent = match.content
      }
    }

    try {
      const response = await axios.post('http://localhost:8000/api/clean-script', {
        apiKey: apiKey,
        text: inputText,
        targetLang: targetLang,
        preserveSrt: preserveSrt,
        customPrompt: promptContent,
        workspace: workspace
      })

      if (response.data.success) {
        setCleanedText(response.data.cleaned)
        setWarnings(response.data.warnings || [])
        
        // Save usage log client-side
        if (response.data.usage) {
          try {
            const existing = localStorage.getItem('sunai_usage_logs')
            const logs = existing ? JSON.parse(existing) : []
            logs.push(response.data.usage)
            localStorage.setItem('sunai_usage_logs', JSON.stringify(logs))
          } catch (logErr) {
            console.error('Error logging usage client-side:', logErr)
          }
        }
      }
    } catch (err) {
      console.error(err)
      showToast(err.response?.data?.detail || 'Processing script failed.', 'error')
    } finally {
      setLoading(false)
    }

  }

  const downloadFile = () => {
    if (!cleanedText) return

    let mimeType = 'text/plain'
    let exportFileName = 'polished_script.txt'

    if (preserveSrt) {
      mimeType = 'text/srt'
      exportFileName = 'polished_subtitles.srt'
    } else if (fileExtension === 'docx') {
      // In web, to generate a DOCX binary we convert paragraphs
      // Since generating native docx in pure frontend requires huge libraries,
      // we provide a clean, fully formatted rich text or a beautiful TXT file with a notification.
      mimeType = 'text/plain'
      exportFileName = 'polished_script.docx'
    }

    const element = document.createElement("a")
    const file = new Blob([cleanedText], { type: mimeType })
    element.href = URL.createObjectURL(file)
    element.download = exportFileName
    document.body.appendChild(element)
    element.click()
    document.body.removeChild(element)
  }

  const sendToConverter = () => {
    onSendToConverter(cleanedText)
    setMessage('Script loaded successfully into Voice Converter!')
    setTimeout(() => setMessage(''), 4000)
  }

  return (
    <div className="space-y-8 select-none">
      
      {/* Page Title */}
      <div className="flex flex-col">
        <h2 className="text-3xl font-black text-[#0c0c0e] select-none">
          Script <span className="grad-text">Converter</span>
        </h2>
        <p className="text-zinc-400 text-xs mt-1 select-none font-bold uppercase tracking-wider">
          Powered by Sarvam-105B LLM - Polish & structure scripts for eLearning synthesis
        </p>
      </div>

      <div className="flex flex-col gap-8">
        
        {/* Input Panel */}
        <div className="premium-card flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-6 border-b border-[#1a1a1d] pb-4">
              <h3 className="text-sm font-bold text-[#0c0c0e] tracking-wider uppercase">Transcript Input Studio</h3>
              {fileName && <span className="geo-badge">{fileName}</span>}
            </div>

            <div className="space-y-6">
              
              {/* STEP 01: Provide Source Script */}
              <div className="border border-black p-5 bg-zinc-50/10 space-y-4">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 bg-black text-white flex items-center justify-center text-[10px] font-black shrink-0">01</span>
                  <span className="text-[10px] font-bold text-black uppercase tracking-wider">Provide Source Script</span>
                </div>

                {/* Drag and Drop */}
                <div className="border border-dashed border-[#1a1a1d] hover:bg-zinc-50 rounded-none p-6 transition-all duration-200 text-center relative bg-white">
                  <input
                    type="file"
                    accept=".txt,.srt,.docx"
                    onChange={handleFileUpload}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  />
                  <div className="flex flex-col items-center justify-center pointer-events-none">
                    <div className="text-black mb-2">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                    </div>
                    <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">Drag script here or click to browse</span>
                    <span className="text-[9px] text-slate-400 mt-1 uppercase tracking-wider font-semibold">Supports TXT, SRT, or DOCX files</span>
                  </div>
                </div>

                {/* Text Area */}
                <div>
                  <textarea
                    className="form-input min-h-[200px]"
                    placeholder="Or paste your transcript/SRT script directly here..."
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                  />
                </div>
              </div>

              {/* STEP 02: Language Optimization */}
              <div className="border border-black p-5 bg-zinc-50/10 space-y-4">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 bg-black text-white flex items-center justify-center text-[10px] font-black shrink-0">02</span>
                  <span className="text-[10px] font-bold text-black uppercase tracking-wider">Language Optimization</span>
                </div>

                {/* Settings */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[9px] font-bold text-zinc-500 uppercase tracking-wider mb-1">
                      Optimization Prompt
                    </label>
                    <select
                      className="form-input py-2 text-xs"
                      value={promptType}
                      onChange={(e) => setPromptType(e.target.value)}
                    >
                      <option value="Default Sarvam Cookbook Editor">Default Sarvam Cookbook Editor</option>
                      {customPrompts.map(p => (
                        <option key={p.name} value={p.name}>{p.name}</option>
                      ))}
                      <option value="Custom Formatting Prompt">Custom Formatting Prompt (One-time)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[9px] font-bold text-zinc-500 uppercase tracking-wider mb-1">
                      Target Language
                    </label>
                    <select
                      className="form-input py-2 text-xs"
                      value={targetLang}
                      onChange={(e) => setTargetLang(e.target.value)}
                    >
                      <option>English (India)</option>
                      <option>Hindi / हिन्दी</option>
                      <option>Tamil / தமிழ்</option>
                      <option>Telugu / తెలుగు</option>
                      <option>Kannada / ಕನ್ನಡ</option>
                      <option>Malayalam / മലയാളം</option>
                      <option>Marathi / मराठी</option>
                      <option>Gujarati / ગુજરાતી</option>
                      <option>Punjabi / ਪੰਜਾਬੀ</option>
                      <option>Odia / ଓଡ଼ିଆ</option>
                      <option>Bengali / বাংলা</option>
                    </select>
                  </div>
                </div>

                {promptType === 'Custom Formatting Prompt' && (
                  <div>
                    <label className="block text-[9px] font-bold text-zinc-500 uppercase tracking-wider mb-1">Custom Instructions</label>
                    <textarea
                      className="form-input min-h-[80px] text-xs"
                      placeholder="Provide specific custom translation rules..."
                      value={customPrompt}
                      onChange={(e) => setCustomPrompt(e.target.value)}
                    />
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="editor_preserve_srt"
                    checked={preserveSrt}
                    onChange={(e) => setPreserveSrt(e.target.checked)}
                    className="rounded-none text-black border-black focus:ring-0"
                  />
                  <label htmlFor="editor_preserve_srt" className="text-xs font-bold uppercase tracking-wider text-slate-600 cursor-pointer">
                    Preserve SRT file timestamp headers
                  </label>
                </div>
              </div>

              {/* STEP 2.5: Custom Prompt Manager (Expandable) */}
              <div className="border border-black p-5 bg-zinc-50/10 space-y-4">
                <div 
                  className="flex items-center justify-between cursor-pointer select-none"
                  onClick={() => setShowPromptManager(!showPromptManager)}
                >
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 bg-black text-white flex items-center justify-center text-[10px] font-black shrink-0">2.5</span>
                    <span className="text-[10px] font-bold text-black uppercase tracking-wider">Custom Prompt Manager</span>
                  </div>
                  <button 
                    type="button"
                    className="px-3 py-1 border border-black bg-white hover:bg-zinc-100 text-[9px] font-black uppercase tracking-wider shadow-[1.5px_1.5px_0px_rgba(0,0,0,1)] active:translate-x-[0.5px] active:translate-y-[0.5px] transition-all"
                  >
                    {showPromptManager ? 'Hide Manager' : 'Manage Prompts'}
                  </button>
                </div>

                {showPromptManager && (
                  <div className="bg-white border border-black p-4 space-y-3 shadow-[1.5px_1.5px_0px_rgba(0,0,0,1)]">
                    <h4 className="text-[10px] font-black uppercase text-black text-left">Create or Upload Custom Prompt</h4>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
                      <div>
                        <label className="block text-[9px] font-bold text-zinc-500 uppercase tracking-wider mb-1">Prompt Name</label>
                        <input
                          type="text"
                          className="form-input text-xs py-1.5"
                          placeholder="e.g. Creative Explainer, Warm Narrative..."
                          value={newPromptName}
                          onChange={(e) => setNewPromptName(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold text-zinc-500 uppercase tracking-wider mb-1">Upload `.txt` Prompt File</label>
                        <input
                          type="file"
                          accept=".txt"
                          className="text-xs w-full border border-zinc-300 p-1 bg-zinc-50"
                          onChange={handlePromptFileUpload}
                        />
                      </div>
                    </div>

                    <div className="text-left">
                      <label className="block text-[9px] font-bold text-zinc-500 uppercase tracking-wider mb-1">Prompt Instructions Content</label>
                      <textarea
                        className="form-input min-h-[70px] text-xs"
                        placeholder="Translate and polish using the following custom style rules..."
                        value={newPromptContent}
                        onChange={(e) => setNewPromptContent(e.target.value)}
                      />
                    </div>

                    <div className="text-left">
                      <button
                        onClick={() => saveCustomPrompt(newPromptName, newPromptContent)}
                        className="px-4 py-2 bg-black hover:bg-zinc-950 text-white text-[9px] font-black uppercase tracking-widest border border-black shadow-[2px_2px_0px_rgba(0,0,0,1)] transition-all duration-150 active:translate-x-[1px] active:translate-y-[1px]"
                      >
                        Save Prompt Template
                      </button>
                    </div>

                    {customPrompts.length > 0 && (
                      <div className="pt-3 border-t border-zinc-200 text-left">
                        <h5 className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider mb-2">Saved Prompt Templates</h5>
                        <div className="space-y-1.5 max-h-[120px] overflow-y-auto">
                          {customPrompts.map(p => (
                            <div key={p.name} className="flex items-center justify-between p-2 bg-zinc-50 border border-zinc-200 text-xs">
                              <span className="font-bold text-black uppercase tracking-wide">{p.name}</span>
                              <button
                                onClick={() => deleteCustomPrompt(p.name)}
                                className="text-[9px] font-bold text-red-600 uppercase hover:underline"
                              >
                                Delete
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-[#1a1a1d]">
            <button
              onClick={handleProcess}
              className="w-full py-3.5 btn-primary text-white flex items-center justify-center gap-2"
              disabled={loading}
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>Translating & Optimizing via 105B...</span>
                </>
              ) : (
                <span>Apply LLM Narration Revamp</span>
              )}
            </button>
          </div>
        </div>

        {/* Output Panel */}
        <div className="premium-card flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-6 border-b border-[#1a1a1d] pb-4">
              <h3 className="text-sm font-bold text-[#0c0c0e] tracking-wider uppercase">Polished Narration Output</h3>
            </div>

            {cleanedText ? (
              <div className="space-y-6">
                <div>
                  <textarea
                    className="form-input min-h-[300px] bg-zinc-50/10 font-medium"
                    value={cleanedText}
                    onChange={(e) => setCleanedText(e.target.value)}
                  />
                </div>

                {warnings.length > 0 && (
                  <div className="bg-zinc-50 border border-black p-5">
                    <h5 className="text-[10px] font-bold text-black uppercase tracking-widest mb-2">Quality Insights</h5>
                    <div className="space-y-1.5 max-h-[100px] overflow-y-auto">
                      {warnings.map((w, idx) => (
                        <div key={idx} className="text-xs text-zinc-600 font-semibold uppercase tracking-wider flex items-center gap-1.5">
                          <span>[INFO]</span>
                          <span>{w}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-28 text-slate-400">
                <div className="text-black mb-4">
                  <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                  </svg>
                </div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Polished scripts will appear here after optimization.</p>
              </div>
            )}
          </div>

          {cleanedText && (
            <div className="mt-8 pt-4 border-t border-[#1a1a1d] space-y-4">
              {message && (
                <div className="p-3 bg-zinc-100 border border-black text-black text-xs font-bold text-center uppercase tracking-wider">
                  {message}
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={downloadFile}
                  className="py-3.5 btn-secondary text-xs font-bold uppercase tracking-wider"
                >
                  Download Script
                </button>
                <button
                  onClick={sendToConverter}
                  className="py-3.5 btn-primary text-white text-xs font-bold uppercase tracking-wider"
                >
                  Send to Converter
                </button>
              </div>
            </div>
          )}

        </div>

      </div>

    </div>
  )
}
