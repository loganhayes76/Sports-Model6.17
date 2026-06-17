import { useState, useEffect } from 'react'
import { Routes, Route, NavLink } from 'react-router-dom'

const TRACK_TYPES = ['Intermediate (1.5m)', 'Short Track', 'Superspeedway', 'Road Course']
const TRACK_WEAR_OPTIONS = ['Low', 'Medium', 'High']

function EdgeBadge({ edge }) {
  const color = edge >= 5 ? '#84cc16' : edge >= 2 ? '#0ea5e9' : edge >= 0 ? '#f59e0b' : '#f87171'
  return (
    <span style={{ padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: 700, background: `${color}20`, color }}>
      {edge > 0 ? `+${edge.toFixed(1)}%` : `${edge.toFixed(1)}%`}
    </span>
  )
}

function NascarModel() {
  const [trackType, setTrackType] = useState('Intermediate (1.5m)')
  const [trackWear, setTrackWear] = useState('Medium')
  const [temp, setTemp] = useState(95)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState('all')
  const [uploadLoading, setUploadLoading] = useState(false)
  const [uploadMsg, setUploadMsg] = useState('')
  const adminToken = localStorage.getItem('ss_admin_token') || ''

  const load = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ track_type: trackType, track_wear: trackWear, temp })
      const res = await fetch(`/api/nascar/model?${params}`)
      const json = await res.json()
      setData(json)
    } catch (e) { setData({ status: 'error', message: e.message, drivers: [] }) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [trackType, trackWear, temp])

  const handleFile = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setUploadLoading(true)
    setUploadMsg('')
    const form = new FormData()
    form.append('file', file)
    try {
      const res = await fetch('/api/nascar/upload-csv', {
        method: 'POST',
        headers: { 'x-admin-token': adminToken },
        body: form,
      })
      const json = await res.json()
      if (json.status === 'ok') {
        setUploadMsg(`✅ Parsed ${json.drivers_parsed} drivers`)
        await load()
      } else {
        setUploadMsg(`⚠️ ${json.message}`)
      }
    } catch (e) { setUploadMsg(`⚠️ ${e.message}`) }
    finally { setUploadLoading(false) }
  }

  const drivers = (data?.drivers || []).filter(d => {
    if (filter === 'value') return d.best_edge > 0
    if (filter === 'fade') return d.best_edge < 0
    return true
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'flex-end' }}>
        <div>
          <label style={{ fontSize: '11px', color: 'var(--ss-text-muted)', display: 'block', marginBottom: '5px' }}>TRACK TYPE</label>
          <select value={trackType} onChange={e => setTrackType(e.target.value)}
            style={{ background: 'var(--ss-surface)', border: '1px solid var(--ss-border)', color: 'var(--ss-text)', borderRadius: '8px', padding: '7px 12px', fontSize: '13px' }}>
            {TRACK_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label style={{ fontSize: '11px', color: 'var(--ss-text-muted)', display: 'block', marginBottom: '5px' }}>TIRE WEAR (GOODYEAR)</label>
          <select value={trackWear} onChange={e => setTrackWear(e.target.value)}
            style={{ background: 'var(--ss-surface)', border: '1px solid var(--ss-border)', color: 'var(--ss-text)', borderRadius: '8px', padding: '7px 12px', fontSize: '13px' }}>
            {TRACK_WEAR_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label style={{ fontSize: '11px', color: 'var(--ss-text-muted)', display: 'block', marginBottom: '5px' }}>TRACK TEMP (°F): {temp}</label>
          <input type="range" min={60} max={140} step={5} value={temp} onChange={e => setTemp(Number(e.target.value))}
            style={{ width: '140px' }} />
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {['all', 'value', 'fade'].map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{
              padding: '7px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: 600, cursor: 'pointer',
              border: filter === f ? '1px solid var(--ss-teal)' : '1px solid var(--ss-border)',
              background: filter === f ? 'rgba(14,165,233,0.15)' : 'transparent',
              color: filter === f ? 'var(--ss-teal)' : 'var(--ss-text-muted)',
              textTransform: 'capitalize',
            }}>
              {f === 'all' ? 'All' : f === 'value' ? '✅ Value' : '❌ Fade'}
            </button>
          ))}
        </div>
      </div>

      {/* CSV Upload */}
      <div style={{ background: 'rgba(14,165,233,0.05)', border: '1px solid rgba(14,165,233,0.15)', borderRadius: '10px', padding: '14px 18px', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '13px', color: 'var(--ss-text-muted)' }}>📥 Upload BetMGM Grid CSV:</span>
        <label style={{
          padding: '7px 14px', borderRadius: '8px', border: '1px solid var(--ss-teal)', color: 'var(--ss-teal)',
          background: 'rgba(14,165,233,0.1)', fontSize: '12px', fontWeight: 600, cursor: 'pointer',
        }}>
          {uploadLoading ? '⏳ Uploading...' : 'Choose File'}
          <input type="file" accept=".csv" onChange={handleFile} style={{ display: 'none' }} />
        </label>
        {uploadMsg && <span style={{ fontSize: '12px', color: uploadMsg.startsWith('✅') ? '#84cc16' : '#f87171' }}>{uploadMsg}</span>}
      </div>

      {loading && <div style={{ textAlign: 'center', padding: '40px', color: 'var(--ss-text-muted)' }}>⏳ Computing Harville model...</div>}

      {!loading && data?.message && drivers.length === 0 && (
        <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: '12px', padding: '24px', textAlign: 'center', color: '#f59e0b' }}>
          <div style={{ fontSize: '40px', marginBottom: '8px' }}>🏁</div>
          <div style={{ fontWeight: 600 }}>{data.message}</div>
          <div style={{ fontSize: '13px', color: 'var(--ss-text-muted)', marginTop: '8px' }}>Upload a BetMGM race grid CSV above to populate the model.</div>
        </div>
      )}

      {!loading && drivers.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {drivers.map((d, i) => (
            <div key={i} style={{ background: 'var(--ss-surface)', border: '1px solid var(--ss-border)', borderRadius: '12px', overflow: 'hidden' }}>
              <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--ss-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                <div style={{ fontWeight: 700, fontSize: '15px' }}>{d.name}</div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <span style={{ fontSize: '12px', color: 'var(--ss-text-muted)' }}>Win: {d.win_odds > 0 ? `+${d.win_odds}` : d.win_odds} ({d.win_prob})</span>
                  <span style={{ fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '10px', background: d.best_edge > 0 ? 'rgba(132,204,22,0.1)' : 'rgba(239,68,68,0.1)', color: d.best_edge > 0 ? '#84cc16' : '#f87171' }}>
                    Best Edge: {d.best_edge > 0 ? `+${d.best_edge.toFixed(1)}%` : `${d.best_edge.toFixed(1)}%`}
                  </span>
                </div>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--ss-border)' }}>
                      {['Market', 'Vegas Odds', 'Vegas Prob', 'Model Prob', 'Model Odds', 'Edge', 'Stars'].map(h => (
                        <th key={h} style={{ padding: '8px 14px', textAlign: 'left', fontSize: '11px', fontWeight: 700, color: 'var(--ss-text-muted)', textTransform: 'uppercase' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {d.markets.map((m, j) => (
                      <tr key={j} style={{ borderBottom: '1px solid var(--ss-border)', background: j % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}>
                        <td style={{ padding: '8px 14px', fontWeight: 600 }}>{m.market}</td>
                        <td style={{ padding: '8px 14px', color: m.vegas_odds > 0 ? '#84cc16' : '#f87171', fontWeight: 600 }}>
                          {m.vegas_odds > 0 ? `+${m.vegas_odds}` : m.vegas_odds}
                        </td>
                        <td style={{ padding: '8px 14px', color: 'var(--ss-text-muted)' }}>{m.vegas_prob}</td>
                        <td style={{ padding: '8px 14px', color: 'var(--ss-teal)', fontWeight: 600 }}>{m.model_prob}</td>
                        <td style={{ padding: '8px 14px', color: 'var(--ss-text)' }}>{m.model_odds}</td>
                        <td style={{ padding: '8px 14px' }}><EdgeBadge edge={m.edge} /></td>
                        <td style={{ padding: '8px 14px' }}>{m.stars}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const NASCAR_TABS = [
  { to: '', label: '🏁 Predictive Model', exact: true },
  { to: 'dfs', label: '🎯 DFS Optimizer' },
]

export default function NascarHub() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '1080px', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <span style={{ fontSize: '40px' }}>🏎️</span>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 800, margin: 0 }}>NASCAR</h1>
          <p style={{ fontSize: '13px', color: 'var(--ss-text-muted)', marginTop: '2px', marginBottom: 0 }}>
            Harville Expansion model · Top 3/5/10 edges · DFS lineup optimizer
          </p>
        </div>
      </div>

      <nav style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
        {NASCAR_TABS.map(t => (
          <NavLink key={t.to} to={t.to} end={t.exact || t.to === ''} className={({ isActive }) => 'mlb-subnav-link' + (isActive ? ' active' : '')}>
            {t.label}
          </NavLink>
        ))}
      </nav>

      <Routes>
        <Route index element={<NascarModel />} />
        <Route path="dfs" element={
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--ss-text-muted)' }}>
            <div style={{ fontSize: '40px', marginBottom: '12px' }}>🎯</div>
            <div style={{ fontWeight: 600, fontSize: '16px' }}>NASCAR DFS Optimizer</div>
            <div style={{ fontSize: '13px', marginTop: '8px' }}>
              Use the <a href="/dfs/nascar" style={{ color: 'var(--ss-teal)' }}>DFS Hub → NASCAR tab</a> to upload your CSV and build lineups.
            </div>
          </div>
        } />
      </Routes>
    </div>
  )
}
