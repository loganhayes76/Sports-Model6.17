import { useState } from 'react'

function LegRow({ leg, index, onChange, onRemove }) {
  return (
    <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '10px', border: '1px solid var(--ss-border)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '28px', height: '28px', borderRadius: '50%', background: 'var(--ss-teal)', color: '#fff', fontWeight: 700, fontSize: '13px', flexShrink: 0, marginTop: '4px' }}>
        {index + 1}
      </div>
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr auto', gap: '10px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <input
            placeholder="Description (e.g. Dodgers ML, Over 8.5 Goals...)"
            value={leg.description}
            onChange={e => onChange(index, 'description', e.target.value)}
            style={{ background: 'var(--ss-bg)', border: '1px solid var(--ss-border)', color: 'var(--ss-text)', borderRadius: '8px', padding: '8px 12px', fontSize: '14px', width: '100%', boxSizing: 'border-box' }}
          />
          <div style={{ display: 'flex', gap: '10px' }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: '11px', color: 'var(--ss-text-muted)', display: 'block', marginBottom: '4px' }}>AMERICAN ODDS</label>
              <input
                type="number"
                placeholder="-110"
                value={leg.american_odds}
                onChange={e => onChange(index, 'american_odds', parseInt(e.target.value) || 0)}
                style={{ width: '100%', background: 'var(--ss-bg)', border: '1px solid var(--ss-border)', color: 'var(--ss-text)', borderRadius: '8px', padding: '7px 10px', fontSize: '14px', boxSizing: 'border-box' }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: '11px', color: 'var(--ss-text-muted)', display: 'block', marginBottom: '4px' }}>PICK / SIDE</label>
              <input
                placeholder="e.g. OVER"
                value={leg.pick}
                onChange={e => onChange(index, 'pick', e.target.value)}
                style={{ width: '100%', background: 'var(--ss-bg)', border: '1px solid var(--ss-border)', color: 'var(--ss-text)', borderRadius: '8px', padding: '7px 10px', fontSize: '14px', boxSizing: 'border-box' }}
              />
            </div>
          </div>
        </div>
        <button onClick={() => onRemove(index)} style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171', borderRadius: '8px', padding: '6px 10px', fontSize: '14px', cursor: 'pointer', height: '36px', marginTop: '4px' }}>
          ×
        </button>
      </div>
    </div>
  )
}

const PRESET_PARLAYS = [
  {
    name: '2-Leg Moneyline',
    legs: [
      { description: 'Team A ML', american_odds: -150, pick: 'ML' },
      { description: 'Team B ML', american_odds: -120, pick: 'ML' },
    ],
  },
  {
    name: '3-Leg Player Props',
    legs: [
      { description: 'Player A Over 24.5 Pts', american_odds: -115, pick: 'OVER' },
      { description: 'Player B Over 6.5 Ast', american_odds: -120, pick: 'OVER' },
      { description: 'Player C Over 8.5 Reb', american_odds: -110, pick: 'OVER' },
    ],
  },
]

