import React, { useState, useEffect, useRef } from 'react'
import Login from './components/Login'
import Sidebar from './components/Sidebar'
import ScriptEditor from './components/ScriptEditor'
import VoiceConverter from './components/VoiceConverter'
import CompletePipeline from './components/CompletePipeline'
import Dictionary from './components/Dictionary'
import HelpGuide from './components/HelpGuide'
import UsageDashboard from './components/UsageDashboard'

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [username, setUsername] = useState('')
  const [apiKey, setApiKey] = useState('')
  
  const [toast, setToast] = useState(null)
  const toastTimeoutRef = useRef(null)

  const showToast = (message, type = 'info') => {
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current)
    }
    setToast({ message, type })
    toastTimeoutRef.current = setTimeout(() => {
      setToast(null)
    }, 4500)
  }

  
  const [currentPage, setCurrentPage] = useState('script')
  const [pendingText, setPendingText] = useState('')
  const [showIntro, setShowIntro] = useState(false)
  const [introStep, setIntroStep] = useState(0)

  const [activeWorkspace, setActiveWorkspace] = useState('Default Workspace')
  const [workspaces, setWorkspaces] = useState(['Default Workspace'])

  // Load session from localStorage on mount
  useEffect(() => {
    const savedUser = localStorage.getItem('sunai_username')
    const savedKey = localStorage.getItem('sunai_apikey')
    if (savedUser && savedKey) {
      setUsername(savedUser)
      setApiKey(savedKey)
      setIsAuthenticated(true)
      
      const introDismissed = localStorage.getItem('sunai_intro_dismissed')
      if (!introDismissed) {
        setShowIntro(true)
      }
    }

    const savedWS = localStorage.getItem('sunai_workspaces')
    const savedActiveWS = localStorage.getItem('sunai_active_workspace')
    if (savedWS) {
      try {
        let list = JSON.parse(savedWS)
        list = list.filter(w => w !== 'Autodesk Studio' && w !== 'sunAI Studio')
        if (list.length === 0) list = ['Default Workspace']
        setWorkspaces(list)
        localStorage.setItem('sunai_workspaces', JSON.stringify(list))
      } catch (e) {
        console.error(e)
      }
    }
    if (savedActiveWS) {
      if (savedActiveWS === 'Autodesk Studio' || savedActiveWS === 'sunAI Studio') {
        setActiveWorkspace('Default Workspace')
        localStorage.setItem('sunai_active_workspace', 'Default Workspace')
      } else {
        setActiveWorkspace(savedActiveWS)
      }
    }
  }, [])

  const handleWorkspaceChange = (newWS) => {
    setActiveWorkspace(newWS)
    localStorage.setItem('sunai_active_workspace', newWS)
  }

  const handleAddWorkspace = (name) => {
    const trimmed = name.trim()
    if (!trimmed) return
    if (workspaces.includes(trimmed)) return
    const updated = [...workspaces, trimmed]
    setWorkspaces(updated)
    localStorage.setItem('sunai_workspaces', JSON.stringify(updated))
    handleWorkspaceChange(trimmed)
  }

  const handleLoginSuccess = (user, key) => {
    setUsername(user)
    setApiKey(key)
    setIsAuthenticated(true)
    localStorage.setItem('sunai_username', user)
    localStorage.setItem('sunai_apikey', key)
    
    const introDismissed = localStorage.getItem('sunai_intro_dismissed')
    if (!introDismissed) {
      setShowIntro(true)
    }
  }

  const handleLogout = () => {
    setIsAuthenticated(false)
    setUsername('')
    setApiKey('')
    localStorage.removeItem('sunai_username')
    localStorage.removeItem('sunai_apikey')
    localStorage.removeItem('sunai_intro_dismissed')
    setShowIntro(false)
  }

  const handleSendToConverter = (text) => {
    setPendingText(text)
    setCurrentPage('voice')
  }

  const handleNavChange = (page) => {
    if (page !== 'voice') {
      setPendingText('') 
    }
    setCurrentPage(page)
  }

  const handleDismissIntro = () => {
    setShowIntro(false)
    localStorage.setItem('sunai_intro_dismissed', 'true')
    setIntroStep(0)
  }

  return (
    <>
      {!isAuthenticated ? (
        <Login onLoginSuccess={handleLoginSuccess} />
      ) : (
        <div className="workspace-wrapper relative">
          
          {/* Dashboard Left Side Bar Navigation */}
          <Sidebar 
            currentPage={currentPage} 
            setCurrentPage={handleNavChange} 
            username={username} 
            onLogout={handleLogout} 
            activeWorkspace={activeWorkspace}
            workspaces={workspaces}
            onWorkspaceChange={handleWorkspaceChange}
            onAddWorkspace={handleAddWorkspace}
          />

          {/* Main Dashboard Screen View */}
          <main className="main-content">
            {currentPage === 'script' && (
              <ScriptEditor 
                apiKey={apiKey} 
                onSendToConverter={handleSendToConverter} 
                workspace={activeWorkspace}
                showToast={showToast}
              />
            )}
            {currentPage === 'voice' && (
              <VoiceConverter 
                apiKey={apiKey} 
                pendingText={pendingText} 
                workspace={activeWorkspace}
                showToast={showToast}
              />
            )}
            {currentPage === 'pipeline' && (
              <CompletePipeline 
                apiKey={apiKey} 
                workspace={activeWorkspace}
                showToast={showToast}
              />
            )}
            {currentPage === 'dictionary' && (
              <Dictionary 
                username={username} 
                apiKey={apiKey} 
                workspace={activeWorkspace}
                showToast={showToast}
              />
            )}
            {currentPage === 'help' && (
              <HelpGuide />
            )}
            {currentPage === 'usage' && (
              <UsageDashboard 
                activeWorkspace={activeWorkspace}
                workspaces={workspaces}
                onWorkspaceChange={handleWorkspaceChange}
                onAddWorkspace={handleAddWorkspace}
                showToast={showToast}
              />
            )}
          </main>


          {/* Compact Stepper Wizard Maskali Introduction Modal Overlay */}
          {showIntro && (
            <div className="fixed inset-0 bg-black/45 backdrop-blur-xs z-50 flex items-center justify-center p-4">
              <div className="bg-white border-2 border-black max-w-md w-full p-6 relative flex flex-col justify-between min-h-[380px] shadow-[4px_4px_0px_0px_var(--accent-green)]">
                
                {/* Header Row: Prevents Skip Tour and Progress Bar from clashing */}
                <div className="flex items-center justify-between gap-4 mt-1 mb-5">
                  {/* Progress Stepper indicator */}
                  <div className="flex items-center gap-1.5 flex-1 max-w-[200px]">
                    {[0, 1, 2, 3, 4].map((stepIdx) => (
                      <div 
                        key={stepIdx} 
                        className={`h-1.5 flex-1 transition-all duration-300 ${
                          stepIdx <= introStep ? 'bg-black' : 'bg-zinc-200'
                        }`}
                      />
                    ))}
                  </div>

                  {/* Close/Skip Button */}
                  <button 
                    onClick={handleDismissIntro}
                    className="text-[9px] font-black border border-black px-2.5 py-1 hover:bg-zinc-100 uppercase shrink-0"
                  >
                    Skip Tour
                  </button>
                </div>

                {/* Step Content */}
                <div className="flex-1 flex flex-col justify-center items-center py-2">
                  {introStep === 0 && (
                    <div className="text-center space-y-3">
                      <div className="mx-auto w-12 h-12 bg-black text-white flex items-center justify-center font-black text-2xl shadow-[2.5px_2.5px_0px_0px_var(--accent-red)] border border-black brand-crest">
                        M
                      </div>
                      <h2 className="text-lg font-black tracking-tight text-[#0c0c0e]">
                        Welcome to sunAI Studio
                      </h2>
                      <p className="text-[10px] text-zinc-400 font-bold tracking-wider uppercase">
                        Conversational Voice Assistant
                      </p>
                      <p className="text-xs text-zinc-600 leading-relaxed font-semibold">
                        I'm Maskali, your friendly pigeon guide! 🕊️ Let's take a quick 4-step tour to see how easily we can bring your text scripts to life with natural, premium voices.
                      </p>
                    </div>
                  )}

                  {introStep === 1 && (
                    <div className="text-center space-y-3">
                      <div className="geo-badge green text-[9px] mx-auto">Step 01 &bull; Script Converter</div>
                      <h3 className="text-base font-black text-black">
                        Clean & Polish Your Scripts
                      </h3>
                      <p className="text-xs text-zinc-600 leading-relaxed font-semibold">
                        Have raw transcripts or messy subtitle files? No worries! Our built-in intelligence cleans up speaker notes, fixes translations, and formats your text so it flows beautifully when spoken.
                      </p>
                    </div>
                  )}

                  {introStep === 2 && (
                    <div className="text-center space-y-3">
                      <div className="geo-badge green text-[9px] mx-auto">Step 02 &bull; Voice Converter</div>
                      <h3 className="text-base font-black text-black">
                        Create Beautiful Voice Tracks
                      </h3>
                      <p className="text-xs text-zinc-600 leading-relaxed font-semibold">
                        Convert your clean text into high-fidelity speech. Choose from multiple Indian languages and natural speaker personas, and fine-tune the speed and pauses to match your ideal tone.
                      </p>
                    </div>
                  )}

                  {introStep === 3 && (
                    <div className="text-center space-y-3">
                      <div className="geo-badge green text-[9px] mx-auto">Step 03 &bull; Complete Pipeline</div>
                      <h3 className="text-base font-black text-black">
                        One-Click Automation
                      </h3>
                      <p className="text-xs text-zinc-600 leading-relaxed font-semibold">
                        Short on time? Run both script polishing and voice generation at the same time! You can even generate multiple voice styles at once for easy batch downloads.
                      </p>
                    </div>
                  )}

                  {introStep === 4 && (
                    <div className="text-center space-y-3">
                      <div className="geo-badge green text-[9px] mx-auto">Step 04 &bull; Pronunciation Dictionary</div>
                      <h3 className="text-base font-black text-black">
                        Teach Me New Words!
                      </h3>
                      <p className="text-xs text-zinc-600 leading-relaxed font-semibold">
                        Have unique jargon, brand names, or tricky words? Map them to their exact phonetic spellings here, and the voice generator will pronounce them perfectly every single time.
                      </p>
                    </div>
                  )}
                </div>

                {/* Footer Controls */}
                <div className="flex gap-3 pt-4 border-t border-[#e4e4e7] mt-4 w-full justify-center">
                  {introStep > 0 ? (
                    <>
                      <button
                        onClick={() => setIntroStep(introStep - 1)}
                        className="flex-1 py-2 btn-secondary text-xs font-bold uppercase tracking-wider"
                      >
                        Back
                      </button>
                      <button
                        onClick={() => {
                          if (introStep < 4) {
                            setIntroStep(introStep + 1)
                          } else {
                            handleDismissIntro()
                          }
                        }}
                        className="flex-1 py-2 btn-primary text-white text-xs font-bold uppercase tracking-wider"
                      >
                        {introStep === 4 ? 'Enter Studio' : 'Next'}
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => setIntroStep(1)}
                      className="w-1/2 mx-auto py-2 btn-primary text-white text-xs font-bold uppercase tracking-wider"
                    >
                      Next
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
          
          {toast && (
            <div className={`fixed top-6 right-6 z-[999] p-4 border-2 border-black font-bold uppercase tracking-wider text-[10px] shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] animate-slide-in flex items-center justify-between gap-4 bg-white ${
              toast.type === 'error' ? 'border-red-500 shadow-[4px_4px_0px_var(--accent-red)]' :
              toast.type === 'success' ? 'border-emerald-500 shadow-[4px_4px_0px_var(--accent-green)]' :
              'border-black shadow-[4px_4px_0px_rgba(0,0,0,1)]'
            }`}>
              <div className="flex items-center gap-2">
                {toast.type === 'success' && <span className="text-emerald-600">● SUCCESS:</span>}
                {toast.type === 'error' && <span className="text-red-600">● ERROR:</span>}
                {toast.type === 'info' && <span className="text-blue-600">● INFO:</span>}
                <span className="text-black normal-case font-bold">{toast.message}</span>
              </div>
              <button 
                onClick={() => setToast(null)}
                className="font-black hover:text-zinc-600 border border-black px-1.5 py-0.5 text-[8px] bg-white cursor-pointer active:translate-x-[0.5px] active:translate-y-[0.5px]"
              >
                ✖
              </button>
            </div>
          )}

        </div>
      )}
    </>
  )
}

