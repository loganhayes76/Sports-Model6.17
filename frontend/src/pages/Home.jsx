import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import LoadingScreen from '../components/LoadingScreen.jsx'
import './Home.css'

const ROLE_LEVEL = { guest: 0, member: 1, dfs: 2, admin: 3 }

const ACTIVE_SECTIONS = [
  { to: '/mlb',           icon: '⚾',  label: 'MLB',           desc: 'Props · Cleanup Crew · Umpire · Bullpen · Weather' },
  { to: '/nba',           icon: '🏀',  label: 'NBA',           desc: 'Monte Carlo Props · Game Edges · Models' },
  { to: '/ncaa',          icon: '🎓',  label: 'NCAA',          desc: 'Baseball ELO Model · Hoops Torvik Tempo' },
  { to: '/parlay-grader', icon: '🎲',  label: 'Parlay Grader', desc: 'Grade parlay edge · True vs. house odds' },
  { to: '/master-board',  icon: '📋',  label: 'Master Board',  desc: 'All edge plays ranked · Every sport, one view' },
  { to: '/tracker',       icon: '📈',  label: 'Tracker',       desc: 'Log picks · Grade results · Track ROI' },
  { to: '/admin',         icon: '⚙️',  label: 'Admin',         desc: 'GitHub sync · Data files · System status' },
]

const DFS_SECTION = {
  to: '/dfs', icon: '🎯', label: 'DFS Tools', desc: 'LP Optimizer · MLB · NBA · UFC · PGA · NASCAR',
}

const FUTURE_SECTIONS = [
  { to: '/nascar',  icon: '🏎️', label: 'NASCAR',        desc: 'Harville Expansion model · Top 3/5/10 edges' },
  { to: '/fantasy', icon: '⚾',  label: 'Fantasy Draft', desc: 'WAR Z-Score rankings · ADP estimates · Roster tracker' },
  { to: '/nfl',     icon: '🏈',  label: 'NFL',           desc: 'Game lines · Player props · Model edges' },
  { to: '/ncaaf',   icon: '🏈',  label: 'NCAAF',         desc: 'College football spreads · Model edges' },
]

const SPORT_COLORS = {
  MLB: '#0ea5e9', 'MLB Props': '#0ea5e9',
  NBA: '#f59e0b', 'NBA Props': '#f59e0b', 'NBA Game': '#f59e0b',
  NCAA: '#84cc16', 'NCAA Hoops': '#84cc16', 'NCAA Baseball': '#84cc16',
  DFS: '#8b5cf6',
  UFC: '#ef4444', PGA: '#10b981', NASCAR: '#f97316',
}

const SPORT_ROUTE_MAP = {
  MLB: '/mlb', 'MLB Props': '/mlb',
  NBA: '/nba', 'NBA Props': '/nba', 'NBA Game': '/nba',
  NCAA: '/ncaa', 'NCAA Hoops': '/ncaa/hoops', 'NCAA Baseball': '/ncaa',
  DFS: '/dfs',
  UFC: '/dfs/ufc',
  PGA: '/dfs/pga',
  NASCAR: '/dfs/nascar',
}

function safeProj(val) {
  if (val == null) return null
  const n = parseFloat(val)
  return isNaN(n) ? null : n
}

function edgeBlurb(play) {
  const edge = parseFloat(play.edge) || 0
  const proj = safeProj(play.proj)
  const market = play.market || ''
  const sport = play.sport || ''
  const pickSide = play.pick_side || ''

  if (proj != null && play.vegas != null) {
    const vegasNum = parseFloat(play.vegas)
    if (!isNaN(vegasNum)) {
      if (market === 'Total') {
        const dir = edge > 0 ? 'Over' : 'Under'
        const base = `Model projects ${proj.toFixed(1)} vs Vegas line of ${vegasNum.toFixed(1)} — a ${Math.abs(edge).toFixed(1)}-point gap.`
        return pickSide ? `${pickSide}: ${base}` : base
      }
      if (market === 'Spread' || market === 'Runline') {
        const base = `Model spread of ${proj.toFixed(1)} vs Vegas line of ${vegasNum.toFixed(1)} (gap: ${Math.abs(edge).toFixed(1)} pts).`
        return pickSide ? `${pickSide}: ${base}` : base
      }
    }
  }

  if (sport.includes('Props')) {
    const dir = edge > 0 ? 'Over' : 'Under'
    const base = `Model favors the ${dir} for ${play.matchup || play.player || 'this player'} (${market}). Edge vs. market: ${edge > 0 ? '+' : ''}${edge.toFixed(1)}%.`
    return pickSide ? `${pickSide}: ${base}` : base
  }

  const base = `Model finds a ${Math.abs(edge).toFixed(1)}% edge on this ${market} market vs. current Vegas pricing.`
  return pickSide ? `${pickSide}: ${base}` : base
}