export default function ParlayGrader() {
  const [legs, setLegs] = useState([
    { description: '', american_odds: -110, pick: '' },
    { description: '', american_odds: -110, pick: '' },
  ])
  const [stake, setStake] = useState(100)
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const addLeg = () => {
    if (legs.length < 12) setLegs(l => [...l, { description: '', american_odds: -110, pick: '' }])
  }

  const removeLeg = (i) => {
    if (legs.length > 1) setLegs(l => l.filter((_, idx) => idx !== i))
  }

  const updateLeg = (i, field, value) => {
    setLegs(l => l.map((leg, idx) => idx === i ? { ...leg, [field]: value } : leg))
  }

  const loadPreset = (preset) => {
    setLegs(preset.legs.map(l => ({ ...l })))
    setResult(null)
    setError('')
  }

  const grade = async () => {
    const validLegs = legs.filter(l => l.description && l.american_odds !== 0)
    if (validLegs.length < 2) {
      setError('Please add at least 2 legs with descriptions and odds.')
      return
    }
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/parlay/grade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ legs: validLegs, stake }),
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

  const edgeColor = result ? (parseFloat(result.edge_pct) > 0 ? '#84cc16' : '#f87171') : 'var(--ss-text)'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '760px', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <span style={{ fontSize: '40px' }}>🎲</span>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 800, margin: 0 }}>Parlay Grader</h1>
          <p style={{ fontSize: '13px', color: 'var(--ss-text-muted)', marginTop: '2px', marginBottom: 0 }}>
            Enter your parlay legs · Grade edge vs. house odds · Find true EV
          </p>
        </div>
      </div>

      {/* Presets */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '13px', color: 'var(--ss-text-muted)', display: 'flex', alignItems: 'center' }}>Quick load:</span>
        {PRESET_PARLAYS.map(p => (
          <button key={p.name} onClick={() => loadPreset(p)} style={{
            padding: '5px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 600, cursor: 'pointer',
            border: '1px solid var(--ss-border)', background: 'rgba(14,165,233,0.08)',
            color: 'var(--ss-teal)',
          }}>
            {p.name}
          </button>
        ))}
      </div>

      {/* Legs */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {legs.map((leg, i) => (
          <LegRow key={i} leg={leg} index={i} onChange={updateLeg} onRemove={removeLeg} />
        ))}
      </div>

      <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
        <button onClick={addLeg} disabled={legs.length >= 12} style={{
          padding: '8px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
          border: '1px solid var(--ss-teal)', background: 'rgba(14,165,233,0.1)', color: 'var(--ss-teal)',
        }}>
          ➕ Add Leg ({legs.length}/12)
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--ss-text-muted)' }}>
          Stake: $
          <input type="number" value={stake} onChange={e => setStake(parseFloat(e.target.value) || 100)}
            style={{ width: '80px', background: 'var(--ss-surface)', border: '1px solid var(--ss-border)', color: 'var(--ss-text)', borderRadius: '6px', padding: '6px 8px', fontSize: '13px' }} />
        </div>
        <button onClick={grade} disabled={loading} className="ss-btn-primary" style={{ marginLeft: 'auto' }}>
          {loading ? '⏳ Grading...' : '📊 Grade Parlay'}
        </button>
      </div>

      {error && (
        <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '10px', padding: '14px', color: '#f87171' }}>
          ⚠️ {error}
        </div>
      )}

      {result && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Summary card */}
          <div style={{
            background: `linear-gradient(135deg, ${parseFloat(result.edge_pct) > 0 ? 'rgba(132,204,22,0.08)' : 'rgba(239,68,68,0.08)'}, rgba(14,165,233,0.04))`,
            border: `1px solid ${parseFloat(result.edge_pct) > 0 ? 'rgba(132,204,22,0.3)' : 'rgba(239,68,68,0.3)'}`,
            borderRadius: '14px', padding: '20px 24px',
          }}>
            <div style={{ fontWeight: 800, fontSize: '20px', marginBottom: '16px', color: edgeColor }}>
              {result.verdict} &nbsp; {result.stars}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '12px' }}>
              {[
                { label: 'Parlay Odds', value: result.combined_american, color: 'var(--ss-text)' },
                { label: 'Payout', value: `$${result.parlay_payout}`, color: '#0ea5e9' },
                { label: 'Fair Payout', value: `$${result.fair_payout}`, color: '#84cc16' },
                { label: 'Edge', value: `${result.edge_pct > 0 ? '+' : ''}${result.edge_pct}%`, color: edgeColor },
                { label: 'Hit Prob', value: result.combined_true_prob, color: 'var(--ss-text-muted)' },
                { label: 'Legs', value: result.num_legs, color: 'var(--ss-teal)' },
              ].map(({ label, value, color }) => (
                <div key={label} style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '8px', padding: '10px 14px' }}>
                  <div style={{ fontSize: '11px', color: 'var(--ss-text-muted)', marginBottom: '4px', textTransform: 'uppercase' }}>{label}</div>
                  <div style={{ fontSize: '18px', fontWeight: 700, color }}>{value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Leg breakdown */}
          <div style={{ background: 'var(--ss-surface)', border: '1px solid var(--ss-border)', borderRadius: '12px', overflow: 'hidden' }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--ss-border)', fontWeight: 600 }}>Leg Breakdown</div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--ss-border)' }}>
                  {['#', 'Description', 'Pick', 'Odds', 'Implied Prob', 'True Prob (no-vig)'].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: '11px', fontWeight: 700, color: 'var(--ss-text-muted)', textTransform: 'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.legs.map((leg, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--ss-border)', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}>
                    <td style={{ padding: '10px 14px', color: 'var(--ss-teal)', fontWeight: 700 }}>{i + 1}</td>
                    <td style={{ padding: '10px 14px', fontWeight: 600 }}>{leg.description}</td>
                    <td style={{ padding: '10px 14px', color: 'var(--ss-text-muted)' }}>{leg.pick || '—'}</td>
                    <td style={{ padding: '10px 14px', color: leg.american_odds > 0 ? '#84cc16' : '#f87171', fontWeight: 600 }}>
                      {leg.american_odds > 0 ? `+${leg.american_odds}` : leg.american_odds}
                    </td>
                    <td style={{ padding: '10px 14px', color: 'var(--ss-text-muted)' }}>{leg.implied_prob}</td>
                    <td style={{ padding: '10px 14px', color: '#84cc16', fontWeight: 600 }}>{leg.no_vig_prob}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Math explainer */}
          <div style={{ background: 'rgba(14,165,233,0.06)', border: '1px solid rgba(14,165,233,0.15)', borderRadius: '10px', padding: '14px 18px', fontSize: '12px', color: 'var(--ss-text-muted)', lineHeight: '1.6' }}>
            <strong style={{ color: 'var(--ss-text)' }}>How it works:</strong> The parlay edge is calculated by multiplying the true no-vig probability of each leg,
            then comparing it to the combined parlay decimal odds. An edge &gt; 0% means the parlay pays more than its fair value
            (accounting for ~5% assumed vig removal per leg). This does not account for correlated legs.
          </div>
        </div>
      )}
    </div>
  )
}
