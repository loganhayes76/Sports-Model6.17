import { useState, useEffect } from 'react'
import './MlbPages.css'

const COLOR_MAP = {
  green:  { bg: 'rgba(132,204,22,0.12)',  border: 'rgba(132,204,22,0.3)',  text: '#84cc16' },
  yellow: { bg: 'rgba(234,179,8,0.12)',   border: 'rgba(234,179,8,0.3)',   text: '#eab308' },
  orange: { bg: 'rgba(249,115,22,0.12)',  border: 'rgba(249,115,22,0.3)',  text: '#f97316' },
  red:    { bg: 'rgba(239,68,68,0.12)',   border: 'rgba(239,68,68,0.3)',   text: '#ef4444' },
}

function FatigueArmsBar({ pitchers, label }) {
  const total = pitchers.length
  const tired = pitchers.filter(p => p.pitches >= 30).length
  const pct   = total > 0 ? Math.min(100, Math.round((tired / total) * 100)) : 0
  const color = tired === 0 ? '#84cc16'
              : tired <= 1  ? '#eab308'
              : tired <= 2  ? '#f97316'
              :               '#ef4444'
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--ss-text-muted)' }}>
        <span>{label}</span>
        <span style={{ fontWeight: 700, color }}>
          {tired}/{total} arm{tired !== 1 ? 's' : ''} taxed
        </span>
      </div>
      <div style={{ height: '6px', background: 'rgba(255,255,255,0.08)', borderRadius: '3px', overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: '3px', transition: 'width 0.4s ease' }} />
      </div>
    </div>
  )
}

function StatusBadge({ status, color }) {
  const c = COLOR_MAP[color] || COLOR_MAP.green
  return (
    <span style={{
      display: 'inline-block', padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 700,
      background: c.bg, border: `1px solid ${c.border}`, color: c.text, letterSpacing: '0.3px',
    }}>
      {status}
    </span>
  )
}

