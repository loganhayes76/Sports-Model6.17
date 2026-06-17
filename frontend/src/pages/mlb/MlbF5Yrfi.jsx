import { useState, useEffect } from 'react'
import './MlbPages.css'

function YrfiRow({ row }) {
  const isYrfi = row.target === 'YRFI'
  return (
    <tr className={isYrfi ? 'row-yrfi' : 'row-nrfi'}>
      <td>{row.matchup}</td>
      <td className="td-muted">{row.game_time}</td>
      <td className="td-small">{row.pitching}</td>
      <td>{row.yrfi_pct}%</td>
      <td>{row.nrfi_pct}%</td>
      <td>
        <span className={`target-badge ${isYrfi ? 'badge-yrfi' : 'badge-nrfi'}`}>
          {row.target}
        </span>
      </td>
      <td>{row.confidence}</td>
      <td>{row.atmos_idx}x</td>
    </tr>
  )
}

function F5Row({ row }) {
  return (
    <tr>
      <td>{row.matchup}</td>
      <td className="td-muted">{row.game_time}</td>
      <td className="td-small">{row.pitching}</td>
      <td><strong>{row.f5_total}</strong></td>
      <td>{row.f5_spread}</td>
      <td className="td-muted">{row.away_ml} / {row.home_ml}</td>
      <td>
        <span className="advantage-badge">{row.advantage}</span>
      </td>
    </tr>
  )
}

export default function MlbF5Yrfi() {
  const [data,    setData]    = useState(null)
  const [tab,     setTab]     = useState('yrfi')
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)

  useEffect(() => {
    fetch('/api/mlb/f5-yrfi')
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [])

  if (loading) return <div className="mlb-loading">Calculating Poisson distributions...</div>
  if (error)   return <div className="mlb-error">Error: {error}</div>

  const yrfi = data?.yrfi || []
  const f5   = data?.f5   || []

  if (!yrfi.length && !f5.length) return (
    <div className="mlb-empty">
      <span>⚡</span>
      <p>No games on today's slate.</p>
    </div>
  )

  return (
    <div className="mlb-page">
      <div className="page-header">
        <h2>F5 / YRFI Predictor</h2>
        <span className="count-badge">{yrfi.length} games</span>
      </div>
      <div className="tab-bar">
        <button
          className={`tab-btn ${tab==='yrfi'?'active':''}`}
          onClick={() => setTab('yrfi')}
        >🔥 1st Inning (YRFI/NRFI)</button>
        <button
          className={`tab-btn ${tab==='f5'?'active':''}`}
          onClick={() => setTab('f5')}
        >🎯 First 5 Innings</button>
      </div>

      {tab === 'yrfi' && (
        <div className="table-wrap">
          <table className="mlb-table">
            <thead>
              <tr>
                <th>Game</th><th>Time</th><th>Pitching</th>
                <th>YRFI%</th><th>NRFI%</th><th>Target</th>
                <th>Conf</th><th>Atmos</th>
              </tr>
            </thead>
            <tbody>
              {yrfi.map((r, i) => <YrfiRow key={i} row={r} />)}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'f5' && (
        <div className="table-wrap">
          <table className="mlb-table">
            <thead>
              <tr>
                <th>Game</th><th>Time</th><th>Pitching</th>
                <th>F5 Total</th><th>F5 Spread</th><th>ML (A/H)</th>
                <th>Advantage</th>
              </tr>
            </thead>
            <tbody>
              {f5.map((r, i) => <F5Row key={i} row={r} />)}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
