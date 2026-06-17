import { useState, useEffect } from 'react'

const GRADE_COLORS = { 'A+': '#84cc16', 'A': '#84cc16', 'B+': '#0ea5e9', 'B': '#0ea5e9', 'C+': '#f59e0b', 'C': '#f87171' }

function GradeChip({ grade }) {
  const color = GRADE_COLORS[grade] || 'var(--ss-text-muted)'
  return (
    <span style={{ padding: '2px 8px', borderRadius: '10px', fontSize: '12px', fontWeight: 800, background: `${color}20`, color, border: `1px solid ${color}40` }}>
      {grade}
    </span>
  )
}

function ZBar({ z }) {
  const clamped = Math.max(-3, Math.min(3, z))
  const pct = ((clamped + 3) / 6) * 100
  const color = z >= 1.5 ? '#84cc16' : z >= 0.5 ? '#0ea5e9' : z >= -0.5 ? '#f59e0b' : '#f87171'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <span style={{ fontSize: '12px', fontWeight: 700, color, minWidth: '36px' }}>{z.toFixed(2)}</span>
      <div style={{ flex: 1, height: '6px', background: 'rgba(255,255,255,0.08)', borderRadius: '3px', position: 'relative' }}>
        <div style={{ position: 'absolute', left: `${100 / 6 * 3}%`, top: 0, bottom: 0, width: '1px', background: 'rgba(255,255,255,0.2)' }} />
        <div style={{ position: 'absolute', left: `${Math.min(pct, 50)}%`, right: `${Math.max(0, 100 - pct)}%`, top: 0, bottom: 0, background: color, borderRadius: '3px', maxWidth: `${Math.abs(pct - 50)}%`, minWidth: '2px' }} />
      </div>
    </div>
  )
}