function PlatinumPlayModal({ play, onClose }) {
  const navigate = useNavigate()
  const edge = parseFloat(play.edge) || 0
  const color = SPORT_COLORS[play.sport] || '#0ea5e9'
  const proj = safeProj(play.proj)
  const edgeColor = Math.abs(edge) >= 8 ? '#84cc16' : Math.abs(edge) >= 4 ? '#0ea5e9' : '#f59e0b'
  const route = SPORT_ROUTE_MAP[play.sport] || '/master-board'
  const sportLabel = play.sport || 'Sport'

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.72)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '16px',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--ss-surface)',
          border: `1px solid var(--ss-border)`,
          borderTop: `3px solid ${color}`,
          borderRadius: '14px',
          padding: '28px 28px 24px',
          maxWidth: '460px',
          width: '100%',
          position: 'relative',
          boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
        }}
      >
        <button
          onClick={onClose}
          style={{
            position: 'absolute', top: '14px', right: '16px',
            background: 'none', border: 'none', color: 'var(--ss-text-muted)',
            fontSize: '18px', cursor: 'pointer', lineHeight: 1,
          }}
          aria-label="Close"
        >✕</button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
          <span style={{
            fontSize: '11px', fontWeight: 700, color,
            background: `${color}20`, padding: '3px 10px', borderRadius: '10px',
          }}>{play.sport}</span>
          <span style={{ fontSize: '13px', color: '#f59e0b' }}>{play.stars || '⭐⭐⭐'}</span>
        </div>

        <p style={{ fontSize: '20px', fontWeight: 700, margin: '0 0 4px', color: 'var(--ss-text)', lineHeight: 1.2 }}>
          {play.player || play.matchup || '—'}
        </p>
        <p style={{ fontSize: '14px', color: 'var(--ss-text-muted)', margin: '0 0 14px' }}>
          {play.market || '—'}
        </p>

        {play.pick_side && (
          <div style={{
            background: `${color}15`,
            border: `1px solid ${color}40`,
            borderRadius: '8px',
            padding: '10px 14px',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--ss-text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px', whiteSpace: 'nowrap' }}>The Play</span>
            <span style={{ fontSize: '18px', fontWeight: 800, color }}>
              {play.pick_side}
            </span>
          </div>
        )}

        <div style={{
          background: 'rgba(255,255,255,0.04)', border: '1px solid var(--ss-border)',
          borderRadius: '10px', padding: '14px 16px', marginBottom: '14px',
          display: 'flex', flexDirection: 'column', gap: '8px',
        }}>
          {play.vegas != null && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
              <span style={{ color: 'var(--ss-text-muted)' }}>Vegas Line</span>
              <strong style={{ color: 'var(--ss-text)' }}>{play.vegas}</strong>
            </div>
          )}
          {proj != null && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
              <span style={{ color: 'var(--ss-text-muted)' }}>Model Projection</span>
              <strong style={{ color: 'var(--ss-teal)' }}>{proj.toFixed(1)}</strong>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
            <span style={{ color: 'var(--ss-text-muted)' }}>Edge</span>
            <strong style={{ color: edgeColor, fontSize: '15px' }}>
              {edge >= 0 ? `+${edge.toFixed(1)}%` : `${edge.toFixed(1)}%`}
            </strong>
          </div>
        </div>

        <p style={{
          fontSize: '13px', color: 'var(--ss-text-muted)', lineHeight: 1.55,
          margin: '0 0 20px', fontStyle: 'italic',
        }}>
          {edgeBlurb(play)}
        </p>

        <button
          className="ss-btn-primary"
          style={{ width: '100%', padding: '11px 0', fontSize: '14px', fontWeight: 700 }}
          onClick={() => { onClose(); navigate(route) }}
        >
          See More {sportLabel} →
        </button>
      </div>
    </div>
  )
}

