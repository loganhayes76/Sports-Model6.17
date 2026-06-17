import { useState, useEffect } from 'react'

const SPORT_ICONS = { MLB: '⚾', NBA: '🏀', NFL: '🏈', NCAA: '🎓', UFC: '🥊', PGA: '⛳' }
const STATUS_COLORS = { Win: '#84cc16', Loss: '#f87171', Pending: '#f59e0b', Push: '#0ea5e9' }

function StatusBadge({ status }) {
  const color = STATUS_COLORS[status] || 'var(--ss-text-muted)'
  return (
    <span style={{
      padding: '3px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 700,
      background: `${color}20`, color, border: `1px solid ${color}40`,
    }}>
      {status}
    </span>
  )
}

function PLBadge({ pl }) {
  const val = parseFloat(pl) || 0
  if (val === 0) return <span style={{ color: 'var(--ss-text-muted)', fontSize: '13px' }}>—</span>
  const color = val > 0 ? '#84cc16' : '#f87171'
  return <span style={{ color, fontWeight: 700, fontSize: '13px' }}>{val > 0 ? `+$${val.toFixed(0)}` : `-$${Math.abs(val).toFixed(0)}`}</span>
}

function AddPlayModal({ onAdd, onClose }) {
  const today = new Date().toISOString().split('T')[0]
  const [form, setForm] = useState({
    date: today, sport: 'MLB', matchup: '', market: '',
    model_pick: '', vegas_line: '', edge: 0, stars: '⭐⭐⭐', model: 'Manual',
  })
  const [loading, setLoading] = useState(false)

  const submit = async () => {
    if (!form.matchup || !form.market || !form.model_pick) return
    setLoading(true)
    try {
      const adminToken = localStorage.getItem('ss_admin_token') || ''
      const res = await fetch('/api/tracker/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-token': adminToken },
        body: JSON.stringify({ ...form, edge: parseFloat(form.edge) || 0 }),
      })
      const json = await res.json()
      if (json.status === 'ok') {
        onAdd()
        onClose()
      } else {
        alert(json.message || 'Failed to add play. Admin login required.')
      }
    } catch (e) { } finally { setLoading(false) }
  }

  const Field = ({ label, name, type = 'text', options }) => (
    <div>
      <label style={{ fontSize: '12px', color: 'var(--ss-text-muted)', display: 'block', marginBottom: '5px' }}>{label}</label>
      {options ? (
        <select value={form[name]} onChange={e => setForm(f => ({ ...f, [name]: e.target.value }))}
          style={{ width: '100%', background: 'var(--ss-bg)', border: '1px solid var(--ss-border)', color: 'var(--ss-text)', borderRadius: '8px', padding: '8px 10px', fontSize: '14px' }}>
          {options.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      ) : (
        <input type={type} value={form[name]} onChange={e => setForm(f => ({ ...f, [name]: e.target.value }))}
          style={{ width: '100%', background: 'var(--ss-bg)', border: '1px solid var(--ss-border)', color: 'var(--ss-text)', borderRadius: '8px', padding: '8px 10px', fontSize: '14px', boxSizing: 'border-box' }} />
      )}
    </div>
  )

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
      <div style={{ background: 'var(--ss-surface)', border: '1px solid var(--ss-border)', borderRadius: '16px', padding: '24px', width: '100%', maxWidth: '480px', display: 'flex', flexDirection: 'column', gap: '14px', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontWeight: 700, fontSize: '18px' }}>➕ Add Play</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--ss-text-muted)', cursor: 'pointer', fontSize: '20px' }}>×</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <Field label="DATE" name="date" type="date" />
          <Field label="SPORT" name="sport" options={['MLB', 'NBA', 'NFL', 'NCAA', 'UFC', 'PGA']} />
          <div style={{ gridColumn: 'span 2' }}><Field label="MATCHUP" name="matchup" /></div>
          <Field label="MARKET" name="market" />
          <Field label="MODEL PICK" name="model_pick" />
          <Field label="VEGAS LINE" name="vegas_line" />
          <Field label="EDGE (%)" name="edge" type="number" />
          <Field label="STARS" name="stars" options={['⭐', '⭐⭐', '⭐⭐⭐', '⭐⭐⭐⭐', '⭐⭐⭐⭐⭐']} />
          <Field label="MODEL" name="model" options={['Manual', 'Consensus', 'MLB Cleanup', 'NCAA ELO', 'NBA Monte Carlo', 'Torvik Hoops', 'DFS LP']} />
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={onClose} style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid var(--ss-border)', background: 'transparent', color: 'var(--ss-text-muted)', cursor: 'pointer' }}>Cancel</button>
          <button onClick={submit} disabled={loading} className="ss-btn-primary" style={{ flex: 2 }}>
            {loading ? '⏳ Saving...' : '✅ Add Play'}
          </button>
        </div>
      </div>
    </div>
  )
}

