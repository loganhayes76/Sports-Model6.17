import { useState, useEffect } from 'react'

const SPORT_ICONS = {
  'MLB': '⚾', 'NBA': '🏀', 'NCAA Baseball': '⚾', 'NCAA Hoops': '🏀',
  'NBA Props': '🎯', 'NFL': '🏈',
}

function EdgeBar({ edge }) {
  const abs = Math.abs(parseFloat(edge) || 0)
  const max = 10
  const pct = Math.min((abs / max) * 100, 100)
  const color = abs >= 5 ? '#84cc16' : abs >= 2 ? '#0ea5e9' : '#f59e0b'
  const isOver = parseFloat(edge) > 0
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <span style={{ fontWeight: 700, fontSize: '13px', color, minWidth: '48px' }}>
        {isOver ? `+${abs.toFixed(1)}` : `-${abs.toFixed(1)}`}
      </span>
      <div style={{ flex: 1, height: '6px', background: 'rgba(255,255,255,0.08)', borderRadius: '3px', overflow: 'hidden', minWidth: '60px' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: '3px' }} />
      </div>
    </div>
  )
}

function PlatinumCard({ play, rank }) {
  const MEDALS = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣']
  return (
    <div style={{
      background: 'linear-gradient(135deg, rgba(14,165,233,0.08), rgba(132,204,22,0.04))',
      border: '1px solid rgba(14,165,233,0.3)', borderRadius: '14px', padding: '16px 20px',
      display: 'flex', flexDirection: 'column', gap: '8px', flex: '1 1 180px',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '22px' }}>{MEDALS[rank]}</span>
        <span style={{ fontSize: '20px' }}>{play.icon}</span>
      </div>
      <div style={{ fontWeight: 700, fontSize: '15px', color: 'var(--ss-text)', lineHeight: 1.3 }}>{play.matchup}</div>
      <div style={{ fontSize: '13px', color: 'var(--ss-text-muted)' }}>{play.sport} · {play.market}</div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
        <span style={{ color: '#84cc16', fontWeight: 700, fontSize: '14px' }}>
          {parseFloat(play.edge) > 0 ? '+' : ''}{parseFloat(play.edge).toFixed(1)}% edge
        </span>
        <span style={{ fontSize: '13px', color: 'var(--ss-text-muted)' }}>{play.stars}</span>
      </div>
      <div style={{ fontSize: '12px', color: 'var(--ss-text-muted)' }}>
        Model: {play.proj} vs Vegas: {play.vegas}
      </div>
    </div>
  )
}