export default function Home() {
  const navigate = useNavigate()
  const { auth } = useAuth()
  const [platinum, setPlatinum] = useState([])
  const [allPlays, setAllPlays] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [backendUp, setBackendUp] = useState(null)
  const [selectedPlay, setSelectedPlay] = useState(null)
  const [sportFilter, setSportFilter] = useState([])
  const [filterOpen, setFilterOpen] = useState(false)
  const filterRef = useRef(null)

  const role = auth?.role || 'guest'
  const level = ROLE_LEVEL[role] ?? 0
  const canDfs = level >= ROLE_LEVEL['dfs']
  const canFuture = level >= ROLE_LEVEL['admin']

  const closeModal = useCallback(() => setSelectedPlay(null), [])

  const platinumSports = useMemo(
    () => [...new Set(allPlays.map(p => p.sport).filter(Boolean))].sort(),
    [allPlays]
  )

  const visiblePlays = useMemo(() => {
    if (sportFilter.length === 0) return platinum
    const filtered = allPlays
      .filter(p => sportFilter.includes(p.sport))
      .sort((a, b) => (b.abs_edge ?? 0) - (a.abs_edge ?? 0))
    return filtered.slice(0, 10)
  }, [platinum, allPlays, sportFilter])

  useEffect(() => {
    if (!filterOpen) return
    const handler = (e) => {
      if (filterRef.current && !filterRef.current.contains(e.target)) {
        setFilterOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [filterOpen])

  const toggleSport = (sport) => {
    setSportFilter(prev =>
      prev.includes(sport) ? prev.filter(s => s !== sport) : [...prev, sport]
    )
  }

  const loadPlays = useCallback((onDone) => {
    setRefreshing(true)
    fetch('/api/master-board')
      .then((r) => r.ok ? r.json() : Promise.reject())
      .then((data) => {
        if (data.status === 'ok') {
          setPlatinum(data.platinum || [])
          setAllPlays(data.plays || [])
          setBackendUp(true)
        }
      })
      .catch(() => setBackendUp(false))
      .finally(() => {
        setRefreshing(false)
        onDone && onDone()
      })
  }, [])

  useEffect(() => {
    let attempts = 0
    const MAX = 10
    const DELAY = 2000

    const retryFetch = () => {
      fetch('/api/master-board')
        .then((r) => { if (!r.ok) throw new Error(); return r.json() })
        .then((data) => {
          if (data.status === 'ok') {
            setPlatinum(data.platinum || [])
            setAllPlays(data.plays || [])
            setBackendUp(true)
          }
          setLoading(false)
        })
        .catch(() => {
          attempts += 1
          if (attempts < MAX) setTimeout(retryFetch, DELAY)
          else { setBackendUp(false); setLoading(false) }
        })
    }

    retryFetch()
  }, [])

  if (loading) {
    return <LoadingScreen text="Loading today's slate..." />
  }

  return (
    <div className="home-wrap">
      {selectedPlay && (
        <PlatinumPlayModal play={selectedPlay} onClose={closeModal} />
      )}

      {/* ── Daily Picks Banner ── */}
      <section className="home-banner">
        <div className="home-banner-left">
          <p className="home-eyebrow">Today's Slate</p>
          <h1 className="home-title">SpreadSlayer</h1>
          <p className="home-sub">v0.20.0 · Powered by Proprietary Models</p>
        </div>
        <div className="home-status">
          <span className={`status-dot ${backendUp === false ? 'status-err' : 'status-live'}`} />
          {backendUp === false ? 'Backend Offline' : 'Live'}
        </div>
      </section>

      {/* ── Platinum Plays ── */}
      <section className="home-section">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', gap: '8px', flexWrap: 'wrap' }}>
          <h2 className="home-section-title" style={{ margin: 0 }}>🏆 Platinum Plays — Cross-Sport Edge Leaders</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>

            {/* Sport filter dropdown */}
            {platinumSports.length > 0 && (
              <div ref={filterRef} style={{ position: 'relative' }}>
                <button
                  onClick={() => setFilterOpen(o => !o)}
                  style={{
                    fontSize: '12px', padding: '5px 13px', borderRadius: '8px',
                    border: `1px solid ${sportFilter.length > 0 ? 'var(--ss-teal)' : 'var(--ss-border)'}`,
                    background: sportFilter.length > 0 ? 'rgba(14,165,233,0.12)' : 'transparent',
                    color: sportFilter.length > 0 ? 'var(--ss-teal)' : 'var(--ss-text-muted)',
                    cursor: 'pointer', fontWeight: 600, whiteSpace: 'nowrap',
                  }}
                >
                  {sportFilter.length === 0
                    ? '🏅 All Sports ▾'
                    : sportFilter.length === 1
                      ? `${sportFilter[0]} ▾`
                      : sportFilter.length === 2
                        ? `${sportFilter[0]} · ${sportFilter[1]} ▾`
                        : `${sportFilter[0]} · ${sportFilter[1]} +${sportFilter.length - 2} ▾`
                  }
                </button>

                {filterOpen && (
                  <div style={{
                    position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 200,
                    background: '#0f172a', border: '1px solid var(--ss-border)',
                    borderRadius: '10px', padding: '8px', minWidth: '170px',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                  }}>
                    {/* All Sports row */}
                    <div
                      onClick={() => { setSportFilter([]); setFilterOpen(false) }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '8px',
                        padding: '5px 8px', borderRadius: '6px', cursor: 'pointer',
                        background: sportFilter.length === 0 ? 'rgba(14,165,233,0.12)' : 'transparent',
                        color: sportFilter.length === 0 ? 'var(--ss-teal)' : 'var(--ss-text)',
                        fontSize: '13px', fontWeight: sportFilter.length === 0 ? 700 : 400,
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
                      onMouseLeave={e => e.currentTarget.style.background = sportFilter.length === 0 ? 'rgba(14,165,233,0.12)' : 'transparent'}
                    >
                      <span style={{
                        width: 12, height: 12, borderRadius: 3, flexShrink: 0,
                        border: sportFilter.length === 0 ? '2px solid var(--ss-teal)' : '2px solid #4b5563',
                        background: sportFilter.length === 0 ? 'var(--ss-teal)' : 'transparent',
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        {sportFilter.length === 0 && <span style={{ color: '#000', fontSize: 9, fontWeight: 900 }}>✓</span>}
                      </span>
                      All Sports
                    </div>

                    <div style={{ height: 1, background: 'var(--ss-border)', margin: '6px 0' }} />

                    {/* Per-sport rows */}
                    {platinumSports.map(sport => {
                      const sc = SPORT_COLORS[sport] || '#0ea5e9'
                      const checked = sportFilter.includes(sport)
                      return (
                        <div
                          key={sport}
                          onClick={() => toggleSport(sport)}
                          style={{
                            display: 'flex', alignItems: 'center', gap: '8px',
                            padding: '5px 8px', borderRadius: '6px', cursor: 'pointer',
                            background: checked ? `${sc}15` : 'transparent',
                            fontSize: '13px',
                          }}
                          onMouseEnter={e => e.currentTarget.style.background = checked ? `${sc}25` : 'rgba(255,255,255,0.05)'}
                          onMouseLeave={e => e.currentTarget.style.background = checked ? `${sc}15` : 'transparent'}
                        >
                          <span style={{
                            width: 12, height: 12, borderRadius: 3, flexShrink: 0,
                            border: checked ? `2px solid ${sc}` : '2px solid #4b5563',
                            background: checked ? sc : 'transparent',
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                          }}>
                            {checked && <span style={{ color: '#000', fontSize: 9, fontWeight: 900 }}>✓</span>}
                          </span>
                          <span style={{ color: checked ? sc : 'var(--ss-text)', fontWeight: checked ? 700 : 400 }}>{sport}</span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Refresh button */}
            <button
              onClick={() => loadPlays()}
              disabled={refreshing}
              style={{
                fontSize: '12px', padding: '5px 13px', borderRadius: '8px',
                border: '1px solid var(--ss-border)', background: 'transparent',
                color: 'var(--ss-teal)', cursor: refreshing ? 'not-allowed' : 'pointer',
                opacity: refreshing ? 0.6 : 1, transition: 'opacity 0.2s',
                fontWeight: 600,
              }}
            >
              {refreshing ? '↻ Loading…' : '↻ Refresh'}
            </button>
          </div>
        </div>

        {platinum.length > 0 ? (
          <>
            {visiblePlays.length > 0 ? (
              <div className="props-grid">
                {visiblePlays.map((p, i) => {
                  const edge = parseFloat(p.edge) || 0
                  const color = SPORT_COLORS[p.sport] || '#0ea5e9'
                  const proj = safeProj(p.proj)
                  return (
                    <div
                      key={i}
                      className="prop-card"
                      style={{ borderTop: `3px solid ${color}`, cursor: 'pointer' }}
                      onClick={() => setSelectedPlay(p)}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <span style={{ fontSize: '11px', fontWeight: 700, color, background: `${color}20`, padding: '2px 8px', borderRadius: '10px' }}>{p.sport}</span>
                        <span style={{ fontSize: '12px', color: '#f59e0b' }}>{p.stars || '⭐⭐⭐'}</span>
                      </div>
                      <p className="prop-player">{p.player || p.matchup || '—'}</p>
                      <p className="prop-bet">{p.bet || p.market || '—'}</p>
                      {(p.vegas != null || proj != null) && (
                        <div style={{ display: 'flex', gap: '10px', marginTop: '4px', fontSize: '12px', color: 'var(--ss-text-muted)', flexWrap: 'wrap' }}>
                          {p.vegas != null && (
                            <span>Vegas: <strong style={{ color: 'var(--ss-text)' }}>{p.vegas}</strong></span>
                          )}
                          {proj != null && (
                            <span>Model: <strong style={{ color: 'var(--ss-teal)' }}>{proj.toFixed(1)}</strong></span>
                          )}
                        </div>
                      )}
                      <span className="prop-odds" style={{ marginTop: '4px', color: edge >= 8 ? '#84cc16' : edge >= 4 ? '#0ea5e9' : undefined }}>
                        Edge: {edge >= 0 ? `+${edge.toFixed(1)}%` : `${edge.toFixed(1)}%`}
                      </span>
                      {p.pick_side && (
                        <span style={{ fontSize: '12px', fontWeight: 700, color, marginTop: '5px', display: 'block' }}>
                          ▶ {p.pick_side}
                        </span>
                      )}
                      <span style={{ fontSize: '11px', color: 'var(--ss-text-muted)', marginTop: '5px', display: 'block' }}>Tap for details →</span>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="no-props-card">
                <span>🔍</span>
                <p>No plays for the selected sport(s). Try adjusting the filter.</p>
                <button className="ss-btn-primary" onClick={() => setSportFilter([])} style={{ marginTop: '8px', padding: '8px 20px' }}>
                  Show All Sports
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="no-props-card">
            <span>🏆</span>
            <p>No platinum plays available yet — models are still running.</p>
            <button className="ss-btn-primary" onClick={() => navigate('/master-board')} style={{ marginTop: '8px', padding: '8px 20px' }}>
              View Master Board →
            </button>
          </div>
        )}
      </section>

      {/* ── Navigation Cards ── */}
      <section className="home-section">
        <h2 className="home-section-title">Sections</h2>
        <div className="sections-grid">
          {/* Active sections — open to all */}
          {ACTIVE_SECTIONS.map((s) => (
            <button
              key={s.to}
              className="section-card"
              onClick={() => navigate(s.to)}
            >
              <span className="section-icon">{s.icon}</span>
              <div>
                <p className="section-label">{s.label}</p>
                <p className="section-desc">{s.desc}</p>
              </div>
            </button>
          ))}

          {/* DFS Tools — dfs/admin only */}
          <button
            className="section-card"
            onClick={() => canDfs ? navigate(DFS_SECTION.to) : undefined}
            aria-disabled={!canDfs}
            style={!canDfs ? { opacity: 0.55, cursor: 'not-allowed' } : undefined}
          >
            <span className="section-icon">{DFS_SECTION.icon}</span>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                <p className="section-label" style={{ margin: 0 }}>{DFS_SECTION.label}</p>
                {!canDfs && (
                  <span style={{ fontSize: '10px', fontWeight: 700, padding: '1px 7px', borderRadius: '8px', background: 'rgba(132,204,22,0.15)', color: '#84cc16', whiteSpace: 'nowrap' }}>
                    DFS Members
                  </span>
                )}
              </div>
              <p className="section-desc">{DFS_SECTION.desc}</p>
            </div>
          </button>

          {/* Future Integration sections — admin only navigable */}
          {FUTURE_SECTIONS.map((s) => (
            <button
              key={s.to}
              className="section-card"
              onClick={() => canFuture ? navigate(s.to) : undefined}
              aria-disabled={!canFuture}
              style={!canFuture ? { opacity: 0.45, cursor: 'not-allowed' } : undefined}
            >
              <span className="section-icon">{s.icon}</span>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                  <p className="section-label" style={{ margin: 0 }}>{s.label}</p>
                  <span style={{ fontSize: '10px', fontWeight: 700, padding: '1px 7px', borderRadius: '8px', background: 'rgba(14,165,233,0.12)', color: 'var(--ss-teal)', whiteSpace: 'nowrap' }}>
                    Future Integration
                  </span>
                </div>
                <p className="section-desc">{s.desc}</p>
              </div>
            </button>
          ))}
        </div>
      </section>
    </div>
  )
}
