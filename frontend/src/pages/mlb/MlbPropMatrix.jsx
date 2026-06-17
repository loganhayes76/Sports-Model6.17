import { useState, useEffect } from 'react'
import './MlbPages.css'

const CATEGORIES = [
  { key: 'strikeouts',  label: '⚡ Strikeouts',   color: '#0ea5e9' },
  { key: 'home_runs',   label: '💣 Home Runs',     color: '#ef4444' },
  { key: 'total_bases', label: '⚾ Total Bases',   color: '#84cc16' },
  { key: 'hits',        label: '🏏 Hits',          color: '#a78bfa' },
  { key: 'runs',        label: '🏃 Runs',          color: '#f97316' },
  { key: 'rbi',         label: '💥 RBIs',          color: '#facc15' },
  { key: 'hrr',         label: '🔥 HRR',           color: '#ec4899' },
]

function MatrixTable({ rows, color }) {
  if (!rows || !rows.length) return <p className="td-muted">No data</p>
  return (
    <table className="mlb-table">
      <thead>
        <tr>
          <th>#</th>
          <th>Player</th>
          <th>Team</th>
          <th>Proj</th>
          <th>Confidence</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>
            <td className="td-muted">{i + 1}</td>
            <td><strong>{r.player}</strong></td>
            <td className="td-muted">{r.team}</td>
            <td style={{ color, fontWeight: 700 }}>{r.proj}</td>
            <td title={`Confidence: ${r.confidence}`}>{r.confidence}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export default function MlbPropMatrix() {
  const [data,    setData]    = useState(null)
  const [tab,     setTab]     = useState('strikeouts')
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)

  useEffect(() => {
    fetch('/api/mlb/prop-matrix')
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [])

  if (loading) return <div className="mlb-loading">Building prop matrix...</div>
  if (error)   return <div className="mlb-error">Error: {error}</div>

  if (data?.status === 'no_data') return (
    <div className="mlb-empty">
      <span>🎯</span>
      <p>{data.message}</p>
      <p className="td-muted">Upload FanGraphs CSVs from the Admin panel.</p>
    </div>
  )

  if (data?.status === 'error') return (
    <div className="mlb-error">
      <p>Prop matrix error: {data.message}</p>
    </div>
  )

  const catData = data?.data || {}
  const active  = CATEGORIES.find(c => c.key === tab)

  return (
    <div className="mlb-page">
      <div className="page-header">
        <h2>MLB Prop Matrix</h2>
        <span className="count-badge">Pure Volume Math</span>
      </div>
      <div className="tab-bar flex-wrap">
        {CATEGORIES.map(c => (
          <button
            key={c.key}
            className={`tab-btn ${tab === c.key ? 'active' : ''}`}
            onClick={() => setTab(c.key)}
          >{c.label}</button>
        ))}
      </div>
      <div className="table-wrap">
        <MatrixTable rows={catData[tab]} color={active?.color || '#0ea5e9'} />
      </div>
    </div>
  )
}
