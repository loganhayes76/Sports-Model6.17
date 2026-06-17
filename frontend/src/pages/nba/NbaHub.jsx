import { useState, useEffect } from 'react'
import { Routes, Route, NavLink } from 'react-router-dom'
import NbaDfs from './NbaDfs.jsx'

const MODELS = [
  'Consensus', 'Season V1', 'Hot Hand V1',
  'Matchup V1', 'Pace V1', 'Monte V1', 'Dice V1',
]

const MODEL_DESC = {
  'Consensus': 'Averages all models into a single high-conviction output.',
  'Season V1': 'Full-season statistical projection based on per-game averages.',
  'Hot Hand V1': 'Weights recent form and hot/cold streaks heavily.',
  'Matchup V1': 'Adjusts projections based on opposing team defensive rating.',
  'Pace V1': 'Tempo-adjusted pace model — benefits guards in fast games.',
  'Monte V1': 'Runs 10,000 Monte Carlo sims for extreme variance plays.',
  'Dice V1': 'High-variance stochastic model — cross-reference before acting.',
}

const MARKET_ICONS = {
  Points: '🔵', Rebounds: '🟢', Assists: '🟡',
  PRA: '🔴', Steals: '⚪', Blocks: '⚫', '3-Pointers': '🟣',
}

function StarRating({ stars }) {
  const count = (stars || '').split('⭐').length - 1
  return (
    <span style={{ color: count >= 4 ? '#f59e0b' : count >= 3 ? '#84cc16' : 'var(--ss-text-muted)', fontWeight: 700, fontSize: '13px' }}>
      {'⭐'.repeat(count)}
    </span>
  )
}

function EdgeBadge({ edge }) {
  const e = parseFloat(edge) || 0
  const color = e >= 5 ? '#84cc16' : e >= 2 ? '#0ea5e9' : 'var(--ss-text-muted)'
  return (
    <span style={{ color, fontWeight: 700, fontSize: '13px' }}>
      {e > 0 ? `+${e.toFixed(1)}%` : `${e.toFixed(1)}%`}
    </span>
  )
}

