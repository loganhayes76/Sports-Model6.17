import { useState, useEffect } from 'react'
import './MlbPages.css'

function AtmosBar({ atmos }) {
  const pct    = Math.min(100, Math.max(0, Math.round(atmos * 50)))
  const delta  = round2((atmos - 1.0) * 100)
  const color  = delta > 0 ? '#84cc16' : delta < 0 ? '#ef4444' : '#0ea5e9'
  const sign   = delta > 0 ? '+' : ''
  return (
    <div className="atmos-wrap">
      <div className="atmos-value" style={{ color }}>
        {atmos}x <span className="atmos-delta">({sign}{delta}%)</span>
      </div>
    </div>
  )
}

function round2(n) { return Math.round(n * 100) / 100 }

function WeatherCard({ game }) {
  const w_icon = game.wind_speed >= 10 ? '🌪️' : game.wind_speed >= 5 ? '🌬️' : '😶‍🌫️'
  return (
    <div className="mlb-card wx-card">
      <div className="card-matchup">
        <strong>{game.away_abbr} @ {game.home_abbr}</strong>
        <span className="game-time">{game.game_time}</span>
      </div>
      <div className="stadium-name">📍 {game.stadium_name}</div>

      <AtmosBar atmos={game.atmos_index} />

      {game.has_roof ? (
        <div className="roof-note">🏟️ Domed / Retractable roof — weather conditions negated</div>
      ) : (
        <div className="wx-stats">
          <div className="wx-stat">
            <span>🌡️</span>
            <span>{Math.round(game.temp)}°F</span>
          </div>
          <div className="wx-stat">
            <span>{w_icon}</span>
            <span>{Math.round(game.wind_speed)} mph ({game.wind_dir})</span>
          </div>
        </div>
      )}
      <div className="park-factor">Park Factor: <strong>{game.park_factor}x</strong></div>
    </div>
  )
}

export default function MlbWeather() {
  const [data,    setData]    = useState([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)

  useEffect(() => {
    fetch('/api/mlb/weather')
      .then(r => r.json())
      .then(d => { setData(d.games || []); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [])

  if (loading) return <div className="mlb-loading">Fetching weather & park data...</div>
  if (error)   return <div className="mlb-error">Error: {error}</div>
  if (!data.length) return (
    <div className="mlb-empty">
      <span>🌤️</span>
      <p>No games scheduled.</p>
    </div>
  )

  return (
    <div className="mlb-page">
      <div className="page-header">
        <h2>Weather & Park Factors</h2>
        <span className="count-badge">{data.length} venues</span>
      </div>
      <div className="cards-grid">
        {data.map((g, i) => <WeatherCard key={i} game={g} />)}
      </div>
    </div>
  )
}
