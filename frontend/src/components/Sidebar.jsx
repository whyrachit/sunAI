import React, { useState } from 'react'

export default function Sidebar({ currentPage, setCurrentPage, username, onLogout, activeWorkspace, workspaces, onWorkspaceChange, onAddWorkspace }) {
  const [isOpen, setIsOpen] = useState(false)
  const [showWSModal, setShowWSModal] = useState(false)
  const [newWSName, setNewWSName] = useState('')

  const menuItems = [
    { id: 'script', label: 'Script Converter', icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    )},
    { id: 'voice', label: 'Voice Converter', icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
      </svg>
    )},
    { id: 'pipeline', label: 'Complete Pipeline', icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    )},
    { id: 'dictionary', label: 'Pronounce Dict', icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
    )},
    { id: 'usage', label: 'API Usage', icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    )},
    { id: 'help', label: 'Help & Guide', icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    )}
  ]

  return (
    <div className="w-[200px] curved-sidebar flex flex-col justify-between py-10 px-3 min-h-screen shrink-0 z-20">
      
      <div>
        {/* Brand/Logo Section with Mobile Toggle */}
        <div className={`flex items-center justify-between gap-3 px-2 select-none w-full ${isOpen ? 'mb-6' : 'mb-0'} md:mb-10`}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-black text-white flex items-center justify-center font-black text-base shadow-[2px_2px_0px_0px_var(--accent-red)] border border-black uppercase tracking-tighter shrink-0 select-none brand-crest">
              M
            </div>
            <div className="flex flex-col">
              <span className="text-lg font-black tracking-tighter text-[#0c0c0e] leading-none" style={{ fontFamily: 'var(--font-display)' }}>
                <span className="lowercase">sun</span><span className="text-[var(--accent-green)] uppercase">AI</span>
              </span>

              <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest leading-none mt-1">
                Maskali
              </span>
            </div>
          </div>

          {/* Toggle Button for mobile */}
          <button 
            onClick={() => setIsOpen(!isOpen)}
            className="md:hidden border-2 border-black p-1 hover:bg-zinc-100 focus:outline-none"
            aria-label="Toggle Navigation Menu"
          >
            {isOpen ? (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>

        {/* Menu Navigation Items */}
        <nav className={`space-y-2 select-none md:block ${isOpen ? 'block' : 'hidden'}`}>
          {menuItems.map((item) => {
            const isActive = currentPage === item.id
            return (
              <button
                key={item.id}
                onClick={() => {
                  setCurrentPage(item.id)
                  setIsOpen(false)
                }}
                className={`w-full flex items-center gap-2.5 px-3 py-3 rounded-none text-[10px] font-bold uppercase tracking-wider transition-all duration-200 border border-transparent ${
                  isActive 
                    ? 'bg-zinc-100 text-[#000000] border-l-4 border-l-[#000000] border-y-[#1a1a1d] border-r-[#1a1a1d] translate-x-1 font-bold' 
                    : 'text-[#6b6b76] hover:bg-zinc-50 hover:text-[#000000]'
                }`}
              >
                <span className={isActive ? 'text-[#000000]' : 'text-zinc-400'}>
                  {item.icon}
                </span>
                <span>{item.label}</span>
              </button>
            )
          })}
        </nav>
      </div>

      {/* Footer / Account section */}
      <div className={`border-t border-[#1a1a1d] pt-6 select-none md:flex flex-col gap-4 ${isOpen ? 'flex' : 'hidden'}`}>
        {/* Profile Card */}
        <div className="flex items-center gap-3 px-2">
          <div className="w-9 h-9 border border-black bg-black flex items-center justify-center text-white font-black text-xs shrink-0 shadow-[2px_2px_0px_var(--accent-red)]">
            {username.substring(0, 2).toUpperCase()}
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-xs font-black text-[#0c0c0e] truncate">{username}</span>
            <span className="text-[8px] font-bold text-zinc-400 uppercase tracking-wider">Active User Profile</span>
          </div>
        </div>

        {/* Workspace selector container */}
        <div className="flex flex-col gap-1 px-2">
          <span className="text-[8px] font-black text-zinc-400 uppercase tracking-widest">Active Workspace</span>
          <select
            value={activeWorkspace}
            onChange={(e) => {
              if (e.target.value === 'ADD_NEW') {
                setShowWSModal(true)
              } else {
                onWorkspaceChange(e.target.value)
              }
            }}
            className="w-full py-2 px-2 text-[10px] bg-white border border-black focus:outline-none uppercase font-black tracking-wider shadow-[2px_2px_0px_rgba(0,0,0,1)] hover:translate-y-[-1px] hover:shadow-[3px_3px_0px_var(--accent-green)] transition-all duration-150 cursor-pointer"
          >
            {workspaces.map((ws) => (
              <option key={ws} value={ws}>{ws}</option>
            ))}
            <option value="ADD_NEW">+ Create Workspace...</option>
          </select>
        </div>

        {/* Logout Button */}
        <div className="px-2 pt-1">
          <button
            onClick={onLogout}
            className="w-full py-2.5 text-center text-[9px] font-black text-black border border-black bg-white hover:bg-zinc-50 transition-all duration-150 uppercase tracking-widest shadow-[2px_2px_0px_var(--accent-red)] hover:translate-y-[-1px] hover:shadow-[3px_3px_0px_var(--accent-red)] active:translate-y-[1px]"
          >
            Disconnect Session
          </button>
        </div>
      </div>

      {showWSModal && (
        <div className="fixed inset-0 bg-black/45 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border-2 border-black max-w-sm w-full p-6 shadow-[4px_4px_0px_0px_var(--border-geo)]">
            <h3 className="text-base font-black text-[#0c0c0e] mb-1">Create Workspace</h3>
            <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider mb-4">Set up a new isolated workspace</p>
            
            <input 
              type="text" 
              placeholder="Workspace Name (e.g. Science Lab)" 
              value={newWSName}
              onChange={(e) => setNewWSName(e.target.value)}
              className="w-full padding-3 border border-black text-xs font-semibold focus:outline-none focus:shadow-[2px_2px_0px_var(--accent-green)] transition-all mb-4 px-2 py-2.5"
              autoFocus
            />

            <div className="flex justify-end gap-3">
              <button 
                onClick={() => {
                  setShowWSModal(false)
                  setNewWSName('')
                }}
                className="px-3 py-1.5 text-[10px] font-bold border border-black hover:bg-zinc-50 uppercase tracking-wider"
              >
                Cancel
              </button>
              <button 
                onClick={() => {
                  const trimmed = newWSName.trim()
                  if (trimmed) {
                    onAddWorkspace(trimmed)
                  }
                  setShowWSModal(false)
                  setNewWSName('')
                }}
                className="px-3 py-1.5 text-[10px] font-bold bg-black text-white border border-black hover:bg-zinc-800 uppercase tracking-wider shadow-[2px_2px_0px_var(--accent-green)]"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
