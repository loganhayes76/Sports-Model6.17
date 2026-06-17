import { useState } from 'react'

const EXAMPLE_HINT = 'Paste DraftKings NBA export CSV (Name, Position, Salary, AvgPointsPerGame, TeamAbbrev...)'

function LineupCard({ lineup, idx }) {
  return (
    <div style={{ background: 'var(--ss-surface)', border: '1px solid var(--ss-border)', borderRadius: '12px', overflow: 'hidden', marginBottom: '12px' }}>
      <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--ss-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(14,165,233,0.06)' }}>
        <span style={{ fontWeight: 700, color: 'var(--ss-teal)', fontSize: '14px' }}>Lineup #{idx + 1}</span>
        <div style={{ display: 'flex', gap: '16px', fontSize: '12px', color: 'var(--ss-text-muted)' }}>
          <span>Salary: <strong style={{ color: 'var(--ss-text)' }}>${lineup.total_salary?.toLocaleString()}</strong></span>
          <span>Proj: <strong style={{ color: '#84cc16' }}>{lineup.total_proj?.toFixed(1)}</strong></span>
        </div>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--ss-border)' }}>
            {['Slot', 'Player', 'Pos', 'Salary', 'Proj'].map(h => (
              <th key={h} style={{ padding: '7px 14px', textAlign: 'left', fontSize: '10px', fontWeight: 700, color: 'var(--ss-text-muted)', textTransform: 'uppercase' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {(lineup.players || []).map((p, i) => (
            <tr key={i} style={{ borderBottom: '1px solid var(--ss-border)', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}>
              <td style={{ padding: '7px 14px', fontSize: '11px', fontWeight: 700, color: 'var(--ss-teal)' }}>{p.slot}</td>
              <td style={{ padding: '7px 14px', fontWeight: 600 }}>{p.name}</td>
              <td style={{ padding: '7px 14px', color: 'var(--ss-text-muted)' }}>{p.pos}</td>
              <td style={{ padding: '7px 14px' }}>${p.salary?.toLocaleString()}</td>
              <td style={{ padding: '7px 14px', color: '#84cc16', fontWeight: 600 }}>{p.proj?.toFixed(1)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function NbaDfs() {
  const [csvText, setCsvText] = useState('')
  const [locks, setLocks] = useState('')
  const [scratches, setScratches] = useState('')
  const [numLineups, setNumLineups] = useState(10)
  const [mode, setMode] = useState('cash')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)

  const handleFile = (e) => {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => setCsvText(ev.target.result || '')
    reader.readAsText(file)
  }

  const run = async () => {
    if (!csvText.trim()) return
    setLoading(true)
    setResult(null)
    try {
      const res = await fetch('/api/nba/dfs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          csv_text: csvText,
          locks: locks.split(',').map(s => s.trim()).filter(Boolean),
          scratches: scratches.split(',').map(s => s.trim()).filter(Boolean),
          num_lineups: numLineups,
          mode,
        }),
      })
      setResult(await res.json())
    } catch (e) {
      setResult({ status: 'error', message: e.message, lineups: [] })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ fontSize: '13px', color: 'var(--ss-text-muted)' }}>
        Upload a DraftKings NBA CSV to generate optimized lineups. NBA props from the Props tab blend into projections automatically.
      </div>

      {/* Controls */}
      <div style={{ background: 'var(--ss-surface)', border: '1px solid var(--ss-border)', borderRadius: '12px', padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div>
            <label style={{ fontSize: '11px', color: 'var(--ss-text-muted)', display: 'block', marginBottom: '5px' }}>MODE</label>
            <select value={mode} onChange={e => setMode(e.target.value)}
              style={{ background: 'var(--ss-bg)', border: '1px solid var(--ss-border)', color: 'var(--ss-text)', borderRadius: '8px', padding: '7px 12px', fontSize: '13px' }}>
              <option value="cash">Cash</option>
              <option value="gpp">GPP / Tournament</option>
            </select>
          </div>
          <div>
            <label style={{ fontSize: '11px', color: 'var(--ss-text-muted)', display: 'block', marginBottom: '5px' }}>LINEUPS</label>
            <select value={numLineups} onChange={e => setNumLineups(parseInt(e.target.value))}
              style={{ background: 'var(--ss-bg)', border: '1px solid var(--ss-border)', color: 'var(--ss-text)', borderRadius: '8px', padding: '7px 12px', fontSize: '13px' }}>
              {[1, 3, 5, 10, 20].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <div style={{ flex: 1, minWidth: '180px' }}>
            <label style={{ fontSize: '11px', color: 'var(--ss-text-muted)', display: 'block', marginBottom: '5px' }}>LOCK PLAYERS (comma-sep)</label>
            <input value={locks} onChange={e => setLocks(e.target.value)} placeholder="LeBron James, Stephen Curry"
              style={{ width: '100%', background: 'var(--ss-bg)', border: '1px solid var(--ss-border)', color: 'var(--ss-text)', borderRadius: '8px', padding: '7px 10px', fontSize: '13px', boxSizing: 'border-box' }} />
          </div>
          <div style={{ flex: 1, minWidth: '180px' }}>
            <label style={{ fontSize: '11px', color: 'var(--ss-text-muted)', display: 'block', marginBottom: '5px' }}>SCRATCH PLAYERS (comma-sep)</label>
            <input value={scratches} onChange={e => setScratches(e.target.value)} placeholder="Player to exclude"
              style={{ width: '100%', background: 'var(--ss-bg)', border: '1px solid var(--ss-border)', color: 'var(--ss-text)', borderRadius: '8px', padding: '7px 10px', fontSize: '13px', boxSizing: 'border-box' }} />
          </div>
        </div>

        {/* CSV input */}
        <div>
          <label style={{ fontSize: '11px', color: 'var(--ss-text-muted)', display: 'block', marginBottom: '5px' }}>DraftKings NBA CSV</label>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
            <label style={{ padding: '7px 14px', borderRadius: '8px', border: '1px solid var(--ss-teal)', color: 'var(--ss-teal)', background: 'rgba(14,165,233,0.1)', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
              📂 Upload CSV
              <input type="file" accept=".csv" onChange={handleFile} style={{ display: 'none' }} />
            </label>
            <span style={{ fontSize: '12px', color: 'var(--ss-text-muted)', alignSelf: 'center' }}>or paste below</span>
          </div>
          <textarea
            rows={6}
            value={csvText}
            onChange={e => setCsvText(e.target.value)}
            placeholder={EXAMPLE_HINT}
            style={{ width: '100%', background: 'var(--ss-bg)', border: '1px solid var(--ss-border)', color: 'var(--ss-text)', borderRadius: '8px', padding: '10px 12px', fontSize: '12px', fontFamily: 'monospace', resize: 'vertical', boxSizing: 'border-box' }}
          />
        </div>

        <button
          onClick={run}
          disabled={loading || !csvText.trim()}
          className="ss-btn-primary"
          style={{ alignSelf: 'flex-start' }}
        >
          {loading ? '⏳ Optimizing...' : '🚀 Run NBA DFS Optimizer'}
        </button>
      </div>

      {/* Results */}
      {result?.status === 'error' && (
        <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '10px', padding: '14px 18px', color: '#f87171', fontSize: '13px' }}>
          ⚠️ {result.message}
        </div>
      )}

      {result?.status === 'ok' && (
        <div>
          <div style={{ fontWeight: 600, marginBottom: '12px', color: 'var(--ss-text-muted)', fontSize: '13px' }}>
            ✅ {result.lineups?.length} lineup{result.lineups?.length !== 1 ? 's' : ''} generated
          </div>
          {(result.lineups || []).map((l, i) => <LineupCard key={i} lineup={l} idx={i} />)}
        </div>
      )}
    </div>
  )
}
