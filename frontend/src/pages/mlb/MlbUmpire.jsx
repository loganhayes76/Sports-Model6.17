import { useState, useEffect } from 'react'
import './MlbPages.css'

const ACTION_CLASS = {
  'Boost OVERS & Batter Props': 'action-over',
  'Boost UNDERS & Pitcher Ks': 'action-under',
  'Neutral Environment':        'action-neutral',
}

function UmpCard({ game }) {
  const rf     = game.run_factor
  const isOver = rf > 1.03
  const isUnder= rf < 0.97

  return (
    <div className={`mlb-card ump-card ${isOver ? 'border-green' : isUnder ? 'border-red' : ''}`}>
      <div className="card-matchup">
        <strong>{game.away_abbr} @ {game.home_abbr}</strong>
        <span className="game-time">{game.game_time}</span>
      </div>
      <div className="ump-name">⚖️ {game.umpire}</div>
      {game.umpire !== 'TBD' ? (
        <>
          <div className="ump-type">{game.tendency}</div>
          <div className="ump-stats">
            <div className="ump-stat">
              <span className="stat-label">Run Factor</span>
              <span className={`stat-val ${isOver?'val-green':isUnder?'val-red':'val-neutral'}`}>
                {rf}x
              </span>
            </div>
            <div className="ump-stat">
              <span className="stat-label">K/BB</span>
              <span className="stat-val val-neutral">{game.k_bb}</span>
            </div>
            <div className="ump-stat">
              <span className="stat-label">Zone</span>
              <span className="stat-val val-neutral">{game.zone}</span>
            </div>
          </div>
          <div className={`ump-action ${ACTION_CLASS[game.action] || 'action-neutral'}`}>
            {game.action}
          </div>
        </>
      ) : (
        <div className="mlb-warn">Not yet assigned — check back closer to first pitch</div>
      )}
    </div>
  )
}

export default function MlbUmpire() {
  const [data,    setData]    = useState([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)

  useEffect(() => {
    fetch('/api/mlb/umpire')
      .then(r => r.json())
      .then(d => { setData(d.games || []); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [])

  if (loading) return <div className="mlb-loading">Scanning MLB boxscores for HP umpire assignments...</div>
  if (error)   return <div className="mlb-error">Error: {error}</div>
  if (!data.length) return (
    <div className="mlb-empty">
      <span>🧑‍⚖️</span>
      <p>No games scheduled for today.</p>
    </div>
  )

  return (
    <div className="mlb-page">
      <div className="page-header">
        <h2>Umpire Radar</h2>
        <span className="count-badge">{data.length} games</span>
      </div>
      <p className="page-sub">MLB typically releases umpire assignments 1–3 hours before first pitch</p>
      <div className="cards-grid">
        {data.map((g, i) => <UmpCard key={i} game={g} />)}
      </div>
    </div>
  )
}