function PitcherDetailTable({ pitchers, teamAbbr, timeLabel }) {
  if (!pitchers || pitchers.length === 0) {
    return (
      <div style={{ fontSize: '12px', color: 'var(--ss-text-muted)', fontStyle: 'italic', padding: '8px 0' }}>
        No relief pitcher data in this window.
      </div>
    )
  }
  return (
    <div style={{ marginTop: '10px' }}>
      <div style={{ fontSize: '11px', color: 'var(--ss-text-muted)', marginBottom: '6px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
        {teamAbbr} Relief Pitchers — {timeLabel}
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
        <tbody>
          {pitchers.map((p, i) => {
            const barColor = p.pitches < 15 ? '#84cc16' : p.pitches < 30 ? '#eab308' : p.pitches < 50 ? '#f97316' : '#ef4444'
            const barPct   = Math.min(100, Math.round(p.pitches / 0.6))
            return (
              <tr key={i} style={{ borderBottom: '1px solid var(--ss-border)' }}>
                <td style={{ padding: '6px 8px', fontWeight: 600, color: 'var(--ss-text)', width: '50%' }}>{p.name}</td>
                <td style={{ padding: '6px 8px', width: '50%' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ flex: 1, height: '5px', background: 'rgba(255,255,255,0.08)', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{ width: `${barPct}%`, height: '100%', background: barColor, borderRadius: '3px' }} />
                    </div>
                    <span style={{ minWidth: '28px', textAlign: 'right', fontWeight: 700, color: barColor }}>{p.pitches}</span>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function BullpenCard({ game, showDetail, timeLabel }) {
  const [expanded, setExpanded] = useState(null)

  const hasPitchers = (abbr) =>
    (abbr === game.away_abbr ? game.away_pitchers : game.home_pitchers)?.length > 0

  const renderSide = (abbr, status, color, action, pitchers) => {
    const c  = COLOR_MAP[color] || COLOR_MAP.green
    const isExpanded = expanded === abbr
    return (
      <div style={{ flex: 1, minWidth: '160px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
          <div style={{ fontWeight: 700, fontSize: '14px', color: 'var(--ss-text)' }}>{abbr}</div>
          <StatusBadge status={status} color={color} />
        </div>
        <FatigueArmsBar pitchers={pitchers} label={timeLabel} />
        <div style={{ marginTop: '8px', fontSize: '12px', color: c.text, fontStyle: 'italic' }}>{action}</div>
        {showDetail && hasPitchers(abbr) && (
          <button
            onClick={() => setExpanded(isExpanded ? null : abbr)}
            style={{
              marginTop: '8px', padding: '4px 10px', fontSize: '11px', fontWeight: 600, cursor: 'pointer',
              background: isExpanded ? 'rgba(14,165,233,0.15)' : 'transparent',
              border: '1px solid var(--ss-border)', borderRadius: '6px', color: 'var(--ss-teal)',
            }}
          >
            {isExpanded ? '▲ Hide pitchers' : '▼ Show pitchers'}
          </button>
        )}
        {isExpanded && (
          <PitcherDetailTable pitchers={pitchers} teamAbbr={abbr} timeLabel={timeLabel} />
        )}
      </div>
    )
  }

  return (
    <div style={{
      background: 'var(--ss-surface)', border: '1px solid var(--ss-border)',
      borderRadius: '12px', padding: '16px 20px',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
        <div style={{ fontWeight: 700, fontSize: '15px' }}>{game.away_abbr} @ {game.home_abbr}</div>
        <div style={{ fontSize: '12px', color: 'var(--ss-text-muted)' }}>{game.game_time}</div>
      </div>
      <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
        {renderSide(game.away_abbr, game.away_status, game.away_color, game.away_action, game.away_pitchers)}
        <div style={{ width: '1px', background: 'var(--ss-border)', alignSelf: 'stretch' }} />
        {renderSide(game.home_abbr, game.home_status, game.home_color, game.home_action, game.home_pitchers)}
      </div>
    </div>
  )
}

function TeamDetailView({ teamAbbr, pitcherDetail, rawCounts, games, timeLabel, onBack }) {
  const pitchers = pitcherDetail?.[teamAbbr] || []
  const totalPitches = rawCounts?.[teamAbbr] || 0
  const [status, color, action] = _clientGradeArms(pitchers)
  const c = COLOR_MAP[color] || COLOR_MAP.green

  const game = games.find(g => g.away_abbr === teamAbbr || g.home_abbr === teamAbbr)
  const opp  = game ? (game.away_abbr === teamAbbr ? game.home_abbr : game.away_abbr) : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <button onClick={onBack} style={{ padding: '6px 14px', borderRadius: '8px', border: '1px solid var(--ss-border)', background: 'transparent', color: 'var(--ss-teal)', cursor: 'pointer', fontWeight: 600, fontSize: '13px' }}>
          ← All Matchups
        </button>
        <div>
          <div style={{ fontWeight: 800, fontSize: '20px' }}>{teamAbbr} Bullpen Detail</div>
          <div style={{ fontSize: '12px', color: 'var(--ss-text-muted)' }}>
            {opp ? `vs ${opp} · ${game.game_time} · ` : ''}{timeLabel}
          </div>
        </div>
      </div>

      {pitchers.length === 0 && totalPitches === 0 ? (
        <div style={{ background: 'var(--ss-surface)', border: '1px dashed var(--ss-border)', borderRadius: '12px', padding: '50px', textAlign: 'center' }}>
          <div style={{ fontSize: '36px', marginBottom: '10px' }}>💪</div>
          <div style={{ fontWeight: 700, fontSize: '15px', color: 'var(--ss-text)', marginBottom: '6px' }}>
            No bullpen data for {teamAbbr}
          </div>
          <div style={{ fontSize: '13px', color: 'var(--ss-text-muted)' }}>
            No relief pitchers found in the selected time window.
          </div>
        </div>
      ) : (
        <div style={{ background: 'var(--ss-surface)', border: `1px solid ${c.border}`, borderRadius: '12px', padding: '20px 24px' }}>
          <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', alignItems: 'flex-start' }}>
            <div style={{ flex: 1, minWidth: '200px' }}>
              <StatusBadge status={status} color={color} />
              <div style={{ marginTop: '12px' }}>
                <FatigueArmsBar pitchers={pitchers} label={timeLabel} />
              </div>
              <div style={{ marginTop: '10px', fontSize: '13px', color: c.text, fontStyle: 'italic', lineHeight: 1.5 }}>{action}</div>
            </div>
            <div style={{ flex: 2, minWidth: '260px' }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--ss-text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '10px' }}>
                Individual Pitch Counts ({timeLabel})
              </div>
              {pitchers.length > 0 ? (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--ss-border)' }}>
                      <th style={{ padding: '6px 8px', textAlign: 'left', fontSize: '11px', color: 'var(--ss-text-muted)', textTransform: 'uppercase' }}>Pitcher</th>
                      <th style={{ padding: '6px 8px', textAlign: 'right', fontSize: '11px', color: 'var(--ss-text-muted)', textTransform: 'uppercase' }}>Pitches</th>
                      <th style={{ padding: '6px 8px', textAlign: 'left', fontSize: '11px', color: 'var(--ss-text-muted)', textTransform: 'uppercase' }}>Load</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pitchers.map((p, i) => {
                      const barColor = p.pitches < 15 ? '#84cc16' : p.pitches < 30 ? '#eab308' : p.pitches < 50 ? '#f97316' : '#ef4444'
                      const barPct   = Math.min(100, Math.round(p.pitches / 0.6))
                      return (
                        <tr key={i} style={{ borderBottom: '1px solid var(--ss-border)', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}>
                          <td style={{ padding: '8px 8px', fontWeight: 600 }}>{p.name}</td>
                          <td style={{ padding: '8px 8px', textAlign: 'right', fontWeight: 700, color: barColor }}>{p.pitches}</td>
                          <td style={{ padding: '8px 8px', minWidth: '120px' }}>
                            <div style={{ height: '6px', background: 'rgba(255,255,255,0.08)', borderRadius: '3px', overflow: 'hidden' }}>
                              <div style={{ width: `${barPct}%`, height: '100%', background: barColor, borderRadius: '3px' }} />
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              ) : (
                <div style={{ color: 'var(--ss-text-muted)', fontStyle: 'italic', fontSize: '13px' }}>No individual pitcher data available.</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function _clientGradeArms(pitchers) {
  const tired  = pitchers.filter(p => p.pitches >= 30).length
  const gassed = pitchers.filter(p => p.pitches >= 50).length
  if (gassed >= 3 || tired >= 5) return ['Gassed',       'red',    'Multiple arms unavailable — smash opponent OVERS.']
  if (gassed >= 2 || tired >= 3) return ['Fatigued',     'orange', 'Key setup arms limited — consider fading.']
  if (gassed >= 1 || tired >= 2) return ['Moderate',     'yellow', 'Some usage — monitor late-game leverage.']
  return                                ['Fully Rested', 'green',  'Bullpen well-rested — safe to back ML and Unders.']
}

const ALL_MLB_TEAMS = [
  'ARI','ATL','BAL','BOS','CHC','CHW','CIN','CLE','COL','DET',
  'HOU','KC', 'LAA','LAD','MIA','MIL','MIN','NYM','NYY','OAK',
  'PHI','PIT','SD', 'SEA','SF', 'STL','TB', 'TEX','TOR','WSH',
]

export default function MlbBullpen() {
  const [data,          setData]          = useState([])
  const [pitcherDetail, setPitcherDetail] = useState({})
  const [rawCounts,     setRawCounts]     = useState({})
  const [loading,       setLoading]       = useState(true)
  const [error,         setError]         = useState(null)
  const [hours,         setHours]         = useState(72)
  const [detailTeam,    setDetailTeam]    = useState(null)

  const load = (h) => {
    setLoading(true)
    setError(null)
    fetch(`/api/mlb/bullpen?hours=${h}`)
      .then(r => r.json())
      .then(resp => {
        setData(resp.games || [])
        setPitcherDetail(resp.pitcher_detail || {})
        setRawCounts(resp.raw_pitch_counts || {})
        setLoading(false)
      })
      .catch(e => { setError(e.message); setLoading(false) })
  }

  useEffect(() => { load(hours) }, [hours])

  const timeLabel = hours === 24 ? 'Last 24 hrs' : 'Last 3 days'

  const handleTeamSelect = (abbr) => {
    if (!abbr) { setDetailTeam(null); return }
    setDetailTeam(abbr)
  }

  if (loading) return (
    <div style={{ textAlign: 'center', padding: '60px', color: 'var(--ss-text-muted)' }}>
      ⏳ Scraping {hours === 24 ? '24-hour' : '3-day'} MLB boxscores for bullpen pitch counts...
    </div>
  )

  if (error) return (
    <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '10px', padding: '16px', color: '#f87171' }}>
      Error: {error}
    </div>
  )

  if (detailTeam) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '860px' }}>
        <TeamDetailView
          teamAbbr={detailTeam}
          pitcherDetail={pitcherDetail}
          rawCounts={rawCounts}
          games={data}
          timeLabel={timeLabel}
          onBack={() => setDetailTeam(null)}
        />
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div>
        <div style={{ fontWeight: 700, fontSize: '18px' }}>💪 Bullpen Radar</div>
        <div style={{ fontSize: '13px', color: 'var(--ss-text-muted)', marginTop: '4px' }}>
          Relief pitcher pitch counts — tracks fatigue heading into today
        </div>
      </div>

      {/* Controls */}
      <div style={{
        background: 'var(--ss-surface)', border: '1px solid var(--ss-border)',
        borderRadius: '12px', padding: '14px 18px',
        display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'flex-end',
      }}>
        <div>
          <label style={{ fontSize: '11px', color: 'var(--ss-text-muted)', display: 'block', marginBottom: '5px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Time Range
          </label>
          <div style={{ display: 'flex', gap: '6px' }}>
            {[{ val: 24, label: 'Last 24 hrs' }, { val: 72, label: 'Last 3 days' }].map(opt => (
              <button
                key={opt.val}
                onClick={() => { setHours(opt.val); setDetailTeam(null) }}
                style={{
                  padding: '7px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
                  border: hours === opt.val ? '1px solid var(--ss-teal)' : '1px solid var(--ss-border)',
                  background: hours === opt.val ? 'rgba(14,165,233,0.15)' : 'transparent',
                  color: hours === opt.val ? 'var(--ss-teal)' : 'var(--ss-text-muted)',
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label style={{ fontSize: '11px', color: 'var(--ss-text-muted)', display: 'block', marginBottom: '5px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Team Detail
          </label>
          <select
            value={detailTeam || ''}
            onChange={e => handleTeamSelect(e.target.value)}
            style={{
              background: 'var(--ss-bg)', border: '1px solid var(--ss-border)',
              color: 'var(--ss-text)', borderRadius: '8px', padding: '7px 12px', fontSize: '13px', minWidth: '140px',
            }}
          >
            <option value="">← All Matchups</option>
            {ALL_MLB_TEAMS.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        <div style={{ marginLeft: 'auto', fontSize: '12px', color: 'var(--ss-text-muted)', alignSelf: 'center' }}>
          {data.length} matchup{data.length !== 1 ? 's' : ''} · {timeLabel}
        </div>
      </div>

      {data.length === 0 ? (
        <div style={{ background: 'var(--ss-surface)', border: '1px dashed var(--ss-border)', borderRadius: '12px', padding: '60px', textAlign: 'center' }}>
          <div style={{ fontSize: '40px', marginBottom: '12px' }}>💪</div>
          <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--ss-text)', marginBottom: '6px' }}>No games on today's slate</div>
          <div style={{ fontSize: '13px', color: 'var(--ss-text-muted)' }}>Check back when games are scheduled.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {data.map((g, i) => (
            <div key={i}>
              <BullpenCard game={g} showDetail timeLabel={timeLabel} />
              <div style={{ display: 'flex', gap: '8px', marginTop: '8px', paddingLeft: '4px' }}>
                <button
                  onClick={() => setDetailTeam(g.away_abbr)}
                  style={{ padding: '4px 12px', fontSize: '11px', fontWeight: 600, borderRadius: '6px', border: '1px solid var(--ss-border)', background: 'transparent', color: 'var(--ss-teal)', cursor: 'pointer' }}
                >
                  {g.away_abbr} Detail →
                </button>
                <button
                  onClick={() => setDetailTeam(g.home_abbr)}
                  style={{ padding: '4px 12px', fontSize: '11px', fontWeight: 600, borderRadius: '6px', border: '1px solid var(--ss-border)', background: 'transparent', color: 'var(--ss-teal)', cursor: 'pointer' }}
                >
                  {g.home_abbr} Detail →
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