export default function FantasyDraftBoard() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [playerType, setPlayerType] = useState('All')
  const [search, setSearch] = useState('')
  const [draftUser, setDraftUser] = useState('kate')
  const [roster, setRoster] = useState([])
  const [draftState, setDraftState] = useState({ league_size: 12, draft_slot: 1 })
  const [savingState, setSavingState] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ player_type: playerType, limit: 100 })
      const res = await fetch(`/api/fantasy/draft-board?${params}`)
      const json = await res.json()
      setData(json)
    } catch (e) { setData({ status: 'error', message: e.message }) }
    finally { setLoading(false) }
  }

  const loadDraftState = async () => {
    try {
      const res = await fetch(`/api/fantasy/draft-state/${draftUser}`)
      const json = await res.json()
      if (json.status === 'ok') {
        setRoster(json.state.roster || [])
        setDraftState({ league_size: json.state.league_size || 12, draft_slot: json.state.draft_slot || 1 })
      }
    } catch (e) {}
  }

  const saveDraftState = async () => {
    setSavingState(true)
    try {
      await fetch(`/api/fantasy/draft-state/${draftUser}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...draftState, roster }),
      })
    } catch (e) {}
    finally { setSavingState(false) }
  }

  useEffect(() => { load() }, [playerType])
  useEffect(() => { loadDraftState() }, [draftUser])

  const draftPlayer = (player) => {
    if (roster.find(r => r.name === player.name)) return
    const newRoster = [...roster, { name: player.name, team: player.team, type: player.type, war: player.last_season_war, grade: player.grade }]
    setRoster(newRoster)
  }

  const dropPlayer = (name) => {
    setRoster(r => r.filter(p => p.name !== name))
  }

  const filtered = (data?.players || []).filter(p =>
    !search || p.name?.toLowerCase().includes(search.toLowerCase()) || p.team?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div>
        <div style={{ fontWeight: 700, fontSize: '18px' }}>⚾ Fantasy Draft Board</div>
        <div style={{ fontSize: '13px', color: 'var(--ss-text-muted)', marginTop: '4px' }}>
          WAR Z-Score rankings · ADP estimates · Track your draft roster
        </div>
      </div>

      {/* Draft session controls */}
      <div style={{ background: 'var(--ss-surface)', border: '1px solid var(--ss-border)', borderRadius: '12px', padding: '16px 20px', display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'flex-end' }}>
        <div>
          <label style={{ fontSize: '11px', color: 'var(--ss-text-muted)', display: 'block', marginBottom: '5px' }}>DRAFTER</label>
          <select value={draftUser} onChange={e => setDraftUser(e.target.value)}
            style={{ background: 'var(--ss-bg)', border: '1px solid var(--ss-border)', color: 'var(--ss-text)', borderRadius: '8px', padding: '7px 12px', fontSize: '13px' }}>
            <option value="kate">Kate</option>
            <option value="logan">Logan</option>
          </select>
        </div>
        <div>
          <label style={{ fontSize: '11px', color: 'var(--ss-text-muted)', display: 'block', marginBottom: '5px' }}>LEAGUE SIZE</label>
          <select value={draftState.league_size} onChange={e => setDraftState(s => ({ ...s, league_size: parseInt(e.target.value) }))}
            style={{ background: 'var(--ss-bg)', border: '1px solid var(--ss-border)', color: 'var(--ss-text)', borderRadius: '8px', padding: '7px 12px', fontSize: '13px' }}>
            {[8, 10, 12, 14, 16].map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
        <div>
          <label style={{ fontSize: '11px', color: 'var(--ss-text-muted)', display: 'block', marginBottom: '5px' }}>DRAFT SLOT</label>
          <select value={draftState.draft_slot} onChange={e => setDraftState(s => ({ ...s, draft_slot: parseInt(e.target.value) }))}
            style={{ background: 'var(--ss-bg)', border: '1px solid var(--ss-border)', color: 'var(--ss-text)', borderRadius: '8px', padding: '7px 12px', fontSize: '13px' }}>
            {Array.from({ length: draftState.league_size }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)}
          </select>
        </div>
        <button onClick={saveDraftState} disabled={savingState} className="ss-btn-primary">
          {savingState ? '⏳ Saving...' : '💾 Save Roster'}
        </button>
      </div>

      {/* Roster */}
      {roster.length > 0 && (
        <div style={{ background: 'var(--ss-surface)', border: '1px solid var(--ss-border)', borderRadius: '12px', padding: '16px 20px' }}>
          <div style={{ fontWeight: 600, marginBottom: '10px' }}>🏆 My Roster ({draftUser.charAt(0).toUpperCase() + draftUser.slice(1)}) — {roster.length} players</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {roster.map(p => (
              <div key={p.name} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(14,165,233,0.08)', border: '1px solid rgba(14,165,233,0.2)', borderRadius: '8px', padding: '5px 10px', fontSize: '12px' }}>
                <span style={{ fontWeight: 600 }}>{p.name}</span>
                <span style={{ color: 'var(--ss-text-muted)' }}>{p.team}</span>
                <GradeChip grade={p.grade} />
                <button onClick={() => dropPlayer(p.name)} style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: '13px', padding: 0 }}>×</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        <input placeholder="Search player or team..." value={search} onChange={e => setSearch(e.target.value)}
          style={{ flex: 1, minWidth: '200px', background: 'var(--ss-surface)', border: '1px solid var(--ss-border)', color: 'var(--ss-text)', borderRadius: '8px', padding: '8px 12px', fontSize: '13px' }} />
        {['All', 'Batter', 'Pitcher'].map(t => (
          <button key={t} onClick={() => setPlayerType(t)} style={{
            padding: '7px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
            border: playerType === t ? '1px solid var(--ss-teal)' : '1px solid var(--ss-border)',
            background: playerType === t ? 'rgba(14,165,233,0.15)' : 'transparent',
            color: playerType === t ? 'var(--ss-teal)' : 'var(--ss-text-muted)',
          }}>{t}</button>
        ))}
      </div>

      {loading && <div style={{ textAlign: 'center', padding: '40px', color: 'var(--ss-text-muted)' }}>⏳ Loading rankings...</div>}

      {!loading && filtered.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--ss-border)' }}>
                {['ADP', 'Player', 'Team', 'Type', 'WAR', 'Z-Score', 'Grade', ''].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: '11px', fontWeight: 700, color: 'var(--ss-text-muted)', textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((p, i) => {
                const isDrafted = roster.find(r => r.name === p.name)
                return (
                  <tr key={i} style={{ borderBottom: '1px solid var(--ss-border)', background: isDrafted ? 'rgba(132,204,22,0.04)' : i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)', opacity: isDrafted ? 0.6 : 1 }}>
                    <td style={{ padding: '8px 14px', color: 'var(--ss-text-muted)', fontSize: '12px', fontWeight: 700 }}>{p.adp}</td>
                    <td style={{ padding: '8px 14px', fontWeight: 600 }}>
                      {isDrafted && <span style={{ marginRight: '6px', fontSize: '10px', color: '#84cc16' }}>✓</span>}
                      {p.name}
                    </td>
                    <td style={{ padding: '8px 14px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--ss-teal)', background: 'rgba(14,165,233,0.1)', padding: '2px 7px', borderRadius: '4px' }}>{p.team}</span>
                    </td>
                    <td style={{ padding: '8px 14px', color: 'var(--ss-text-muted)', fontSize: '12px' }}>{p.type}</td>
                    <td style={{ padding: '8px 14px', fontWeight: 600, color: parseFloat(p.last_season_war) >= 3 ? '#84cc16' : 'var(--ss-text)' }}>
                      {parseFloat(p.last_season_war || 0).toFixed(1)}
                    </td>
                    <td style={{ padding: '8px 14px', minWidth: '140px' }}>
                      <ZBar z={p.war_z} />
                    </td>
                    <td style={{ padding: '8px 14px' }}>
                      <GradeChip grade={p.grade} />
                    </td>
                    <td style={{ padding: '8px 14px' }}>
                      <button
                        onClick={() => isDrafted ? dropPlayer(p.name) : draftPlayer(p)}
                        style={{ padding: '4px 12px', borderRadius: '6px', fontSize: '11px', fontWeight: 700, cursor: 'pointer', border: 'none', background: isDrafted ? 'rgba(239,68,68,0.1)' : 'rgba(14,165,233,0.15)', color: isDrafted ? '#f87171' : 'var(--ss-teal)' }}
                      >
                        {isDrafted ? 'Drop' : 'Draft'}
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