function NbaProps() {
  const [model, setModel] = useState('Consensus')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [market, setMarket] = useState('All')
  const [minEdge, setMinEdge] = useState(0)

  const run = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/nba/props?model=${encodeURIComponent(model)}`)
      const json = await res.json()
      setData(json)
    } catch (e) {
      setData({ status: 'error', message: e.message, props: [] })
    } finally {
      setLoading(false)
    }
  }

  const allMarkets = data?.props
    ? ['All', ...new Set(data.props.map(p => p.market))]
    : ['All']

  const filtered = (data?.props || []).filter(p => {
    if (market !== 'All' && p.market !== market) return false
    if (p.edge < minEdge) return false
    return true
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{
        background: 'var(--ss-surface)', borderRadius: '14px',
        border: '1px solid var(--ss-border)', padding: '20px',
        display: 'flex', flexDirection: 'column', gap: '16px',
      }}>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ flex: 1, minWidth: '200px' }}>
            <label style={{ fontSize: '12px', color: 'var(--ss-text-muted)', display: 'block', marginBottom: '6px' }}>
              MODEL ENGINE
            </label>
            <select
              value={model}
              onChange={e => setModel(e.target.value)}
              style={{
                width: '100%', background: 'var(--ss-bg)', border: '1px solid var(--ss-border)',
                color: 'var(--ss-text)', borderRadius: '8px', padding: '8px 12px', fontSize: '14px',
              }}
            >
              {MODELS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div style={{ flex: 1, minWidth: '150px' }}>
            <label style={{ fontSize: '12px', color: 'var(--ss-text-muted)', display: 'block', marginBottom: '6px' }}>
              MARKET FILTER
            </label>
            <select
              value={market}
              onChange={e => setMarket(e.target.value)}
              style={{
                width: '100%', background: 'var(--ss-bg)', border: '1px solid var(--ss-border)',
                color: 'var(--ss-text)', borderRadius: '8px', padding: '8px 12px', fontSize: '14px',
              }}
            >
              {allMarkets.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div style={{ flex: 1, minWidth: '150px' }}>
            <label style={{ fontSize: '12px', color: 'var(--ss-text-muted)', display: 'block', marginBottom: '6px' }}>
              MIN EDGE: {minEdge.toFixed(1)}%
            </label>
            <input
              type="range" min={0} max={15} step={0.5}
              value={minEdge}
              onChange={e => setMinEdge(parseFloat(e.target.value))}
              style={{ width: '100%' }}
            />
          </div>
          <button
            onClick={run}
            disabled={loading}
            className="ss-btn-primary"
            style={{ height: '38px', whiteSpace: 'nowrap' }}
          >
            {loading ? '⏳ Running...' : '🚀 Run Simulations'}
          </button>
        </div>
        {model in MODEL_DESC && (
          <div style={{
            background: 'rgba(14,165,233,0.08)', border: '1px solid rgba(14,165,233,0.2)',
            borderRadius: '8px', padding: '10px 14px', fontSize: '13px', color: 'var(--ss-text-muted)',
          }}>
            💡 {MODEL_DESC[model]}
          </div>
        )}
      </div>

      {data && data.status === 'error' && (
        <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '10px', padding: '16px', color: '#f87171' }}>
          ⚠️ {data.message}
        </div>
      )}

      {data && data.status === 'no_data' && (
        <div style={{
          background: 'var(--ss-surface)', border: '1px dashed var(--ss-border)',
          borderRadius: '14px', padding: '50px', textAlign: 'center',
        }}>
          <div style={{ fontSize: '40px', marginBottom: '12px' }}>📊</div>
          <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--ss-text)', marginBottom: '8px' }}>No data available</div>
          <div style={{ fontSize: '13px', color: 'var(--ss-text-muted)' }}>
            Check back after the next scheduled update (4 PM ET daily).<br />
            An ODDS_API_KEY secret is required to fetch live NBA props.
          </div>
        </div>
      )}

      {data && data.status === 'ok' && (
        <>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            {[
              { label: 'Total Props', value: data.total },
              { label: 'Showing', value: filtered.length },
              { label: 'Value Plays', value: filtered.filter(p => p.edge >= 2).length },
              { label: 'Elite Plays', value: filtered.filter(p => p.edge >= 5).length },
            ].map(({ label, value }) => (
              <div key={label} style={{
                flex: 1, minWidth: '100px', background: 'var(--ss-surface)',
                border: '1px solid var(--ss-border)', borderRadius: '10px',
                padding: '12px 16px', textAlign: 'center',
              }}>
                <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--ss-teal)' }}>{value}</div>
                <div style={{ fontSize: '11px', color: 'var(--ss-text-muted)', marginTop: '2px' }}>{label}</div>
              </div>
            ))}
          </div>

          {filtered.length === 0 ? (
            <div style={{
              background: 'var(--ss-surface)', border: '1px solid var(--ss-border)',
              borderRadius: '12px', padding: '40px', textAlign: 'center', color: 'var(--ss-text-muted)',
            }}>
              No props match your current filters. Try lowering the min edge or changing the market.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--ss-border)' }}>
                    {['Player', 'Market', 'Line', 'Proj', 'Sim%', 'Pick', 'Edge', 'Stars'].map(h => (
                      <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontSize: '11px', fontWeight: 700, color: 'var(--ss-text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', whiteSpace: 'nowrap' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((p, i) => (
                    <tr key={i} style={{
                      borderBottom: '1px solid var(--ss-border)',
                      background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)',
                    }}>
                      <td style={{ padding: '10px 12px', fontWeight: 600, color: 'var(--ss-text)' }}>
                        <div>{p.player}</div>
                        {p.own_team && <div style={{ fontSize: '11px', color: 'var(--ss-text-muted)', marginTop: '2px' }}>{p.own_team} vs {p.opp_team}</div>}
                      </td>
                      <td style={{ padding: '10px 12px', color: 'var(--ss-text-muted)' }}>
                        {MARKET_ICONS[p.market] || ''} {p.market}
                      </td>
                      <td style={{ padding: '10px 12px', color: 'var(--ss-text)' }}>{p.line}</td>
                      <td style={{ padding: '10px 12px', color: 'var(--ss-teal)', fontWeight: 600 }}>{p.proj_mean}</td>
                      <td style={{ padding: '10px 12px', color: 'var(--ss-text-muted)' }}>{p.sim_prob}</td>
                      <td style={{ padding: '10px 12px', fontWeight: 700, color: p.pick.includes('OVER') ? '#84cc16' : '#f87171' }}>
                        {p.pick}
                      </td>
                      <td style={{ padding: '10px 12px' }}><EdgeBadge edge={p.edge} /></td>
                      <td style={{ padding: '10px 12px' }}><StarRating stars={p.stars} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {!data && !loading && (
        <div style={{
          background: 'var(--ss-surface)', border: '1px dashed var(--ss-border)',
          borderRadius: '14px', padding: '60px', textAlign: 'center',
        }}>
          <div style={{ fontSize: '48px', marginBottom: '12px' }}>🏀</div>
          <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--ss-text)', marginBottom: '8px' }}>NBA Player Props</div>
          <div style={{ fontSize: '13px', color: 'var(--ss-text-muted)' }}>Select a model and click Run Simulations to generate prop picks.</div>
        </div>
      )}
    </div>
  )
}

function NbaGames() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)

  const run = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/nba/games')
      const json = await res.json()
      setData(json)
    } catch (e) {
      setData({ status: 'error', message: e.message, games: [] })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: '15px', color: 'var(--ss-text-muted)' }}>Live spread & total edges for tonight's NBA slate</div>
        </div>
        <button onClick={run} disabled={loading} className="ss-btn-primary">
          {loading ? '⏳ Scanning...' : '🚀 Scan NBA Slate'}
        </button>
      </div>

      {data?.games?.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {data.games.map((g, i) => (
            <div key={i} style={{
              background: 'var(--ss-surface)', border: '1px solid var(--ss-border)',
              borderRadius: '12px', padding: '16px 20px',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '16px', color: 'var(--ss-text)' }}>{g.matchup}</div>
                  <div style={{ fontSize: '12px', color: 'var(--ss-text-muted)', marginTop: '2px' }}>{g.commence_time}</div>
                </div>
                {g.home_ml && (
                  <div style={{ textAlign: 'right', fontSize: '12px', color: 'var(--ss-text-muted)' }}>
                    <div>ML: {g.away_ml > 0 ? `+${g.away_ml}` : g.away_ml} / {g.home_ml > 0 ? `+${g.home_ml}` : g.home_ml}</div>
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: '140px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', padding: '10px 14px' }}>
                  <div style={{ fontSize: '11px', color: 'var(--ss-text-muted)', marginBottom: '4px', textTransform: 'uppercase' }}>Spread</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '14px' }}>Model: {g.model_spread}</div>
                      <div style={{ fontSize: '12px', color: 'var(--ss-text-muted)' }}>Vegas: {g.vegas_spread ?? 'N/A'}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <EdgeBadge edge={g.spread_edge} />
                      <div style={{ marginTop: '2px' }}><StarRating stars={g.spread_stars} /></div>
                    </div>
                  </div>
                </div>
                <div style={{ flex: 1, minWidth: '140px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', padding: '10px 14px' }}>
                  <div style={{ fontSize: '11px', color: 'var(--ss-text-muted)', marginBottom: '4px', textTransform: 'uppercase' }}>Total</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '14px' }}>Model: {g.model_total}</div>
                      <div style={{ fontSize: '12px', color: 'var(--ss-text-muted)' }}>Vegas: {g.vegas_total ?? 'N/A'}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <EdgeBadge edge={g.total_edge} />
                      <div style={{ marginTop: '2px' }}><StarRating stars={g.total_stars} /></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {data?.status === 'ok' && data.games.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--ss-text-muted)' }}>
          No NBA games on the board right now.
        </div>
      )}

      {!data && !loading && (
        <div style={{
          background: 'var(--ss-surface)', border: '1px dashed var(--ss-border)',
          borderRadius: '14px', padding: '60px', textAlign: 'center',
        }}>
          <div style={{ fontSize: '48px', marginBottom: '12px' }}>🏀</div>
          <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--ss-text)', marginBottom: '8px' }}>NBA Game Lines</div>
          <div style={{ fontSize: '13px', color: 'var(--ss-text-muted)' }}>Click Scan NBA Slate to pull today's spread and total edges.</div>
        </div>
      )}
    </div>
  )
}

const TOOLS = [
  { to: '/nba',       label: 'Props', icon: '📊', end: true },
  { to: '/nba/games', label: 'Games', icon: '🏟️' },
  { to: '/nba/dfs',   label: 'DFS',   icon: '🎯' },
]

export default function NbaHub() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '960px', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <span style={{ fontSize: '40px' }}>🏀</span>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 800, margin: 0 }}>NBA</h1>
          <p style={{ fontSize: '13px', color: 'var(--ss-text-muted)', marginTop: '2px', marginBottom: 0 }}>
            Monte Carlo prop simulations · Game line edges · DFS optimizer
          </p>
        </div>
      </div>
      <nav style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
        {TOOLS.map(t => (
          <NavLink key={t.to} to={t.to} end={!!t.end} className={({ isActive }) => 'mlb-subnav-link' + (isActive ? ' active' : '')}>
            <span>{t.icon}</span> {t.label}
          </NavLink>
        ))}
      </nav>
      <Routes>
        <Route index element={<NbaProps />} />
        <Route path="games" element={<NbaGames />} />
        <Route path="dfs" element={<NbaDfs />} />
      </Routes>
    </div>
  )
}