export default function MasterBoard() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [sportFilter, setSportFilter] = useState('All')
  const [mktFilter, setMktFilter] = useState('All')
  const [minEdge, setMinEdge] = useState(0)
  const [lastRefresh, setLastRefresh] = useState(null)

  const load = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/master-board')
      const json = await res.json()
      setData(json)
      setLastRefresh(new Date().toLocaleTimeString())
    } catch (e) {
      setData({ status: 'error', message: e.message })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const allSports = data?.plays ? ['All', ...new Set(data.plays.map(p => p.sport))] : ['All']
  const allMkts = data?.plays ? ['All', ...new Set(data.plays.map(p => p.market))] : ['All']

  const filtered = (data?.plays || []).filter(p => {
    if (sportFilter !== 'All' && p.sport !== sportFilter) return false
    if (mktFilter !== 'All' && p.market !== mktFilter) return false
    if (Math.abs(p.edge) < minEdge) return false
    return true
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '960px', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <span style={{ fontSize: '40px' }}>📋</span>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: 800, margin: 0 }}>Master Board</h1>
            <p style={{ fontSize: '13px', color: 'var(--ss-text-muted)', marginTop: '2px', marginBottom: 0 }}>
              All edge plays ranked by model confidence · Every sport, one view
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {lastRefresh && <span style={{ fontSize: '12px', color: 'var(--ss-text-muted)' }}>Updated {lastRefresh}</span>}
          <button onClick={load} disabled={loading} className="ss-btn-primary">
            {loading ? '⏳ Refreshing...' : '🔄 Refresh All'}
          </button>
        </div>
      </div>

      {/* Platinum plays */}
      {data?.platinum?.length > 0 && (
        <div>
          <div style={{ fontWeight: 700, fontSize: '15px', marginBottom: '12px', color: 'var(--ss-text-muted)' }}>
            🏆 TODAY'S TOP 5 PLAYS
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
            {data.platinum.map((play, i) => (
              <PlatinumCard key={i} play={play} rank={i} />
            ))}
          </div>
        </div>
      )}

      {/* Stats row */}
      {data?.plays && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '10px' }}>
          {[
            { label: 'Total Plays', value: data.total_plays, color: 'var(--ss-teal)' },
            { label: 'Elite (≥5%)', value: (data.plays || []).filter(p => Math.abs(p.edge) >= 5).length, color: '#84cc16' },
            { label: 'Value (2-5%)', value: (data.plays || []).filter(p => Math.abs(p.edge) >= 2 && Math.abs(p.edge) < 5).length, color: '#0ea5e9' },
            { label: 'Today', value: data.date, color: 'var(--ss-text-muted)' },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ background: 'var(--ss-surface)', border: '1px solid var(--ss-border)', borderRadius: '10px', padding: '12px', textAlign: 'center' }}>
              <div style={{ fontSize: '18px', fontWeight: 800, color }}>{value}</div>
              <div style={{ fontSize: '11px', color: 'var(--ss-text-muted)', marginTop: '2px' }}>{label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
        <select value={sportFilter} onChange={e => setSportFilter(e.target.value)}
          style={{ background: 'var(--ss-surface)', border: '1px solid var(--ss-border)', color: 'var(--ss-text)', borderRadius: '8px', padding: '7px 12px', fontSize: '13px' }}>
          {allSports.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={mktFilter} onChange={e => setMktFilter(e.target.value)}
          style={{ background: 'var(--ss-surface)', border: '1px solid var(--ss-border)', color: 'var(--ss-text)', borderRadius: '8px', padding: '7px 12px', fontSize: '13px' }}>
          {allMkts.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--ss-text-muted)' }}>
          Min Edge:
          <input type="number" min={0} max={15} step={0.5} value={minEdge}
            onChange={e => setMinEdge(parseFloat(e.target.value) || 0)}
            style={{ width: '60px', background: 'var(--ss-surface)', border: '1px solid var(--ss-border)', color: 'var(--ss-text)', borderRadius: '6px', padding: '5px 8px', fontSize: '13px' }} />%
        </div>
        <span style={{ fontSize: '13px', color: 'var(--ss-text-muted)', marginLeft: 'auto' }}>
          {filtered.length} plays shown
        </span>
      </div>

      {/* Main table */}
      {loading && !data && (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--ss-text-muted)' }}>
          <div style={{ fontSize: '36px', marginBottom: '12px' }}>⏳</div>
          <div>Loading all models...</div>
        </div>
      )}

      {filtered.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--ss-border)' }}>
                {['Sport', 'Matchup', 'Market', 'Model', 'Vegas', 'Edge', 'Stars'].map(h => (
                  <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontSize: '11px', fontWeight: 700, color: 'var(--ss-text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((p, i) => (
                <tr key={i} style={{ borderBottom: '1px solid var(--ss-border)', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}>
                  <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
                    <span style={{ fontSize: '16px' }}>{SPORT_ICONS[p.sport] || '🎯'}</span>
                    <span style={{ marginLeft: '6px', color: 'var(--ss-text-muted)', fontSize: '12px' }}>{p.sport}</span>
                  </td>
                  <td style={{ padding: '10px 12px', fontWeight: 600, maxWidth: '220px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.matchup}</td>
                  <td style={{ padding: '10px 12px', color: 'var(--ss-text-muted)' }}>{p.market}</td>
                  <td style={{ padding: '10px 12px', color: 'var(--ss-teal)', fontWeight: 600, whiteSpace: 'nowrap' }}>{p.proj}</td>
                  <td style={{ padding: '10px 12px', color: 'var(--ss-text-muted)' }}>{p.vegas ?? '—'}</td>
                  <td style={{ padding: '10px 12px', minWidth: '120px' }}><EdgeBar edge={p.edge} /></td>
                  <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>{p.stars}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data?.plays?.length === 0 && !loading && (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--ss-text-muted)' }}>
          <div style={{ fontSize: '36px', marginBottom: '12px' }}>📋</div>
          <div>No edge plays found for today's slate. Check back later or run the individual models.</div>
        </div>
      )}
    </div>
  )
}
