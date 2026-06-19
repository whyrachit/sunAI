import React, { useState, useEffect } from 'react'
import axios from 'axios'

export default function Dictionary({ username, apiKey, workspace, showToast }) {
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

  const [entries, setEntries] = useState([])
  const [sarvamDictId, setSarvamDictId] = useState(null)
  const [lastSynced, setLastSynced] = useState(null)
  
  const [loading, setLoading] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [deleteTargetIndex, setDeleteTargetIndex] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterLang, setFilterLang] = useState('All')

  // Form states for adding/editing
  const [editingId, setEditingId] = useState(null) // index in array or null
  const [formLang, setFormLang] = useState('en-IN')
  const [formWord, setFormWord] = useState('')
  const [formPron, setFormPron] = useState('')

  const loadFromLocalCache = () => {
    try {
      const localData = localStorage.getItem(`sunai_dict_${workspace}`)
      if (localData) {
        const parsed = JSON.parse(localData)
        setEntries(parsed.entries || [])
        setSarvamDictId(parsed.sarvam_dict_id || null)
        setLastSynced(parsed.last_synced || null)
      } else {
        setEntries([])
        setSarvamDictId(null)
        setLastSynced(null)
      }
    } catch (err) {
      console.error(err)
    }
  }

  // The pronunciation dictionary is shared across everyone using the same Sarvam
  // API key (Sarvam stores it server-side per key). Load the cloud copy as the
  // source of truth; fall back to the local cache only if the cloud is offline.
  const loadDictionary = async () => {
    setLoading(true)
    try {
      const response = await axios.post('/api/dictionary/load', { apiKey, workspace })
      if (response.data.success) {
        const cloudEntries = response.data.entries || []
        const cloudId = response.data.dictionary_id || null
        setEntries(cloudEntries)
        setSarvamDictId(cloudId)
        const synced = cloudEntries.length ? lastSynced : null
        localStorage.setItem(`sunai_dict_${workspace}`, JSON.stringify({
          entries: cloudEntries,
          sarvam_dict_id: cloudId,
          last_synced: synced
        }))
      }
    } catch (err) {
      console.error(err)
      loadFromLocalCache()
      showToast('Cloud dictionary unavailable — showing local cache.', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadDictionary()
  }, [workspace, apiKey])

  const handleSaveLocal = (updatedEntries = entries) => {
    try {
      const dataToSave = {
        entries: updatedEntries,
        sarvam_dict_id: sarvamDictId,
        last_synced: lastSynced
      }
      localStorage.setItem(`sunai_dict_${workspace}`, JSON.stringify(dataToSave))
      return true
    } catch (err) {
      console.error(err)
      showToast('Failed to save entries locally.', 'error')
      return false
    }
  }

  const handleAddOrUpdate = (e) => {
    e.preventDefault()
    if (!formWord.trim() || !formPron.trim()) {
      showToast('Word and pronunciation spelling are required.', 'error')
      return
    }

    let updatedEntries = [...entries]

    if (editingId !== null) {
      // Update existing
      updatedEntries[editingId] = {
        language: formLang,
        word: formWord.trim(),
        pronunciation: formPron.trim()
      }
      setEditingId(null)
      showToast('Pronunciation entry modified.', 'success')
    } else {
      // Check duplicate
      const exists = entries.some(
        (entry) => entry.word.toLowerCase() === formWord.trim().toLowerCase() && entry.language === formLang
      )
      if (exists) {
        showToast('This word entry already exists for the selected language.', 'error')
        return
      }
      // Add new
      updatedEntries.push({
        language: formLang,
        word: formWord.trim(),
        pronunciation: formPron.trim()
      })
      showToast('New pronunciation entry added.', 'success')
    }

    setEntries(updatedEntries)
    setFormWord('')
    setFormPron('')
    
    // Auto-save local updates
    try {
      const dataToSave = {
        entries: updatedEntries,
        sarvam_dict_id: sarvamDictId,
        last_synced: lastSynced
      }
      localStorage.setItem(`sunai_dict_${workspace}`, JSON.stringify(dataToSave))
    } catch (err) {
      console.error(err)
    }
  }

  const handleEdit = (idx) => {
    const entry = entries[idx]
    setEditingId(idx)
    setFormLang(entry.language)
    setFormWord(entry.word)
    setFormPron(entry.pronunciation)
  }

  const handleDelete = (idx) => {
    setDeleteTargetIndex(idx)
  }

  const confirmDelete = () => {
    if (deleteTargetIndex === null) return
    const idx = deleteTargetIndex
    const updatedEntries = entries.filter((_, index) => index !== idx)
    setEntries(updatedEntries)
    showToast('Pronunciation entry deleted.', 'info')
    
    try {
      const dataToSave = {
        entries: updatedEntries,
        sarvam_dict_id: sarvamDictId,
        last_synced: lastSynced
      }
      localStorage.setItem(`sunai_dict_${workspace}`, JSON.stringify(dataToSave))
    } catch (err) {
      console.error(err)
    } finally {
      setDeleteTargetIndex(null)
    }
  }


  const handleUploadCloud = async () => {
    if (entries.length === 0) {
      showToast('Please add some vocabulary entries to upload.', 'error')
      return
    }

    setSyncing(true)
    try {
      const response = await axios.post('/api/dictionary/upload', {
        apiKey: apiKey,
        entries: entries,
        workspace: workspace,
        oldDictId: sarvamDictId
      })

      if (response.data.success) {
        const cloudId = response.data.dictionary_id
        const syncedTime = response.data.last_synced
        setSarvamDictId(cloudId)
        setLastSynced(syncedTime)
        
        const dataToSave = {
          entries: entries,
          sarvam_dict_id: cloudId,
          last_synced: syncedTime
        }
        localStorage.setItem(`sunai_dict_${workspace}`, JSON.stringify(dataToSave))
        
        showToast(`Published! This dictionary is now live for everyone using this API key.`, 'success')
      }
    } catch (err) {
      console.error(err)
      showToast(err.response?.data?.detail || 'Cloud synchronization failed.', 'error')
    } finally {
      setSyncing(false)
    }
  }

  const exportDictionary = () => {
    if (entries.length === 0) return
    const dataStr = JSON.stringify({ entries, sarvamDictId, lastSynced }, null, 2)
    const blob = new Blob([dataStr], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `sunai_dictionary_${workspace.toLowerCase().replace(/ /g, '_')}.json`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    showToast('Dictionary exported successfully.', 'success')
  }

  const importDictionary = (e) => {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (evt) => {
      try {
        const parsed = JSON.parse(evt.target.result)
        if (parsed && Array.isArray(parsed.entries)) {
          setEntries(parsed.entries)
          const cloudId = parsed.sarvamDictId || null
          const syncedTime = parsed.lastSynced || null
          setSarvamDictId(cloudId)
          setLastSynced(syncedTime)
          
          const dataToSave = {
            entries: parsed.entries,
            sarvam_dict_id: cloudId,
            last_synced: syncedTime
          }
          localStorage.setItem(`sunai_dict_${workspace}`, JSON.stringify(dataToSave))
          showToast('Dictionary imported successfully!', 'success')
        } else {
          showToast('Invalid file format. Must contain entries array.', 'error')
        }
      } catch (err) {
        console.error(err)
        showToast('Failed to parse JSON file.', 'error')
      }
    }
    reader.readAsText(file)
  }

  // Filter and search
  const filteredEntries = entries.filter((entry) => {
    const matchesSearch = entry.word.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          entry.pronunciation.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesLang = filterLang === 'All' || entry.language === filterLang
    return matchesSearch && matchesLang
  })

  return (
    <div className="space-y-8 select-none">
      
      {/* Title */}
      <div className="flex flex-col">
        <h2 className="text-3xl font-black text-[#0c0c0e]">
          Pronunciation <span className="grad-text">Dictionary</span>
        </h2>
        <p className="text-zinc-400 text-xs mt-1 font-bold uppercase tracking-wider">
          Shared pronunciation rules for everyone using this Sarvam API key
        </p>
      </div>

      {/* Shared-scope notice */}
      <div className="bg-zinc-50 border border-black p-4 shadow-[2px_2px_0px_var(--border-geo)] flex items-start gap-3">
        <svg className="w-4 h-4 text-black mt-0.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-wider leading-relaxed">
          This dictionary is stored in the Sarvam cloud and <span className="text-black">shared by everyone who logs in with this API key</span>. Edits are local until you <span className="text-black">Publish</span> — publishing replaces the shared dictionary for all users on this key.
        </p>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white border border-black p-6 flex flex-col justify-between">
          <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Dictionary Entries</span>
          <span className="text-3xl font-extrabold text-black mt-2">{entries.length}</span>
        </div>

        <div className="bg-white border border-black p-6 flex flex-col justify-between relative shadow-[2px_2px_0px_var(--border-geo)]">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Shared Cloud Profile</span>
            {sarvamDictId ? (
              <span className="text-[8px] font-black text-emerald-600 bg-emerald-50 border border-emerald-300 px-1.5 py-0.5">PUBLISHED</span>
            ) : (
              <span className="text-[8px] font-black text-amber-600 bg-amber-50 border border-amber-300 px-1.5 py-0.5">NOT PUBLISHED</span>
            )}
          </div>

          <div className="mt-3 flex items-center gap-2 bg-zinc-50 border border-black px-3 py-1.5">
            <span className="text-xs font-bold text-black font-mono overflow-x-auto select-all truncate">
              {sarvamDictId ? sarvamDictId : 'Publish to create the shared profile'}
            </span>
          </div>
          <span className="text-[8px] font-bold text-zinc-400 uppercase tracking-wider mt-2 leading-relaxed">
            Auto-managed — one profile per API key. The ID changes each publish.
          </span>
        </div>

        <div className="bg-white border border-black p-6 flex flex-col justify-between">
          <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Last Published</span>
          <span className="text-xs font-bold text-zinc-500 mt-2 uppercase">
            {lastSynced ? lastSynced : 'Not published yet'}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Editor Form Panel */}
        <div className="lg:col-span-4 flex flex-col">
          <div className="premium-card h-full">
            <h3 className="text-sm font-bold text-black mb-6 border-b border-[#1a1a1d] pb-4 uppercase tracking-wider">
              {editingId !== null ? 'Modify Entry' : 'Add Vocabulary Entry'}
            </h3>

            <form onSubmit={handleAddOrUpdate} className="space-y-5">
              <div>
                <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-2">Language</label>
                <select
                  className="form-input py-2"
                  value={formLang}
                  onChange={(e) => setFormLang(e.target.value)}
                >
                  {Object.entries(languages).map(([code, name]) => (
                    <option key={code} value={code}>{name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-2">Target Word</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. cloud"
                  value={formWord}
                  onChange={(e) => setFormWord(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-2">Phonetic Spelling / Pronunciation</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. klaud"
                  value={formPron}
                  onChange={(e) => setFormPron(e.target.value)}
                />
                <p className="text-[9px] text-zinc-400 mt-1 uppercase tracking-wider font-bold">Specify phonetic spelling rules or sounds to guide synthesis accurately.</p>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-4">
                {editingId !== null && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingId(null)
                      setFormWord('')
                      setFormPron('')
                    }}
                    className="py-3 btn-secondary text-xs font-bold uppercase tracking-wider"
                  >
                    Cancel
                  </button>
                )}
                <button
                  type="submit"
                  className={`py-3 btn-primary text-white text-xs font-bold uppercase tracking-wider ${editingId === null ? 'col-span-2' : ''}`}
                >
                  {editingId !== null ? 'Apply Changes' : 'Save Vocabulary Entry'}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* List Dashboard Panel */}
        <div className="lg:col-span-8 flex flex-col">
          <div className="premium-card flex flex-col h-full justify-between">
            <div>
              {/* Header with search */}
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-4 border-b border-[#1a1a1d] mb-6">
                <h3 className="text-sm font-bold text-black uppercase tracking-wider">Tabular Vocabulary List</h3>
                
                <div className="flex flex-wrap items-center gap-3">
                  <input
                    type="text"
                    className="form-input py-1.5 px-3 text-xs w-[150px]"
                    placeholder="Search entries..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                  <select
                    className="form-input py-1.5 px-3 text-xs w-[130px]"
                    value={filterLang}
                    onChange={(e) => setFilterLang(e.target.value)}
                  >
                    <option value="All">All Languages</option>
                    {Object.entries(languages).map(([code, name]) => (
                      <option key={code} value={code}>{name.split(' / ')[0]}</option>
                    ))}
                  </select>

                  <button
                    onClick={exportDictionary}
                    disabled={entries.length === 0}
                    className="px-2.5 py-1.5 border border-black hover:bg-zinc-100 text-[10px] font-black uppercase tracking-wider flex items-center gap-1 shadow-[1.5px_1.5px_0px_rgba(0,0,0,1)] disabled:opacity-50"
                  >
                    Export JSON
                  </button>

                  <label className="px-2.5 py-1.5 border border-black hover:bg-zinc-100 text-[10px] font-black uppercase tracking-wider flex items-center gap-1 shadow-[1.5px_1.5px_0px_rgba(0,0,0,1)] cursor-pointer">
                    Import JSON
                    <input
                      type="file"
                      accept=".json"
                      onChange={importDictionary}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              {/* Table list */}
              {loading ? (
                <div className="text-center py-20 text-slate-400 text-xs font-semibold uppercase tracking-wider">
                  Loading Dictionary Entries...
                </div>
              ) : filteredEntries.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-[#1a1a1d]">
                    <thead>
                      <tr className="bg-zinc-50">
                        <th className="px-6 py-3 text-left text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Language</th>
                        <th className="px-6 py-3 text-left text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Word</th>
                        <th className="px-6 py-3 text-left text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Pronunciation Guide</th>
                        <th className="px-6 py-3 text-right text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#e4e4e7] text-xs font-bold">
                      {filteredEntries.map((entry, idx) => (
                        <tr key={idx} className="hover:bg-zinc-50/50">
                          <td className="px-6 py-4 whitespace-nowrap text-zinc-500 uppercase">
                            {languages[entry.language]?.split(' / ')[0] || entry.language}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-[#0c0c0e]">
                            {entry.word}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap font-mono text-zinc-800 bg-zinc-50 border border-zinc-200">
                            {entry.pronunciation}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right space-x-3">
                            <button
                              onClick={() => handleEdit(idx)}
                              className="text-xs text-black border border-black px-2.5 py-1 hover:bg-zinc-100 uppercase tracking-wider"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDelete(idx)}
                              className="text-xs text-red-600 border border-red-600 px-2.5 py-1 hover:bg-red-50 uppercase tracking-wider"
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-20 text-zinc-400 flex flex-col items-center">
                  <div className="text-black mb-2">
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                  </div>
                  <p className="text-[10px] font-bold uppercase tracking-wider">No matching vocabulary entries.</p>
                </div>
              )}
            </div>

            {/* Sync bar */}
            {entries.length > 0 && (
              <div className="pt-6 border-t border-[#1a1a1d] mt-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <p className="text-[9px] font-bold text-zinc-400 max-w-md uppercase tracking-wider leading-relaxed">
                  Edits are saved locally as you go. Publishing replaces the shared cloud dictionary for this API key — every user on the key will use these rules after you publish.
                </p>
                <button
                  onClick={handleUploadCloud}
                  className="py-3.5 px-8 btn-primary text-white text-xs whitespace-nowrap"
                  disabled={syncing}
                >
                  {syncing ? 'Publishing to shared cloud...' : 'Publish to Shared Cloud'}
                </button>
              </div>
            )}
          </div>
        </div>

      </div>

      {deleteTargetIndex !== null && (
        <div className="fixed inset-0 bg-black/45 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border-2 border-black max-w-sm w-full p-6 shadow-[4px_4px_0px_0px_var(--border-geo)]">
            <h3 className="text-base font-black text-[#0c0c0e] mb-1">Delete Entry</h3>
            <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider mb-4">
              Are you sure you want to remove the pronunciation override for "{entries[deleteTargetIndex]?.word}"?
            </p>
            
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setDeleteTargetIndex(null)}
                className="px-3 py-1.5 text-[10px] font-bold border border-black hover:bg-zinc-50 uppercase tracking-wider"
              >
                Cancel
              </button>
              <button 
                onClick={confirmDelete}
                className="px-3 py-1.5 text-[10px] font-bold bg-red-600 text-white border border-black hover:bg-red-700 uppercase tracking-wider shadow-[2px_2px_0px_var(--accent-red)]"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
