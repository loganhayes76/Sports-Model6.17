import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../../context/AuthContext.jsx'
import './MlbPages.css'

const ROLE_LEVEL = { guest: 0, member: 1, dfs: 2, admin: 3 }

function fmtMarket(raw) {
  if (!raw) return '—'
  return raw.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function fmtOdds(o) {
  if (o == null) return null
  return o > 0 ? `+${o}` : `${o}`
}

function PropCard({ prop }) {
  const market   = fmtMarket(prop.market || prop.bet || prop.prop)
  const matchup  = prop.home_team && prop.away_team
    ? `${prop.away_team} @ ${prop.home_team}`
    : (prop.team || '')
  const line     = prop.line != null ? prop.line : null
  const overOdds = fmtOdds(prop.over_odds)
  const underOdds = fmtOdds(prop.under_odds)
  const proj     = prop.proj_mean != null ? parseFloat(prop.proj_mean) : null
  const lean     = proj != null && line != null
    ? (proj > line ? 'OVER' : proj < line ? 'UNDER' : null)
    : null

  return (
    <div className="mlb-card prop-card">
      <div className="prop-player">{prop.player || prop.name || 'Player TBD'}</div>
      {matchup && <div className="prop-team">{matchup}</div>}
      <div className="prop-bet">{market}</div>

      {line != null && (
        <div style={{ display: 'flex', gap: '8px', marginTop: '6px', fontSize: '13px', flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ color: '#f59e0b', fontWeight: 700 }}>Line: {line}</span>
          {overOdds && <span style={{ color: '#84cc16', fontWeight: 600 }}>O {overOdds}</span>}
          {underOdds && <span style={{ color: '#0ea5e9', fontWeight: 600 }}>U {underOdds}</span>}
        </div>
      )}

      {proj != null && (
        <div style={{ display: 'flex', gap: '8px', marginTop: '4px', fontSize: '12px', alignItems: 'center' }}>
          <span style={{ color: 'var(--ss-text-muted)' }}>Model: {proj.toFixed(1)}</span>
          {lean && (
            <span style={{
              fontWeight: 800,
              fontSize: '11px',
              padding: '1px 7px',
              borderRadius: '8px',
              background: lean === 'OVER' ? 'rgba(132,204,22,0.15)' : 'rgba(14,165,233,0.15)',
              color: lean === 'OVER' ? '#84cc16' : '#0ea5e9',
            }}>{lean}</span>
          )}
        </div>
      )}
    </div>
  )
}

export default function MlbProps() {
  const [props, setProps] = useState([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)
  const [refreshing, setRefreshing] = useState(false)
  const [refreshMsg, setRefreshMsg] = useState(null)

  const { auth } = useAuth()
  const role = auth?.role || 'guest'
  const canRefresh = (ROLE_LEVEL[role] ?? 0) >= ROLE_LEVEL['dfs']

  const loadProps = useCallback(() => {
    setLoading(true)
    setError(null)
    fetch('/api/mlb/props')
      .then(r => r.json())
      .then(d => {
        setProps(d.props || [])
        setLoading(false)
      })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [])

  useEffect(() => {
    loadProps()
  }, [loadProps])

  const handleRefresh = async () => {
    if (!auth?.token || refreshing) return
    setRefreshing(true)
    setRefreshMsg(null)
    try {
      const res = await fetch('/api/mlb/refresh-props', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-session-token': auth.token,
        },
      })
      const data = await res.json()
      if (data.status === 'ok') {
        setRefreshMsg('Props updated successfully.')
        loadProps()
      } else {
        setRefreshMsg(`Refresh failed: ${data.message || 'unknown error'}`)
      }
    } catch (e) {
      setRefreshMsg(`Refresh error: ${e.message}`)
    } finally {
      setRefreshing(false)
    }
  }

  if (loading) return <div className="mlb-loading">Loading props...</div>
  if (error)   return <div className="mlb-error">Error: {error}</div>

  if (!props.length) return (
    <div className="mlb-empty">
      <span>📊</span>
      <p>No prop data available yet.</p>
      <p style={{ fontSize: '12px', opacity: 0.7 }}>
        Props are pulled daily at 6 AM and 2 PM ET. If this is early in the day, check back after 2 PM ET.
        An ODDS_API_KEY secret is also required to fetch live props.
      </p>
      {canRefresh && (
        <div style={{ marginTop: '16px' }}>
          <button
            className="refresh-props-btn"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            {refreshing ? 'Refreshing…' : '⟳ Refresh Props'}
          </button>
          {refreshMsg && <p style={{ fontSize: '12px', marginTop: '8px', opacity: 0.85 }}>{refreshMsg}</p>}
        </div>
      )}
    </div>
  )

  return (
    <div className="mlb-page">
      <div className="page-header">
        <h2>Today's MLB Props</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span className="count-badge">{props.length} plays</span>
          {canRefresh && (
            <button
              className="refresh-props-btn"
              onClick={handleRefresh}
              disabled={refreshing}
            >
              {refreshing ? 'Refreshing…' : '⟳ Refresh Props'}
            </button>
          )}
        </div>
      </div>
      {refreshMsg && (
        <div style={{ padding: '8px 12px', marginBottom: '12px', fontSize: '13px',
          background: 'rgba(255,255,255,0.08)', borderRadius: '6px', opacity: 0.9 }}>
          {refreshMsg}
        </div>
      )}
      <div className="cards-grid">
        {props.map((p, i) => <PropCard key={i} prop={p} />)}
      </div>
    </div>
  )
}
