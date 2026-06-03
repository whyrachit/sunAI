import React, { useState } from 'react'
import axios from 'axios'

export default function Login({ onLoginSuccess }) {
  const [username, setUsername] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  
  // Toggle between Maskali Story and Setup Guide on left panel
  const [showGuide, setShowGuide] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!username.trim() || !apiKey.trim()) {
      setError('Please fill in both fields.')
      return
    }

    setLoading(true)
    setError('')

    try {
      const response = await axios.post('http://localhost:8000/api/login', {
        username: username,
        apiKey: apiKey
      })

      if (response.data.success) {
        onLoginSuccess(username, apiKey)
      } else {
        setError('Connection failed. Please check your credentials.')
      }
    } catch (err) {
      console.error(err)
      setError(
        err.response?.data?.detail || 
        'Validation failed. Ensure backend server is running on port 8000.'
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-screen h-screen overflow-hidden flex flex-col md:flex-row bg-[#fbfbfa] relative select-none">
      
      {/* Subtle Geometric background line grid */}
      <div className="absolute inset-0 pointer-events-none select-none z-0 overflow-hidden">
        {/* Subtle horizontal grid lines */}
        <div className="absolute top-[20%] left-0 right-0 h-[1px] bg-black/[0.03]" />
        <div className="absolute top-[40%] left-0 right-0 h-[1px] bg-black/[0.03]" />
        <div className="absolute top-[60%] left-0 right-0 h-[1px] bg-black/[0.03]" />
        <div className="absolute top-[80%] left-0 right-0 h-[1px] bg-black/[0.03]" />
        
        {/* Subtle vertical grid lines */}
        <div className="absolute left-[20%] top-0 bottom-0 w-[1px] bg-black/[0.03]" />
        <div className="absolute left-[40%] top-0 bottom-0 w-[1px] bg-black/[0.03]" />
        <div className="absolute left-[60%] top-0 bottom-0 w-[1px] bg-black/[0.03]" />
        <div className="absolute left-[80%] top-0 bottom-0 w-[1px] bg-black/[0.03]" />

        {/* Slow floating geometric decorative lines for subtle motion */}
        <div className="absolute top-[15%] left-[25%] w-20 h-20 border border-black/[0.025] rounded-full animate-float pointer-events-none select-none z-0" style={{ animationDelay: '0s' }} />
        <div className="absolute bottom-[25%] right-[30%] w-28 h-28 border border-black/[0.025] animate-float pointer-events-none select-none z-0" style={{ animationDelay: '-3s' }} />
        <div className="absolute top-[55%] left-[10%] w-14 h-14 border border-black/[0.025] animate-float pointer-events-none select-none z-0" style={{ animationDelay: '-1.5s' }} />
        
        {/* Decorative thin border framing */}
        <div className="absolute inset-8 border border-black/[0.04]" />
      </div>

      {/* LEFT PANEL: 3D Flip Card Container (40% width) */}
      <div className="w-full md:w-[40%] h-1/2 md:h-full border-b border-black/10 md:border-b-0 md:border-r border-black/10 z-10 relative select-none perspective-container">
        <div className={`flip-card-inner ${showGuide ? 'flipped' : ''}`}>
          
          {/* FRONT SIDE: Maskali Story */}
          <div className="flip-card-front p-8 md:p-12 overflow-hidden bg-white border border-black/15">
            <div className="flex flex-col items-start">
              <div className="w-12 h-12 bg-black text-white flex items-center justify-center font-black text-2xl shadow-[3px_3px_0px_0px_var(--accent-red)] border border-black mb-6 select-none shrink-0 brand-crest">
                M
              </div>
              <h1 className="text-4xl font-black text-[#0c0c0e] select-none tracking-tighter leading-none">
                <span className="lowercase">sun</span><span className="text-[var(--accent-green)] uppercase">AI</span>
              </h1>
              <p className="text-[9px] font-bold text-zinc-400 mt-2 select-none tracking-widest uppercase">
                Maskali Conversational Voice Studio
              </p>
            </div>

            <div className="text-xs text-zinc-600 space-y-4 font-medium leading-relaxed text-justify border-y border-[#e4e4e7] py-6 my-auto max-h-[60%] overflow-y-auto pr-1">
              <p>
                Once upon a time in ancient courtyards, the trusty pigeon <span className="text-[#ef4444] font-black">Maskali</span> carried messages across kingdoms, bridging massive distances long before text messages existed.
              </p>
              <p>
                In that very spirit of keeping in touch, this studio gives your silent text a clear voice! We turn your words into clean, natural human speech that flies straight to your audience.
              </p>
              <p>
                We're here to help you spin stories, teach lessons, and make voiceovers that are actually pleasant to listen to. No pigeon feed required.
              </p>
            </div>

            <div className="pt-4 border-t border-[#1a1a1d]">
              <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest mb-1.5">Need setup credentials?</p>
              <button
                onClick={() => setShowGuide(true)}
                className="w-full py-3 btn-secondary text-xs font-bold tracking-wider text-center"
              >
                Learn how to obtain a Sarvam API Key
              </button>
            </div>
          </div>

          {/* BACK SIDE: Setup Instructions */}
          <div className="flip-card-back p-8 md:p-12 overflow-hidden bg-white border border-black/15">
            <div className="flex flex-col items-start shrink-0">
              <div className="flex items-center gap-2 mb-2 select-none">
                <span className="geo-badge green">GUIDE</span>
                <h3 className="text-sm font-bold tracking-widest text-[#0c0c0e]">
                  Obtain Sarvam API Key
                </h3>
              </div>
              <p className="text-[9px] text-zinc-400 select-none font-bold tracking-wider">
                Step-by-step instructions to get your credentials
              </p>
            </div>

            {/* Step cards grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left my-auto overflow-y-auto max-h-[70%] py-2 pr-1">
              
              <div className="bg-zinc-50 border border-black p-3 flex flex-col justify-between login-step-card shadow-[1.5px_1.5px_0px_0px_rgba(0,0,0,1)]">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="w-4 h-4 bg-black text-white flex items-center justify-center text-[9px] font-black shrink-0">01</span>
                  <span className="text-[7px] font-bold text-zinc-400 uppercase tracking-widest">dashboard</span>
                </div>
                <div>
                  <h5 className="text-[9px] font-bold text-black tracking-wider mb-0.5">Sarvam Dashboard</h5>
                  <p className="text-[8px] text-zinc-500 leading-normal normal-case font-semibold">
                    Visit <a href="https://dashboard.sarvam.ai" target="_blank" rel="noreferrer" className="text-black underline font-black">dashboard.sarvam.ai</a> in a browser.
                  </p>
                </div>
              </div>

              <div className="bg-zinc-50 border border-black p-3 flex flex-col justify-between login-step-card shadow-[1.5px_1.5px_0px_0px_rgba(0,0,0,1)]">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="w-4 h-4 bg-black text-white flex items-center justify-center text-[9px] font-black shrink-0">02</span>
                  <span className="text-[7px] font-bold text-zinc-400 uppercase tracking-widest">auth</span>
                </div>
                <div>
                  <h5 className="text-[9px] font-bold text-black tracking-wider mb-0.5">Create Account</h5>
                  <p className="text-[8px] text-zinc-500 leading-normal normal-case font-semibold">
                    Register a new developer account, or sign in if already verified.
                  </p>
                </div>
              </div>

              <div className="bg-zinc-50 border border-black p-3 flex flex-col justify-between login-step-card shadow-[1.5px_1.5px_0px_0px_rgba(0,0,0,1)]">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="w-4 h-4 bg-black text-white flex items-center justify-center text-[9px] font-black shrink-0">03</span>
                  <span className="text-[7px] font-bold text-zinc-400 uppercase tracking-widest">navigation</span>
                </div>
                <div>
                  <h5 className="text-[9px] font-bold text-black tracking-wider mb-0.5">API Keys Tab</h5>
                  <p className="text-[8px] text-zinc-500 leading-normal normal-case font-semibold">
                    Locate and click on the "API Keys" option in the left navigation menu.
                  </p>
                </div>
              </div>

              <div className="bg-zinc-50 border border-black p-3 flex flex-col justify-between login-step-card shadow-[1.5px_1.5px_0px_0px_rgba(0,0,0,1)]">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="w-4 h-4 bg-black text-white flex items-center justify-center text-[9px] font-black shrink-0">04</span>
                  <span className="text-[7px] font-bold text-zinc-400 uppercase tracking-widest">credentials</span>
                </div>
                <div>
                  <h5 className="text-[9px] font-bold text-black tracking-wider mb-0.5">Generate Token</h5>
                  <p className="text-[8px] text-zinc-500 leading-normal normal-case font-semibold">
                    Click the "Generate API Key" button. Enter "sunAI" name and confirm.
                  </p>
                </div>
              </div>

              <div className="bg-zinc-50 border border-black p-3 flex flex-col justify-between login-step-card shadow-[1.5px_1.5px_0px_0px_rgba(0,0,0,1)]">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="w-4 h-4 bg-black text-white flex items-center justify-center text-[9px] font-black shrink-0">05</span>
                  <span className="text-[7px] font-bold text-zinc-400 uppercase tracking-widest">clipboard</span>
                </div>
                <div>
                  <h5 className="text-[9px] font-bold text-black tracking-wider mb-0.5">Copy API Key</h5>
                  <p className="text-[8px] text-zinc-500 leading-normal normal-case font-semibold">
                    Copy generated token starting with <code className="bg-zinc-100 px-0.5 border border-zinc-200 text-black">sk_...</code>.
                  </p>
                </div>
              </div>

              <div className="bg-zinc-50 border border-black p-3 flex flex-col justify-between login-step-card shadow-[1.5px_1.5px_0px_0px_rgba(0,0,0,1)]">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="w-4 h-4 bg-black text-white flex items-center justify-center text-[9px] font-black shrink-0">06</span>
                  <span className="text-[7px] font-bold text-zinc-400 uppercase tracking-widest">billing</span>
                </div>
                <div>
                  <h5 className="text-[9px] font-bold text-black tracking-wider mb-0.5">Load Credits</h5>
                  <p className="text-[8px] text-zinc-500 leading-normal normal-case font-semibold">
                    Verify account balance has active developer credits under billing.
                  </p>
                </div>
              </div>

            </div>

            <div className="pt-4 border-t border-[#1a1a1d] shrink-0">
              <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest mb-1.5">Go back to branding?</p>
              <button
                onClick={() => setShowGuide(false)}
                className="w-full py-3 btn-primary text-white text-xs font-bold tracking-wider text-center shadow-[3px_3px_0px_var(--accent-red)] border border-black hover:bg-zinc-900"
              >
                View Maskali Pigeon Story
              </button>
            </div>
          </div>

        </div>
      </div>

      {/* RIGHT PANEL: Unscrollable Login form card (60% width) */}
      <div className="w-full md:w-[60%] h-1/2 md:h-full p-8 md:p-12 z-10 flex flex-col justify-center items-center relative">
        
        <div className="bg-white border border-black p-8 premium-card max-w-md w-full select-none shadow-[5px_5px_0px_0px_rgba(0,0,0,1)] hover:shadow-[5px_5px_0px_0px_var(--accent-red)] transition-all duration-300">
          
          <h3 className="text-sm font-bold text-center text-[#0c0c0e] mb-2 select-none tracking-widest uppercase">
            Enter Workspace
          </h3>
          <p className="text-[9px] text-zinc-400 text-center mb-6 select-none font-bold tracking-wider uppercase">
            Grounded in local languages. Rooted in intelligence.
          </p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-[9px] font-bold text-zinc-500 tracking-widest mb-1.5 select-none uppercase">
                Username
              </label>
              <input
                type="text"
                className="form-input text-xs"
                placeholder="e.g. Admin"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={loading}
              />
            </div>

            <div>
              <label className="block text-[9px] font-bold text-zinc-500 tracking-widest mb-1.5 select-none uppercase">
                Sarvam API Key
              </label>
              <input
                type="password"
                className="form-input text-xs"
                placeholder="sk_jzubiev5_..."
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                disabled={loading}
              />
              <p className="text-[8px] font-semibold text-zinc-400 mt-1 select-none tracking-wider uppercase">
                Enter your sk_ API token from the Sarvam console
              </p>
            </div>

            {error && (
              <div className="p-3.5 bg-red-50 border border-red-600 text-red-600 text-[10px] text-center font-bold tracking-wider uppercase">
                {error}
              </div>
            )}

            <button
              type="submit"
              className="w-full py-3.5 btn-primary text-white flex items-center justify-center gap-2 select-none text-xs font-bold tracking-wider shadow-[3px_3px_0px_var(--accent-red)] hover:shadow-[4px_4px_0px_var(--accent-red)]"
              disabled={loading}
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>Authenticating...</span>
                </>
              ) : (
                <span>Initialize Workspace</span>
              )}
            </button>
          </form>
          
        </div>
        
        <span className="text-[8px] font-bold text-zinc-400 tracking-widest mt-6 uppercase">
          secure credentials &bull; local storage encryption session
        </span>
      </div>

    </div>
  )
}
