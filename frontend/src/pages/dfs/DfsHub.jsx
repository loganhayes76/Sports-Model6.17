import { useState, useRef } from 'react'
import { Routes, Route, NavLink } from 'react-router-dom'

const SPORT_CONFIG = {
  MLB: {
    icon: '⚾', label: 'MLB',
    description: 'DraftKings MLB — 2P, 1C, 1-1B, 1-2B, 1-3B, 1-SS, 3-OF · $50K cap · 10 players',
    hasStack: true,
  },
  NBA: {
    icon: '🏀', label: 'NBA',
    description: 'DraftKings NBA — PG, SG, SF, PF, C, G, F, UTIL · $50K cap · 8 players',
    hasStack: false,
  },
  UFC: {
    icon: '🥊', label: 'UFC',
    description: 'DraftKings MMA — 6 fighters · $50K cap',
    hasStack: false,
  },
  PGA: {
    icon: '⛳', label: 'PGA',
    description: 'DraftKings PGA — 6 golfers · $50K cap',
    hasStack: false,
  },
  NASCAR: {
    icon: '🏎️', label: 'NASCAR',
    description: 'DraftKings NASCAR — 6 drivers · $50K cap',
    hasStack: false,
  },
}

function DfsOptimizer({ sport }) {
  const config = SPORT_CONFIG[sport]
  const [csvText, setCsvText] = useState('')
  const [players, setPlayers] = useState([])
  const [teams, setTeams] = useState([])
  const [locks, setLocks] = useState([])
  const [scratches, setScratches] = useState([])
  const [numLineups, setNumLineups] = useState(5)
  const [mode, setMode] = useState('cash')
  const [stackTeam, setStackTeam] = useState('')
  const [stackSize, setStackSize] = useState(4)
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef()

  const handleFile = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    const text = await file.text()
    setCsvText(text)
    const lines = text.trim().split('\n')
    if (lines.length < 2) return
    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''))
    const nameIdx = headers.findIndex(h => h === 'Name')
    const teamIdx = headers.findIndex(h => h === 'TeamAbbrev')
    if (nameIdx < 0) return
    const parsed = []
    const teamSet = new Set()
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',').map(c => c.trim().replace(/"/g, ''))
      const name = cols[nameIdx]
      if (name) {
        parsed.push(name)
        if (teamIdx >= 0 && cols[teamIdx]) teamSet.add(cols[teamIdx])
      }
    }
    setPlayers(parsed)
    setTeams([...teamSet].sort())
    setLocks([])
    setScratches([])
    setResult(null)
    setError('')
  }

  const optimize = async () => {
    if (!csvText) { setError('Please upload a CSV file first.'); return }
    setLoading(true)
    setError('')
    try {
      const body = {
        sport,
        csv_text: csvText,
        locks,
        scratches,
        num_lineups: numLineups,
        mode,
        stack_team: config.hasStack ? stackTeam : '',
        stack_size: config.hasStack ? stackSize : 0,
      }
      const res = await fetch('/api/dfs/optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (json.status === 'error') {
        setError(json.message)
        setResult(null)
      } else {
        setResult(json)
      }
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const clearSlate = () => {
    setCsvText(''); setPlayers([]); setTeams([])
    setLocks([]); setScratches([]); setResult(null); setError('')
    if (fileRef.current) fileRef.current.value = ''
  }

  const toggle = (name, list, setList) =>
    setList(prev => prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name])

  const availableForLock = players.filter(p => !scratches.includes(p))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ background: 'var(--ss-surface)', border: '1px solid var(--ss-border)', borderRadius: '14px', padding: '20px' }}>
        <div style={{ fontSize: '13px', color: 'var(--ss-text-muted)', marginBottom: '16px' }}>{config.description}</div>
        {!csvText ? (
          <div
            onClick={() => fileRef.current?.click()}
            style={{ border: '2px dashed var(--ss-border)', borderRadius: '12px', padding: '40px', textAlign: 'center', cursor: 'pointer' }}
            onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--ss-teal)'}
            onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--ss-border)'}
          >
            <div style={{ fontSize: '36px', marginBottom: '8px' }}>📥</div>
            <div style={{ fontWeight: 600, marginBottom: '4px' }}>Upload DraftKings {sport} CSV</div>
            <div style={{ fontSize: '13px', color: 'var(--ss-text-muted)' }}>Click to select your DKSalaries CSV file</div>
            <input ref={fileRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={handleFile} />
          </div>
        ) : (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '20px' }}>✅</span>
              <div>
                <div style={{ fontWeight: 600 }}>{players.length} players loaded</div>
                <div style={{ fontSize: '12px', color: 'var(--ss-text-muted)' }}>Slate active · Ready to optimize</div>
              </div>
            </div>
            <button onClick={clearSlate} style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171', borderRadius: '8px', padding: '6px 14px', fontSize: '13px', cursor: 'pointer' }}>
              🗑️ Clear Slate
            </button>
          </div>
        )}
      </div>

      {csvText && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '16px' }}>
            <div>
              <label style={{ fontSize: '12px', color: 'var(--ss-text-muted)', display: 'block', marginBottom: '6px' }}>MODE</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                {['cash', 'gpp'].map(m => (
                  <button key={m} onClick={() => setMode(m)} style={{ flex: 1, padding: '8px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', border: mode === m ? '1px solid var(--ss-teal)' : '1px solid var(--ss-border)', background: mode === m ? 'rgba(14,165,233,0.15)' : 'transparent', color: mode === m ? 'var(--ss-teal)' : 'var(--ss-text-muted)' }}>
                    {m === 'cash' ? '💰 Cash' : '🏆 GPP'}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label style={{ fontSize: '12px', color: 'var(--ss-text-muted)', display: 'block', marginBottom: '6px' }}>LINEUPS: {numLineups}</label>
              <input type="range" min={1} max={20} value={numLineups} onChange={e => setNumLineups(parseInt(e.target.value))} style={{ width: '100%' }} />
            </div>
            {config.hasStack && teams.length > 0 && (
              <>
                <div>
                  <label style={{ fontSize: '12px', color: 'var(--ss-text-muted)', display: 'block', marginBottom: '6px' }}>STACK TEAM</label>
                  <select value={stackTeam} onChange={e => setStackTeam(e.target.value)} style={{ width: '100%', background: 'var(--ss-bg)', border: '1px solid var(--ss-border)', color: 'var(--ss-text)', borderRadius: '8px', padding: '8px 10px', fontSize: '14px' }}>
                    <option value="">None</option>
                    {teams.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                {stackTeam && (
                  <div>
                    <label style={{ fontSize: '12px', color: 'var(--ss-text-muted)', display: 'block', marginBottom: '6px' }}>STACK SIZE: {stackSize}</label>
                    <input type="range" min={3} max={5} value={stackSize} onChange={e => setStackSize(parseInt(e.target.value))} style={{ width: '100%' }} />
                  </div>
                )}
              </>
            )}
          </div>

          {players.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              {[
                { title: '🔒 Player Locks', list: locks, setList: setLocks, pool: availableForLock },
                { title: '❌ Scratches', list: scratches, setList: setScratches, pool: players },
              ].map(({ title, list, setList, pool }) => (
                <div key={title} style={{ background: 'var(--ss-surface)', border: '1px solid var(--ss-border)', borderRadius: '12px', padding: '16px' }}>
                  <div style={{ fontWeight: 600, marginBottom: '10px', fontSize: '14px' }}>{title} <span style={{ fontWeight: 400, fontSize: '12px', color: 'var(--ss-text-muted)' }}>({list.length})</span></div>
                  <div style={{ maxHeight: '160px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                    {pool.map(p => (
                      <label key={p} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer', padding: '2px 0' }}>
                        <input type="checkbox" checked={list.includes(p)} onChange={() => toggle(p, list, setList)} />
                        {p}
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {error && <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '10px', padding: '14px 18px', color: '#f87171' }}>⚠️ {error}</div>}

          <button onClick={optimize} disabled={loading} className="ss-btn-primary" style={{ fontSize: '15px', padding: '12px 24px' }}>
            {loading ? '⏳ Solving LP Matrix...' : `🧬 Generate ${numLineups} ${mode.toUpperCase()} Lineups`}
          </button>

          {result && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                {[
                  { label: 'Lineups', value: result.total_lineups, color: 'var(--ss-teal)' },
                  { label: 'Best Proj', value: result.lineups[0]?.total_proj?.toFixed(1), color: '#84cc16' },
                  { label: 'Best Salary', value: `$${result.lineups[0]?.total_salary?.toLocaleString()}`, color: '#f59e0b' },
                ].map(({ label, value, color }) => (
                  <div key={label} style={{ flex: 1, minWidth: '100px', background: 'var(--ss-surface)', border: '1px solid var(--ss-border)', borderRadius: '10px', padding: '14px 20px', textAlign: 'center' }}>
                    <div style={{ fontSize: '22px', fontWeight: 800, color }}>{value}</div>
                    <div style={{ fontSize: '11px', color: 'var(--ss-text-muted)', marginTop: '2px' }}>{label}</div>
                  </div>
                ))}
              </div>
              {result.lineups.map((lineup, li) => (
                <details key={li} style={{ background: 'var(--ss-surface)', border: '1px solid var(--ss-border)', borderRadius: '12px', overflow: 'hidden' }}>
                  <summary style={{ padding: '14px 20px', cursor: 'pointer', fontWeight: 600 }}>
                    {mode === 'gpp' ? '🏆' : '💰'} Lineup #{li + 1}
                    <span style={{ fontWeight: 400, color: 'var(--ss-text-muted)', marginLeft: '12px', fontSize: '13px' }}>
                      Proj: {lineup.total_proj?.toFixed(1)} · ${lineup.total_salary?.toLocaleString()}
                    </span>
                  </summary>
                  <div style={{ padding: '0 20px 16px', overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                      <thead><tr style={{ borderBottom: '1px solid var(--ss-border)' }}>
                        {['Pos', 'Player', 'Team', 'Salary', 'Proj', 'Source'].map(h => (
                          <th key={h} style={{ padding: '8px', textAlign: 'left', fontSize: '11px', fontWeight: 700, color: 'var(--ss-text-muted)', textTransform: 'uppercase' }}>{h}</th>
                        ))}
                      </tr></thead>
                      <tbody>
                        {lineup.players.map((p, pi) => (
                          <tr key={pi} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                            <td style={{ padding: '8px', fontWeight: 700, color: 'var(--ss-teal)', fontSize: '12px' }}>{p.pos || '—'}</td>
                            <td style={{ padding: '8px', fontWeight: 600 }}>{p.name}</td>
                            <td style={{ padding: '8px', color: 'var(--ss-text-muted)' }}>{p.team || '—'}</td>
                            <td style={{ padding: '8px' }}>${p.salary?.toLocaleString()}</td>
                            <td style={{ padding: '8px', color: '#84cc16', fontWeight: 600 }}>{p.proj?.toFixed(1)}</td>
                            <td style={{ padding: '8px', color: 'var(--ss-text-muted)', fontSize: '12px' }}>{p.source || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </details>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

const TOOLS = [
  { to: '/dfs',        sport: 'MLB',    label: '⚾ MLB', end: true },
  { to: '/dfs/nba',    sport: 'NBA',    label: '🏀 NBA' },
  { to: '/dfs/ufc',    sport: 'UFC',    label: '🥊 UFC' },
  { to: '/dfs/pga',    sport: 'PGA',    label: '⛳ PGA' },
  { to: '/dfs/nascar', sport: 'NASCAR', label: '🏎️ NASCAR' },
]

export default function DfsHub() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '960px', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <span style={{ fontSize: '40px' }}>🎯</span>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 800, margin: 0 }}>DFS Optimizer</h1>
          <p style={{ fontSize: '13px', color: 'var(--ss-text-muted)', marginTop: '2px', marginBottom: 0 }}>
            Upload a DraftKings salary CSV · LP optimizer · Cash &amp; GPP modes
          </p>
        </div>
      </div>
      <nav style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
        {TOOLS.map(t => (
          <NavLink key={t.to} to={t.to} end={!!t.end} className={({ isActive }) => 'mlb-subnav-link' + (isActive ? ' active' : '')}>
            {t.label}
          </NavLink>
        ))}
      </nav>
      <Routes>
        <Route index element={<DfsOptimizer sport="MLB" />} />
        <Route path="nba" element={<DfsOptimizer sport="NBA" />} />
        <Route path="ufc" element={<DfsOptimizer sport="UFC" />} />
        <Route path="pga" element={<DfsOptimizer sport="PGA" />} />
        <Route path="nascar" element={<DfsOptimizer sport="NASCAR" />} />
      </Routes>
    </div>
  )
}