function GradeModal({ play, onGrade, onClose }) {
  const [status, setStatus] = useState('Win')
  const [pl, setPl] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async () => {
    setLoading(true)
    try {
      const adminToken = localStorage.getItem('ss_admin_token') || ''
      const res = await fetch('/api/tracker/grade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-token': adminToken },
        body: JSON.stringify({
          date: play['Date'],
          matchup: play['Matchup'],
          market: play['Market'],
          status,
          profit_loss: pl ? parseFloat(pl) : null,
        }),
      })
      const json = await res.json()
      if (json.status === 'ok') { onGrade(); onClose() }
      else alert(json.message || 'Grade failed. Admin login required.')
    } catch (e) { } finally { setLoading(false) }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: 'var(--ss-surface)', border: '1px solid var(--ss-border)', borderRadius: '16px', padding: '24px', width: '100%', maxWidth: '380px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ fontWeight: 700, fontSize: '18px' }}>📋 Grade Play</div>
        <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '8px', padding: '12px' }}>
          <div style={{ fontWeight: 600 }}>{play['Matchup']}</div>
          <div style={{ fontSize: '13px', color: 'var(--ss-text-muted)', marginTop: '4px' }}>{play['Market']} · {play['Model Pick']}</div>
        </div>
        <div>
          <label style={{ fontSize: '12px', color: 'var(--ss-text-muted)', display: 'block', marginBottom: '6px' }}>RESULT</label>
          <div style={{ display: 'flex', gap: '8px' }}>
            {['Win', 'Loss', 'Push', 'Pending'].map(s => (
              <button key={s} onClick={() => setStatus(s)} style={{
                flex: 1, padding: '8px 0', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
                border: status === s ? `1px solid ${STATUS_COLORS[s]}` : '1px solid var(--ss-border)',
                background: status === s ? `${STATUS_COLORS[s]}20` : 'transparent',
                color: status === s ? STATUS_COLORS[s] : 'var(--ss-text-muted)',
              }}>
                {s}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label style={{ fontSize: '12px', color: 'var(--ss-text-muted)', display: 'block', marginBottom: '6px' }}>PROFIT/LOSS (optional)</label>
          <input type="number" value={pl} onChange={e => setPl(e.target.value)} placeholder="Leave blank for ±$100 default"
            style={{ width: '100%', background: 'var(--ss-bg)', border: '1px solid var(--ss-border)', color: 'var(--ss-text)', borderRadius: '8px', padding: '8px 10px', fontSize: '14px', boxSizing: 'border-box' }} />
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={onClose} style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid var(--ss-border)', background: 'transparent', color: 'var(--ss-text-muted)', cursor: 'pointer' }}>Cancel</button>
          <button onClick={submit} disabled={loading} className="ss-btn-primary" style={{ flex: 2 }}>{loading ? '⏳...' : '✅ Save Grade'}</button>
        </div>
      </div>
    </div>
  )
}

export default function Tracker() {
  const [plays, setPlays] = useState([])
  const [loading, setLoading] = useState(false)
  const [sportFilter, setSportFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [gradePlay, setGradePlay] = useState(null)

  const load = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (sportFilter) params.set('sport', sportFilter)
      if (statusFilter) params.set('status', statusFilter)
      const res = await fetch(`/api/tracker?${params}`)
      const json = await res.json()
      setPlays(json.plays || [])
    } catch (e) { } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [sportFilter, statusFilter])

  const wins = plays.filter(p => p['Status'] === 'Win').length
  const losses = plays.filter(p => p['Status'] === 'Loss').length
  const pending = plays.filter(p => p['Status'] === 'Pending').length
  const totalPL = plays.reduce((sum, p) => sum + (parseFloat(p['Profit/Loss']) || 0), 0)
  const winRate = (wins + losses) > 0 ? ((wins / (wins + losses)) * 100).toFixed(1) : 'N/A'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '960px', margin: '0 auto' }}>
      {showAdd && <AddPlayModal onAdd={load} onClose={() => setShowAdd(false)} />}
      {gradePlay && <GradeModal play={gradePlay} onGrade={load} onClose={() => setGradePlay(null)} />}

      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <span style={{ fontSize: '40px' }}>📈</span>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: 800, margin: 0 }}>Bankroll Tracker</h1>
            <p style={{ fontSize: '13px', color: 'var(--ss-text-muted)', marginTop: '2px', marginBottom: 0 }}>
              Log picks · Grade results · Track ROI
            </p>
          </div>
        </div>
        <button onClick={() => setShowAdd(true)} className="ss-btn-primary">➕ Add Play</button>
      </div>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '12px' }}>
        {[
          { label: 'Total', value: plays.length, color: 'var(--ss-teal)' },
          { label: 'Wins', value: wins, color: '#84cc16' },
          { label: 'Losses', value: losses, color: '#f87171' },
          { label: 'Pending', value: pending, color: '#f59e0b' },
          { label: 'Win Rate', value: winRate === 'N/A' ? 'N/A' : `${winRate}%`, color: parseFloat(winRate) >= 55 ? '#84cc16' : '#f87171' },
          { label: 'P/L', value: `${totalPL > 0 ? '+' : ''}$${totalPL.toFixed(0)}`, color: totalPL >= 0 ? '#84cc16' : '#f87171' },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ background: 'var(--ss-surface)', border: '1px solid var(--ss-border)', borderRadius: '10px', padding: '12px', textAlign: 'center' }}>
            <div style={{ fontSize: '20px', fontWeight: 800, color }}>{value}</div>
            <div style={{ fontSize: '11px', color: 'var(--ss-text-muted)', marginTop: '2px' }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        <select value={sportFilter} onChange={e => setSportFilter(e.target.value)}
          style={{ background: 'var(--ss-surface)', border: '1px solid var(--ss-border)', color: 'var(--ss-text)', borderRadius: '8px', padding: '7px 12px', fontSize: '13px' }}>
          <option value="">All Sports</option>
          {['MLB', 'NBA', 'NFL', 'NCAA', 'UFC', 'PGA'].map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          style={{ background: 'var(--ss-surface)', border: '1px solid var(--ss-border)', color: 'var(--ss-text)', borderRadius: '8px', padding: '7px 12px', fontSize: '13px' }}>
          <option value="">All Statuses</option>
          {['Pending', 'Win', 'Loss', 'Push'].map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <button onClick={load} style={{ padding: '7px 14px', borderRadius: '8px', border: '1px solid var(--ss-border)', background: 'transparent', color: 'var(--ss-text-muted)', cursor: 'pointer', fontSize: '13px' }}>
          🔄 Refresh
        </button>
      </div>

      {/* Plays table */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--ss-text-muted)' }}>Loading plays...</div>
      ) : plays.length === 0 ? (
        <div style={{ background: 'var(--ss-surface)', border: '1px dashed var(--ss-border)', borderRadius: '14px', padding: '60px', textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '12px' }}>📋</div>
          <div style={{ fontWeight: 700, fontSize: '16px', marginBottom: '8px' }}>No plays yet</div>
          <div style={{ fontSize: '13px', color: 'var(--ss-text-muted)', marginBottom: '16px' }}>Add your first play to start tracking your bankroll.</div>
          <button onClick={() => setShowAdd(true)} className="ss-btn-primary">➕ Add First Play</button>
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--ss-border)' }}>
                {['Date', 'Sport', 'Matchup', 'Market', 'Pick', 'Vegas', 'Edge', 'Stars', 'Status', 'P/L', ''].map(h => (
                  <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontSize: '11px', fontWeight: 700, color: 'var(--ss-text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {plays.map((p, i) => (
                <tr key={i} style={{ borderBottom: '1px solid var(--ss-border)', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}>
                  <td style={{ padding: '10px 12px', color: 'var(--ss-text-muted)', whiteSpace: 'nowrap' }}>{p['Date']}</td>
                  <td style={{ padding: '10px 12px' }}>{SPORT_ICONS[p['Sport']] || ''} {p['Sport']}</td>
                  <td style={{ padding: '10px 12px', fontWeight: 600, maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p['Matchup']}</td>
                  <td style={{ padding: '10px 12px', color: 'var(--ss-text-muted)' }}>{p['Market']}</td>
                  <td style={{ padding: '10px 12px', fontWeight: 600, color: 'var(--ss-teal)', whiteSpace: 'nowrap' }}>{p['Model Pick']}</td>
                  <td style={{ padding: '10px 12px', color: 'var(--ss-text-muted)' }}>{p['Vegas Line'] || '—'}</td>
                  <td style={{ padding: '10px 12px', color: '#0ea5e9', fontWeight: 600 }}>{p['Edge'] ? `${p['Edge']}%` : '—'}</td>
                  <td style={{ padding: '10px 12px' }}>{p['Stars']}</td>
                  <td style={{ padding: '10px 12px' }}><StatusBadge status={p['Status']} /></td>
                  <td style={{ padding: '10px 12px' }}><PLBadge pl={p['Profit/Loss']} /></td>
                  <td style={{ padding: '10px 12px' }}>
                    <button onClick={() => setGradePlay(p)} style={{ background: 'rgba(14,165,233,0.1)', border: '1px solid rgba(14,165,233,0.3)', color: 'var(--ss-teal)', borderRadius: '6px', padding: '4px 10px', fontSize: '12px', cursor: 'pointer' }}>
                      Grade
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
