import React, { useState, useEffect } from 'react'

export default function UsageDashboard({ activeWorkspace, workspaces, onWorkspaceChange, onAddWorkspace }) {
  const [logs, setLogs] = useState([])
  const [totalSpend, setTotalSpend] = useState(0)
  const [modelBreakdown, setModelBreakdown] = useState({})
  const [featureBreakdown, setFeatureBreakdown] = useState({})
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterFeature, setFilterFeature] = useState('All')
  const [hoveredPoint, setHoveredPoint] = useState(null)
  const [newWSInput, setNewWSInput] = useState('')
  const [showAddWSPanel, setShowAddWSPanel] = useState(false)
  const [showClearConfirm, setShowClearConfirm] = useState(false)

  const fetchUsageData = () => {
    setLoading(true)
    try {
      const localLogs = localStorage.getItem('sunai_usage_logs')
      const allLogs = localLogs ? JSON.parse(localLogs) : []
      
      // Filter logs by active workspace
      let logsForWorkspace = allLogs
      if (activeWorkspace && activeWorkspace !== 'All' && activeWorkspace !== 'All Workspaces') {
        logsForWorkspace = allLogs.filter(log => log.workspace === activeWorkspace)
      }
      
      // Calculate total spend
      const totalSpendVal = logsForWorkspace.reduce((acc, log) => acc + (log.cost_inr || 0), 0)
      
      // Breakdown by model
      const modelB = {}
      logsForWorkspace.forEach(log => {
        const m = log.model || 'unknown'
        modelB[m] = (modelB[m] || 0) + (log.cost_inr || 0)
      })

      // Breakdown by feature
      const featureB = {}
      logsForWorkspace.forEach(log => {
        const f = log.feature || 'unknown'
        featureB[f] = (featureB[f] || 0) + (log.cost_inr || 0)
      })

      setLogs(logsForWorkspace)
      setTotalSpend(totalSpendVal)
      setModelBreakdown(modelB)
      setFeatureBreakdown(featureB)
    } catch (err) {
      console.error('Error fetching local usage logs:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUsageData()
  }, [activeWorkspace])

  // Filter logs based on search term and selected feature type
  const filteredLogs = logs.filter((log) => {
    const term = searchTerm.toLowerCase()
    const matchesSearch = 
      log.model.toLowerCase().includes(term) ||
      (log.details && log.details.toLowerCase().includes(term)) ||
      log.feature.toLowerCase().includes(term)
    
    const matchesFeature = filterFeature === 'All' || log.feature.startsWith(filterFeature)
    return matchesSearch && matchesFeature
  })

  // Get unique features for filter dropdown
  const uniqueFeatures = Array.from(
    new Set(logs.map((log) => {
      if (log.feature.startsWith('TTS')) return 'TTS'
      if (log.feature.includes('Polishing')) return 'Polishing'
      return log.feature
    }))
  )

  // Color mapper for charts
  const getColor = (index) => {
    const colors = [
      'var(--accent-red, #ff5555)',
      'var(--accent-green, #50fa7b)',
      'var(--border-geo, #bd93f9)',
      '#ffb86c',
      '#8be9fd',
      '#ff79c6',
      '#f1fa8c'
    ]
    return colors[index % colors.length]
  }

  // --- SVG Chart Calculations ---
  // Group logs by day (YYYY-MM-DD)
  const dailyCosts = {}
  logs.forEach(log => {
    if (!log.timestamp) return
    const dateKey = log.timestamp.split('T')[0]
    dailyCosts[dateKey] = (dailyCosts[dateKey] || 0) + (log.cost_inr || 0)
  });

  // Sort dates chronologically
  const sortedDates = Object.keys(dailyCosts).sort()
  const chartData = sortedDates.map(date => ({
    date,
    cost: dailyCosts[date],
    formattedDate: new Date(date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })
  }))

  const paddingX = 60
  const paddingY = 40
  const chartWidth = 700
  const chartHeight = 250

  const maxCost = chartData.length > 0 ? Math.max(...chartData.map(d => d.cost)) * 1.15 : 10
  const minCost = 0

  const getX = (index) => {
    if (chartData.length <= 1) return paddingX + (chartWidth - 2 * paddingX) / 2
    return paddingX + (index / (chartData.length - 1)) * (chartWidth - 2 * paddingX)
  }

  const getY = (cost) => {
    const range = maxCost - minCost
    if (range === 0) return chartHeight - paddingY - (chartHeight - 2 * paddingY) / 2
    return chartHeight - paddingY - ((cost - minCost) / range) * (chartHeight - 2 * paddingY)
  }

  const points = chartData.map((d, idx) => `${getX(idx)},${getY(d.cost)}`)
  const linePath = chartData.length > 0 ? `M ${points.join(' L ')}` : ''
  const areaPath = chartData.length > 0 
    ? `${linePath} L ${getX(chartData.length - 1)},${chartHeight - paddingY} L ${getX(0)},${chartHeight - paddingY} Z` 
    : ''

  const handleCreateWorkspaceSubmit = (e) => {
    e.preventDefault()
    if (newWSInput.trim()) {
      onAddWorkspace(newWSInput.trim())
      setNewWSInput('')
      setShowAddWSPanel(false)
    }
  }

  const exportToCSV = () => {
    if (filteredLogs.length === 0) return
    const headers = ['Timestamp', 'Feature', 'Model', 'Volume', 'Details', 'Cost (INR)']
    const rows = filteredLogs.map(log => [
      log.timestamp,
      log.feature,
      log.model,
      log.characters > 0 ? `${log.characters} chars` : log.tokens > 0 ? `${log.tokens} tokens` : '',
      `"${(log.details || '').replace(/"/g, '""')}"`,
      log.cost_inr.toFixed(4)
    ])
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.setAttribute("href", url)
    link.setAttribute("download", `sunai_api_logs_${activeWorkspace}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const triggerClearLogs = () => {
    setShowClearConfirm(true)
  }

  const confirmClearLogs = () => {
    localStorage.removeItem('sunai_usage_logs')
    fetchUsageData()
    setShowClearConfirm(false)
  }

  return (
    <div className="space-y-8 select-none">
      
      {/* Title Section */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black text-[#0c0c0e]">
            API Usage & <span className="grad-text">Cost Analytics</span>
          </h2>
          <p className="text-zinc-400 text-xs mt-1 font-bold uppercase tracking-wider">
            Track real-time token spend, model expenses, and full audit logs in INR (Stored Client-Side)
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchUsageData}
            className="px-4 py-2 border border-black hover:bg-zinc-100 text-xs font-black uppercase tracking-wider flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
            </svg>
            Refresh
          </button>
        </div>
      </div>

      {/* Spend Highlight Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white border border-black p-6 flex flex-col justify-between shadow-[3px_3px_0px_var(--border-geo)]">
          <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Total Investment Spent</span>
          <span className="text-4xl font-black text-black mt-2">
            ₹{totalSpend.toFixed(4)}
          </span>
          <span className="text-[9px] font-bold text-emerald-600 mt-2 uppercase tracking-wide">
            ● Realtime Estimation (INR)
          </span>
        </div>

        <div className="bg-white border border-black p-6 flex flex-col justify-between">
          <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Total Actions Recorded</span>
          <span className="text-4xl font-black text-black mt-2">{logs.length}</span>
          <span className="text-[9px] font-bold text-zinc-400 mt-2 uppercase tracking-wide">
            Syntheses, Optimizations, & Translations
          </span>
        </div>

        <div className="bg-white border border-black p-6 flex flex-col justify-between">
          <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Active Workspace</span>
          <span className="text-xl font-black text-[#0c0c0e] mt-3 uppercase tracking-wide">
            {activeWorkspace}
          </span>
          <select
            value={activeWorkspace}
            onChange={(e) => onWorkspaceChange(e.target.value)}
            className="w-full mt-2 py-1 px-2 text-[10px] bg-white border border-black font-bold uppercase"
          >
            {workspaces.map((ws) => (
              <option key={ws} value={ws}>{ws}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Historical Spend Trend Graph */}
      <div className="premium-card shadow-[4px_4px_0px_rgba(0,0,0,1)]">
        <h3 className="text-sm font-bold text-black mb-6 border-b border-[#1a1a1d] pb-4 uppercase tracking-wider">
          Daily Cost Trends (INR)
        </h3>
        
        {chartData.length > 0 ? (
          <div className="relative">
            <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-full overflow-visible">
              <defs>
                <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--accent-red, #ff5555)" stopOpacity="0.45" />
                  <stop offset="100%" stopColor="var(--accent-red, #ff5555)" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Y Grid Lines & Labels */}
              {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
                const cost = minCost + ratio * (maxCost - minCost)
                const y = getY(cost)
                return (
                  <g key={ratio} className="opacity-80">
                    <line
                      x1={paddingX}
                      y1={y}
                      x2={chartWidth - paddingX}
                      y2={y}
                      stroke="#e4e4e7"
                      strokeWidth="1"
                      strokeDasharray="4 4"
                    />
                    <text
                      x={paddingX - 10}
                      y={y + 4}
                      textAnchor="end"
                      className="text-[9px] font-mono font-bold fill-zinc-400"
                    >
                      ₹{cost.toFixed(3)}
                    </text>
                  </g>
                )
              })}

              {/* Area Path */}
              {areaPath && (
                <path d={areaPath} fill="url(#areaGradient)" />
              )}

              {/* Line Path */}
              {linePath && (
                <path
                  d={linePath}
                  fill="none"
                  stroke="black"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}

              {/* Data points & hover zones */}
              {chartData.map((d, idx) => {
                const cx = getX(idx)
                const cy = getY(d.cost)
                return (
                  <g key={idx}>
                    {/* Visual Point */}
                    <circle
                      cx={cx}
                      cy={cy}
                      r="4"
                      className="fill-white stroke-black"
                      strokeWidth="2"
                    />
                    {/* Hover Target Circle (larger) */}
                    <circle
                      cx={cx}
                      cy={cy}
                      r="12"
                      fill="transparent"
                      className="cursor-pointer"
                      onMouseEnter={() => setHoveredPoint({ ...d, x: cx, y: cy })}
                      onMouseLeave={() => setHoveredPoint(null)}
                    />
                  </g>
                )
              })}

              {/* X Axis Labels */}
              {chartData.map((d, idx) => {
                const showLabel = chartData.length <= 10 || idx % Math.ceil(chartData.length / 10) === 0
                if (!showLabel) return null
                return (
                  <text
                    key={idx}
                    x={getX(idx)}
                    y={chartHeight - 12}
                    textAnchor="middle"
                    className="text-[9px] font-bold fill-zinc-500 uppercase"
                  >
                    {d.formattedDate}
                  </text>
                )
              })}

              {/* Baseline axis */}
              <line
                x1={paddingX}
                y1={chartHeight - paddingY}
                x2={chartWidth - paddingX}
                y2={chartHeight - paddingY}
                stroke="black"
                strokeWidth="1.5"
              />
            </svg>

            {/* Interactive Tooltip Overlay */}
            {hoveredPoint && (
              <div
                className="absolute z-10 bg-black text-white p-2 border border-black shadow-[2px_2px_0px_var(--accent-red)] text-center text-[10px] font-bold uppercase tracking-wider pointer-events-none"
                style={{
                  left: `${(hoveredPoint.x / chartWidth) * 100}%`,
                  top: `${(hoveredPoint.y / chartHeight) * 100 - 15}%`,
                  transform: 'translate(-50%, -100%)'
                }}
              >
                <div>{hoveredPoint.formattedDate}</div>
                <div className="text-[var(--accent-green)] font-mono mt-0.5">₹{hoveredPoint.cost.toFixed(4)}</div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-16 text-zinc-400 text-[10px] font-bold uppercase">
            No historical logs to plot yet.
          </div>
        )}
      </div>

      {/* Visual Analytics Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Model Breakdown Chart */}
        <div className="premium-card">
          <h3 className="text-sm font-bold text-black mb-6 border-b border-[#1a1a1d] pb-4 uppercase tracking-wider">
            Cost Breakdown by Model
          </h3>
          {Object.keys(modelBreakdown).length > 0 ? (
            <div className="space-y-6">
              {Object.entries(modelBreakdown).map(([model, cost], idx) => {
                const percentage = totalSpend > 0 ? (cost / totalSpend) * 100 : 0
                return (
                  <div key={model} className="space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold uppercase">
                      <span className="text-[#0c0c0e]">{model}</span>
                      <span className="text-zinc-600">
                        ₹{cost.toFixed(4)} ({percentage.toFixed(1)}%)
                      </span>
                    </div>
                    {/* SVG progress bar */}
                    <div className="w-full h-4 bg-zinc-100 border border-black">
                      <div
                        className="h-full border-r border-black"
                        style={{
                          width: `${percentage}%`,
                          backgroundColor: getColor(idx)
                        }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="text-center py-12 text-zinc-400 uppercase text-[10px] font-bold">
              No breakdown data available.
            </div>
          )}
        </div>

        {/* Feature Breakdown Chart */}
        <div className="premium-card">
          <h3 className="text-sm font-bold text-black mb-6 border-b border-[#1a1a1d] pb-4 uppercase tracking-wider">
            Cost Breakdown by Feature
          </h3>
          {Object.keys(featureBreakdown).length > 0 ? (
            <div className="space-y-6">
              {Object.entries(featureBreakdown).map(([feat, cost], idx) => {
                const percentage = totalSpend > 0 ? (cost / totalSpend) * 100 : 0
                return (
                  <div key={feat} className="space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold uppercase">
                      <span className="text-[#0c0c0e]">{feat}</span>
                      <span className="text-zinc-600">
                        ₹{cost.toFixed(4)} ({percentage.toFixed(1)}%)
                      </span>
                    </div>
                    {/* SVG progress bar */}
                    <div className="w-full h-4 bg-zinc-100 border border-black">
                      <div
                        className="h-full border-r border-black"
                        style={{
                          width: `${percentage}%`,
                          backgroundColor: getColor(idx + 3)
                        }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="text-center py-12 text-zinc-400 uppercase text-[10px] font-bold">
              No breakdown data available.
            </div>
          )}
        </div>

      </div>

      {/* Usage Logs Table Dashboard */}
      <div className="premium-card">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-4 border-b border-[#1a1a1d] mb-4">
          <h3 className="text-sm font-bold text-black uppercase tracking-wider">
            Detailed API Transaction Logs
          </h3>
          
          <div className="flex gap-3">
            <input
              type="text"
              className="form-input py-1.5 px-3 text-xs w-[180px]"
              placeholder="Search details..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <select
              className="form-input py-1.5 px-3 text-xs w-[140px]"
              value={filterFeature}
              onChange={(e) => setFilterFeature(e.target.value)}
            >
              <option value="All">All Features</option>
              {uniqueFeatures.map((f) => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
            <button
              onClick={exportToCSV}
              disabled={filteredLogs.length === 0}
              className="px-3 py-1.5 border border-black hover:bg-zinc-100 text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 shadow-[1.5px_1.5px_0px_rgba(0,0,0,1)] disabled:opacity-50 disabled:cursor-not-allowed active:translate-x-[0.5px] active:translate-y-[0.5px]"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Export CSV
            </button>
            <button
              onClick={triggerClearLogs}
              className="px-3 py-1.5 border border-red-600 text-red-600 hover:bg-red-50 text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 shadow-[1.5px_1.5px_0px_rgba(0,0,0,1)] active:translate-x-[0.5px] active:translate-y-[0.5px]"
            >
              Clear Logs
            </button>
          </div>
        </div>

        {/* Quick Filter Pills */}
        <div className="flex flex-wrap gap-2 mb-6">
          <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider self-center mr-1">Model Filters:</span>
          {['All', 'bulbul:v3', 'bulbul:v2'].map(model => {
            const isActive = searchTerm === model || (model === 'All' && searchTerm === '');
            return (
              <button
                key={model}
                onClick={() => setSearchTerm(model === 'All' ? '' : model)}
                className={`px-2 py-0.5 border border-black text-[9px] font-bold uppercase tracking-wide transition-all ${
                  isActive
                    ? 'bg-black text-white'
                    : 'bg-zinc-50 hover:bg-zinc-100 text-zinc-800'
                }`}
              >
                {model}
              </button>
            )
          })}
        </div>

        {loading ? (
          <div className="text-center py-12 text-zinc-400 text-xs font-bold uppercase">
            Loading logs...
          </div>
        ) : filteredLogs.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-[#1a1a1d]">
              <thead>
                <tr className="bg-zinc-50">
                  <th className="px-4 py-3 text-left text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Timestamp</th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Feature</th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Model</th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Volume Metrics</th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Metadata Details</th>
                  <th className="px-4 py-3 text-right text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Cost (INR)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e4e4e7] text-xs font-bold text-[#0c0c0e]">
                {filteredLogs.map((log, idx) => {
                  const dateStr = new Date(log.timestamp).toLocaleString('en-IN', {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })
                  return (
                    <tr key={idx} className="hover:bg-zinc-50/50">
                      <td className="px-4 py-4 whitespace-nowrap text-zinc-500 uppercase">
                        {dateStr}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-black uppercase">
                        {log.feature}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap font-mono text-[10px] text-zinc-600">
                        {log.model}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-zinc-800">
                        {log.characters > 0 ? `${log.characters} Characters` : ''}
                        {log.tokens > 0 ? `${log.tokens} Tokens` : ''}
                      </td>
                      <td className="px-4 py-4 text-zinc-500 font-medium truncate max-w-[220px]">
                        {log.details || '-'}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-right text-black font-mono">
                        ₹{log.cost_inr.toFixed(4)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-16 text-zinc-400 flex flex-col items-center">
            <p className="text-[10px] font-bold uppercase tracking-wider">No usage history found matching your filters.</p>
          </div>
        )}
      </div>

      {showClearConfirm && (
        <div className="fixed inset-0 bg-black/45 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border-2 border-black max-w-sm w-full p-6 shadow-[4px_4px_0px_0px_var(--border-geo)]">
            <h3 className="text-base font-black text-[#0c0c0e] mb-1">Clear Usage Logs</h3>
            <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider mb-4 text-red-500 font-semibold">
              Warning: This will permanently delete ALL usage records across all workspaces. This action is irreversible.
            </p>
            
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setShowClearConfirm(false)}
                className="px-3 py-1.5 text-[10px] font-bold border border-black hover:bg-zinc-50 uppercase tracking-wider"
              >
                Cancel
              </button>
              <button 
                onClick={confirmClearLogs}
                className="px-3 py-1.5 text-[10px] font-bold bg-red-600 text-white border border-black hover:bg-red-700 uppercase tracking-wider shadow-[2px_2px_0px_var(--accent-red)]"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
