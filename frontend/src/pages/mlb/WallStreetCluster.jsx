import { useState, useEffect } from 'react'

function WARBar({ war }) {
  const max = 8
  const val = Math.max(0, parseFloat(war) || 0)
  const pct = Math.min((val / max) * 100, 100)
  const color = val >= 5 ? '#84cc16' : val >= 3 ? '#0ea5e9' : val >= 1 ? '#f59e0b' : 'var(--ss-text-muted)'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <span style={{ fontWeight: 700, fontSize: '13px', color, minWidth: '36px' }}>{val.toFixed(1)}</span>
      <div style={{ flex: 1, height: '6px', background: 'rgba(255,255,255,0.08)', borderRadius: '3px', overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: '3px' }} />
      </div>
    </div>
  )
}

export default function WallStreetCluster() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [team, setTeam] = useState('')
  const [playerType, setPlayerType] = useState('All')
  const [search, setSearch] = useState('')

  const load = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ player_type: playerType })
      if (team) params.set('team', team)
      const res = await fetch(`/api/mlb/war-cluster?${params}`)
      const json = await res.json()
      setData(json)
    } catch (e) {
      setData({ status: 'error', message: e.message })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [team, playerType])

  const filtered = (data?.players || []).filter(p =>
    !search || p.name?.toLowerCase().includes(search.toLowerCase())
  )

  const batters = filtered.filter(p => p.type === 'Batter')
  const pitchers = filtered.filter(p => p.type === 'Pitcher')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div>
        <div style={{ fontWeight: 700, fontSize: '18px' }}>📊 Wall Street Cluster</div>
        <div style={{ fontSize: '13px', color: 'var(--ss-text-muted)', marginTop: '4px' }}>
          WAR-based player value rankings · {data?.total || 0} players loaded
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          placeholder="Search player..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ flex: 1, minWidth: '180px', background: 'var(--ss-surface)', border: '1px solid var(--ss-border)', color: 'var(--ss-text)', borderRadius: '8px', padding: '8px 12px', fontSize: '13px' }}
        />
        <select value={playerType} onChange={e => setPlayerType(e.target.value)}
          style={{ background: 'var(--ss-surface)', border: '1px solid var(--ss-border)', color: 'var(--ss-text)', borderRadius: '8px', padding: '7px 12px', fontSize: '13px' }}>
          <option value="All">All Players</option>
          <option value="Batter">Batters</option>
          <option value="Pitcher">Pitchers</option>
        </select>
        <select value={team} onChange={e => setTeam(e.target.value)}
          style={{ background: 'var(--ss-surface)', border: '1px solid var(--ss-border)', color: 'var(--ss-text)', borderRadius: '8px', padding: '7px 12px', fontSize: '13px' }}>
          <option value="">All Teams</option>
          {(data?.teams || []).map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      {loading && (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--ss-text-muted)' }}>Loading WAR data...</div>
      )}

      {!loading && filtered.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(440px, 1fr))', gap: '20px' }}>
          {playerType !== 'Pitcher' && batters.length > 0 && (
            <div>
              <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '10px', color: 'var(--ss-teal)' }}>
                🏏 Top Batters ({batters.length})
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--ss-border)' }}>
                      {['Player', 'Team', 'WAR'].map(h => (
                        <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: '11px', fontWeight: 700, color: 'var(--ss-text-muted)', textTransform: 'uppercase' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {batters.slice(0, 30).map((p, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid var(--ss-border)', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}>
                        <td style={{ padding: '8px 12px', fontWeight: 600 }}>{p.name}</td>
                        <td style={{ padding: '8px 12px' }}>
                          <span style={{ background: 'rgba(14,165,233,0.1)', color: 'var(--ss-teal)', padding: '2px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 700 }}>{p.team}</span>
                        </td>
                        <td style={{ padding: '8px 12px', minWidth: '120px' }}>
                          <WARBar war={p.last_season_war} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {playerType !== 'Batter' && pitchers.length > 0 && (
            <div>
              <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '10px', color: '#84cc16' }}>
                ⚾ Top Pitchers ({pitchers.length})
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--ss-border)' }}>
                      {['Pitcher', 'Team', 'WAR'].map(h => (
                        <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: '11px', fontWeight: 700, color: 'var(--ss-text-muted)', textTransform: 'uppercase' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {pitchers.slice(0, 30).map((p, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid var(--ss-border)', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}>
                        <td style={{ padding: '8px 12px', fontWeight: 600 }}>{p.name}</td>
                        <td style={{ padding: '8px 12px' }}>
                          <span style={{ background: 'rgba(132,204,22,0.1)', color: '#84cc16', padding: '2px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 700 }}>{p.team}</span>
                        </td>
                        <td style={{ padding: '8px 12px', minWidth: '120px' }}>
                          <WARBar war={p.last_season_war} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {!loading && filtered.length === 0 && data && (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--ss-text-muted)' }}>
          No players match your filters.
        </div>
      )}
    </div>
  )
}
