import { useState, useMemo } from 'react'
import { Routes, Route, NavLink } from 'react-router-dom'

// ── Shared helpers ────────────────────────────────────────────────────────────

function StarRating({ stars }) {
  const count = (stars || '').split('⭐').length - 1
  const color = count >= 4 ? '#f59e0b' : count >= 3 ? '#84cc16' : 'var(--ss-text-muted)'
  return (
    <span style={{ color, fontWeight: 700, fontSize: '13px' }}>
      {'⭐'.repeat(count) || '—'}
    </span>
  )
}

function EdgeBadge({ edge, unit = '' }) {
  const e = parseFloat(edge) || 0
  const color = Math.abs(e) >= 2 ? '#84cc16' : Math.abs(e) >= 1 ? '#0ea5e9' : 'var(--ss-text-muted)'
  const sign = e > 0 ? '+' : ''
  return <span style={{ color, fontWeight: 700, fontSize: '13px' }}>{sign}{e.toFixed(1)}{unit}</span>
}

function LeanBadge({ label, positive }) {
  if (!label) return null
  return (
    <span style={{
      padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 700,
      letterSpacing: '0.5px', textTransform: 'uppercase',
      background: positive ? 'rgba(132,204,22,0.15)' : 'rgba(14,165,233,0.15)',
      color: positive ? '#84cc16' : '#0ea5e9',
      border: `1px solid ${positive ? 'rgba(132,204,22,0.3)' : 'rgba(14,165,233,0.3)'}`,
    }}>
      {label}
    </span>
  )
}

function RankBadge({ rank }) {
  if (!rank || rank > 25) return null
  const isTop10 = rank <= 10
  return (
    <span style={{
      display: 'inline-block', padding: '1px 6px', borderRadius: '4px', fontSize: '11px',
      fontWeight: 800, marginRight: '5px',
      background: isTop10 ? 'rgba(245,158,11,0.2)' : 'rgba(14,165,233,0.15)',
      color: isTop10 ? '#f59e0b' : '#0ea5e9',
      border: `1px solid ${isTop10 ? 'rgba(245,158,11,0.4)' : 'rgba(14,165,233,0.3)'}`,
    }}>
      #{rank}
    </span>
  )
}

function ordinal(n) {
  if (n == null) return null
  const num = parseInt(n, 10)
  if (isNaN(num)) return String(n)
  const s = ['th','st','nd','rd'], v = num % 100
  return num + (s[(v-20)%10] || s[v] || s[0])
}

function LiveBadge({ game }) {
  if (game.status !== 'in_progress') return null
  const inning = game.inning != null ? ` · ${ordinal(game.inning)} inning` : ''
  const score  = (game.away_score != null && game.home_score != null)
    ? ` · ${game.away_score}–${game.home_score}`
    : ''
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '4px',
      padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 700,
      background: 'rgba(239,68,68,0.15)', color: '#f87171',
      border: '1px solid rgba(239,68,68,0.3)',
    }}>
      <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#f87171', display: 'inline-block' }} />
      LIVE{inning}{score}
    </span>
  )
}

// ── Client-side run projection formula (mirrors ncaa_api._calc_proj_runs) ────

function calcProjRuns(base, parkFactor, temp, windSpeed, windDir) {
  let proj = base * parkFactor
  const tempAdj = 1 + ((temp - 70) * 0.0033)
  proj *= tempAdj
  if (windDir === 'out') proj *= (1 + (windSpeed * 0.01))
  else if (windDir === 'in') proj *= (1 - (windSpeed * 0.01))
  return Math.round(proj * 100) / 100
}

// ── NCAA Baseball ─────────────────────────────────────────────────────────────

function SubTabBtn({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '7px 16px', borderRadius: '7px', fontSize: '13px', fontWeight: 600,
        border: active ? '1px solid var(--ss-teal)' : '1px solid var(--ss-border)',
        background: active ? 'rgba(14,165,233,0.15)' : 'transparent',
        color: active ? 'var(--ss-teal)' : 'var(--ss-text-muted)',
        cursor: 'pointer', whiteSpace: 'nowrap',
      }}
    >
      {children}
    </button>
  )
}

// ── Game card (shared between Game Previews and Top 25) ──────────────────────

function GameCard({ g }) {
  const totalLean  = g.total_edge > 0.5 ? 'OVER' : g.total_edge < -0.5 ? 'UNDER' : null
  const spreadLean = g.spread_edge > 0.5 ? 'HOME' : g.spread_edge < -0.5 ? 'AWAY' : null
  const isRankedMatchup = g.rank_home && g.rank_away && g.rank_home <= 25 && g.rank_away <= 25

  return (
    <div style={{
      background: 'var(--ss-surface)',
      border: isRankedMatchup
        ? '1px solid rgba(245,158,11,0.45)'
        : '1px solid var(--ss-border)',
      borderRadius: '14px', overflow: 'hidden',
      boxShadow: isRankedMatchup ? '0 0 12px rgba(245,158,11,0.08)' : 'none',
    }}>
      {isRankedMatchup && (
        <div style={{
          background: 'rgba(245,158,11,0.12)', borderBottom: '1px solid rgba(245,158,11,0.25)',
          padding: '5px 16px', fontSize: '11px', fontWeight: 700,
          color: '#f59e0b', letterSpacing: '0.5px',
        }}>
          RANKED MATCHUP
        </div>
      )}
      {/* Header */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '14px 20px', borderBottom: '1px solid var(--ss-border)',
        background: 'rgba(255,255,255,0.02)',
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: '15px', color: 'var(--ss-text)' }}>
            <RankBadge rank={g.rank_away} />{g.away}
            <span style={{ color: 'var(--ss-text-muted)', fontWeight: 400 }}> @ </span>
            <RankBadge rank={g.rank_home} />{g.home}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px', flexWrap: 'wrap' }}>
            {g.status === 'in_progress'
              ? <LiveBadge game={g} />
              : <span style={{ fontSize: '12px', color: 'var(--ss-text-muted)' }}>{g.commence_time}</span>
            }
            {g.venue && (
              <span style={{ fontSize: '11px', color: 'var(--ss-text-muted)' }}>
                · {g.venue}
              </span>
            )}
          </div>
        </div>
        <StarRating stars={g.total_stars} />
      </div>

      {/* Team run projections */}
      {g.has_stats !== false ? (
        <div style={{ display: 'flex', padding: '16px 20px', gap: '12px' }}>
          {[
            { label: 'AWAY', team: g.away, proj: g.a_proj, rank: g.rank_away },
            { label: 'HOME', team: g.home, proj: g.h_proj, rank: g.rank_home },
          ].map(({ label, team, proj, rank }) => (
            <div key={label} style={{
              flex: 1, background: 'rgba(255,255,255,0.03)', borderRadius: '10px',
              padding: '14px', textAlign: 'center',
            }}>
              <div style={{ fontSize: '10px', color: 'var(--ss-text-muted)', fontWeight: 700, letterSpacing: '0.8px', marginBottom: '6px' }}>{label}</div>
              <div style={{ fontWeight: 700, fontSize: '13px', color: 'var(--ss-text)', marginBottom: '4px' }}>
                {rank && rank <= 25 && <RankBadge rank={rank} />}
                {team}
              </div>
              <div style={{ fontSize: '28px', fontWeight: 800, color: proj != null ? 'var(--ss-teal)' : 'var(--ss-text-muted)', lineHeight: 1 }}>
                {proj != null ? proj : '—'}
              </div>
              <div style={{ fontSize: '10px', color: 'var(--ss-text-muted)', marginTop: '4px' }}>proj. runs</div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ padding: '14px 20px', fontSize: '12px', color: 'var(--ss-text-muted)', textAlign: 'center' }}>
          Projection N/A — team not in stats database
        </div>
      )}

      {/* Edges row */}
      <div style={{ display: 'flex', borderTop: '1px solid var(--ss-border)' }}>
        <div style={{ flex: 1, padding: '12px 16px', borderRight: '1px solid var(--ss-border)' }}>
          <div style={{ fontSize: '10px', color: 'var(--ss-text-muted)', fontWeight: 700, letterSpacing: '0.6px', marginBottom: '6px' }}>TOTAL</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
            <span style={{ fontSize: '12px', color: 'var(--ss-text)' }}>
              Model <b>{g.model_total ?? 'N/A'}</b>
            </span>
            <span style={{ fontSize: '12px', color: 'var(--ss-text-muted)' }}>Vegas {g.vegas_total ?? 'N/A'}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <EdgeBadge edge={g.total_edge} />
            {totalLean && <LeanBadge label={totalLean} positive={totalLean === 'OVER'} />}
          </div>
        </div>
        <div style={{ flex: 1, padding: '12px 16px' }}>
          <div style={{ fontSize: '10px', color: 'var(--ss-text-muted)', fontWeight: 700, letterSpacing: '0.6px', marginBottom: '6px' }}>SPREAD (HOME)</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
            <span style={{ fontSize: '12px', color: 'var(--ss-text)' }}>
              Model <b>{g.model_spread != null ? (g.model_spread > 0 ? '+' : '') + g.model_spread : 'N/A'}</b>
            </span>
            <span style={{ fontSize: '12px', color: 'var(--ss-text-muted)' }}>Vegas {g.vegas_spread != null ? g.vegas_spread : 'N/A'}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <EdgeBadge edge={g.spread_edge} />
            {spreadLean && <LeanBadge label={spreadLean} positive={spreadLean === 'HOME'} />}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Game Previews ─────────────────────────────────────────────────────────────

function GamePreviews({ games }) {
  if (!games.length) return (
    <div style={{ textAlign: 'center', padding: '40px', color: 'var(--ss-text-muted)' }}>
      No NCAA Baseball games on the board.
    </div>
  )

  const inProgress = games.filter(g => g.status === 'in_progress')
  const scheduled  = games.filter(g => g.status === 'scheduled')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {inProgress.length > 0 && (
        <div>
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#f87171', letterSpacing: '0.8px', marginBottom: '8px' }}>
            LIVE IN PROGRESS ({inProgress.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {inProgress.map((g, i) => <GameCard key={i} g={g} />)}
          </div>
        </div>
      )}
      {scheduled.length > 0 && (
        <div>
          {inProgress.length > 0 && (
            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--ss-text-muted)', letterSpacing: '0.8px', marginBottom: '8px', marginTop: '8px' }}>
              UPCOMING ({scheduled.length})
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {scheduled.map((g, i) => <GameCard key={i} g={g} />)}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Top 25 Tab ────────────────────────────────────────────────────────────────

function Top25({ games }) {
  const ranked = games.filter(g => (g.rank_home && g.rank_home <= 25) || (g.rank_away && g.rank_away <= 25))

  if (!ranked.length) return (
    <div style={{ textAlign: 'center', padding: '40px', color: 'var(--ss-text-muted)' }}>
      No Top 25 teams scheduled for today.
    </div>
  )

  const sorted = [...ranked].sort((a, b) => {
    const aRank = Math.min(a.rank_home || 99, a.rank_away || 99)
    const bRank = Math.min(b.rank_home || 99, b.rank_away || 99)
    return aRank - bRank
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <div style={{
        background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)',
        borderRadius: '10px', padding: '12px 16px', fontSize: '13px', color: 'var(--ss-text-muted)',
      }}>
        <b style={{ color: '#f59e0b' }}>D1Baseball Top 25</b> — {ranked.length} game{ranked.length !== 1 ? 's' : ''} today featuring ranked teams. Sorted by highest rank involved.
      </div>
      {sorted.map((g, i) => <GameCard key={i} g={g} />)}
    </div>
  )
}

// ── Conference Tab ────────────────────────────────────────────────────────────

const CONF_ORDER = [
  'SEC', 'ACC', 'Big 12', 'Big Ten', 'AAC', 'Sun Belt',
  'Mountain West', 'CUSA', 'Big West', 'Atlantic 10', 'Southern',
  'CAA', 'Missouri Valley', 'OVC', 'WCC', 'America East', 'Southland',
  'Patriot', 'ASUN', 'Big South', 'MAC', 'Ivy', 'MAAC', 'Big East',
  'SWAC', 'WAC', 'Summit', 'Horizon', 'Northeast', 'Mid-Major',
]

// Conferences that always get their own section regardless of game count
const ALWAYS_OWN_SECTION = new Set([
  'SEC', 'ACC', 'Big 12', 'Big Ten', 'AAC', 'Sun Belt', 'Mountain West',
])

function ConferenceSection({ conf, games }) {
  const [open, setOpen] = useState(true)

  return (
    <div style={{ background: 'var(--ss-surface)', border: '1px solid var(--ss-border)', borderRadius: '12px', overflow: 'hidden' }}>
      {/* Header */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '12px 18px', background: 'rgba(255,255,255,0.02)',
          border: 'none', borderBottom: open ? '1px solid var(--ss-border)' : 'none',
          cursor: 'pointer', color: 'var(--ss-text)',
        }}
      >
        <span style={{ fontWeight: 700, fontSize: '14px' }}>{conf}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '12px', color: 'var(--ss-text-muted)' }}>
            {games.length} game{games.length !== 1 ? 's' : ''}
          </span>
          <span style={{ color: 'var(--ss-teal)', fontSize: '13px' }}>{open ? '▲' : '▼'}</span>
        </div>
      </button>

      {open && (
        <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {games.map((g, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '10px 14px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px',
              gap: '8px', flexWrap: 'wrap',
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--ss-text)' }}>
                  <RankBadge rank={g.rank_away} />
                  <span style={{ color: 'var(--ss-text-muted)', fontWeight: 400 }}>{g.away}</span>
                  <span style={{ color: 'var(--ss-text-muted)', fontWeight: 400 }}> @ </span>
                  <RankBadge rank={g.rank_home} />
                  <span>{g.home}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '3px' }}>
                  {g.status === 'in_progress'
                    ? <LiveBadge game={g} />
                    : <span style={{ fontSize: '11px', color: 'var(--ss-text-muted)' }}>{g.commence_time}</span>
                  }
                  {g.venue && <span style={{ fontSize: '11px', color: 'var(--ss-text-muted)' }}>· {g.venue}</span>}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                {g.model_total != null && (
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '10px', color: 'var(--ss-text-muted)', marginBottom: '2px' }}>PROJ</div>
                    <div style={{ fontWeight: 700, color: 'var(--ss-teal)', fontSize: '14px' }}>{g.model_total}</div>
                  </div>
                )}
                {g.vegas_total != null && (
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '10px', color: 'var(--ss-text-muted)', marginBottom: '2px' }}>O/U</div>
                    <div style={{ fontWeight: 600, fontSize: '14px' }}>{g.vegas_total}</div>
                  </div>
                )}
                {g.total_edge !== 0 && (
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '10px', color: 'var(--ss-text-muted)', marginBottom: '2px' }}>EDGE</div>
                    <EdgeBadge edge={g.total_edge} />
                  </div>
                )}
                <StarRating stars={g.total_stars} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function ConferencesTab({ games }) {
  const byConf = useMemo(() => {
    // Step 1: group all games by conference
    const raw = {}
    for (const g of games) {
      const conf = g.conference || 'Mid-Major'
      if (!raw[conf]) raw[conf] = []
      raw[conf].push(g)
    }

    // Step 2: merge small non-power conferences into Mid-Major
    // (unless they already have >=3 games or are always-own-section)
    const result = {}
    for (const [conf, gms] of Object.entries(raw)) {
      if (ALWAYS_OWN_SECTION.has(conf) || gms.length >= 3 || conf === 'Mid-Major') {
        result[conf] = gms
      } else {
        if (!result['Mid-Major']) result['Mid-Major'] = []
        result['Mid-Major'].push(...gms)
      }
    }
    return result
  }, [games])

  if (!games.length) return (
    <div style={{ textAlign: 'center', padding: '40px', color: 'var(--ss-text-muted)' }}>
      No games found.
    </div>
  )

  const orderedConfs = [
    ...CONF_ORDER.filter(c => byConf[c]),
    ...Object.keys(byConf).filter(c => !CONF_ORDER.includes(c)).sort(),
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {orderedConfs.map(conf => (
        <ConferenceSection key={conf} conf={conf} games={byConf[conf]} />
      ))}
    </div>
  )
}

// ── Best Bets ─────────────────────────────────────────────────────────────────

const BB_COLS = [
  { key: 'matchup',      label: 'Matchup',      num: false },
  { key: 'commence_time',label: 'Time',         num: false },
  { key: 'model_total',  label: 'Model Total',  num: true  },
  { key: 'vegas_total',  label: 'Vegas Total',  num: true  },
  { key: 'total_edge',   label: 'Total Edge',   num: true  },
  { key: 'model_spread', label: 'Model Spread', num: true  },
  { key: 'vegas_spread', label: 'Vegas Spread', num: true  },
  { key: 'spread_edge',  label: 'Spread Edge',  num: true  },
  { key: 'vegas_h_ml',   label: 'H ML',         num: true  },
  { key: 'vegas_a_ml',   label: 'A ML',         num: true  },
  { key: 'total_stars',  label: 'Stars',        num: false },
]

function BestBets({ games }) {
  const [sortCol, setSortCol] = useState('total_edge')
  const [sortDir, setSortDir] = useState('desc')

  const sorted = useMemo(() => {
    const col = BB_COLS.find(c => c.key === sortCol)
    return [...games].sort((a, b) => {
      let av = a[sortCol], bv = b[sortCol]
      if (col?.num) {
        av = parseFloat(av) || 0
        bv = parseFloat(bv) || 0
      } else {
        av = String(av ?? '').toLowerCase()
        bv = String(bv ?? '').toLowerCase()
      }
      if (av < bv) return sortDir === 'asc' ? -1 : 1
      if (av > bv) return sortDir === 'asc' ? 1 : -1
      return 0
    })
  }, [games, sortCol, sortDir])

  const handleSort = (key) => {
    if (sortCol === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(key); setSortDir('desc') }
  }

  if (!games.length) return (
    <div style={{ textAlign: 'center', padding: '40px', color: 'var(--ss-text-muted)' }}>
      No NCAA Baseball games on the board.
    </div>
  )

  const arrow = (key) => sortCol === key ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
        <thead>
          <tr style={{ borderBottom: '2px solid var(--ss-border)' }}>
            {BB_COLS.map(c => (
              <th
                key={c.key}
                onClick={() => handleSort(c.key)}
                style={{
                  padding: '10px 12px', textAlign: c.num ? 'center' : 'left',
                  fontSize: '11px', fontWeight: 700, color: sortCol === c.key ? 'var(--ss-teal)' : 'var(--ss-text-muted)',
                  textTransform: 'uppercase', letterSpacing: '0.5px', whiteSpace: 'nowrap',
                  cursor: 'pointer', userSelect: 'none',
                }}
              >
                {c.label}{arrow(c.key)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((g, i) => (
            <tr key={i} style={{ borderBottom: '1px solid var(--ss-border)', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}>
              <td style={{ padding: '10px 12px', fontWeight: 600, color: 'var(--ss-text)', whiteSpace: 'nowrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  {g.status === 'in_progress' && <span style={{ color: '#f87171', fontSize: '10px', fontWeight: 700 }}>LIVE</span>}
                  <RankBadge rank={g.rank_away} />{g.away} @ <RankBadge rank={g.rank_home} />{g.home}
                </div>
              </td>
              <td style={{ padding: '10px 12px', fontSize: '12px', color: 'var(--ss-text-muted)', whiteSpace: 'nowrap' }}>
                {g.status === 'in_progress' ? <LiveBadge game={g} /> : g.commence_time}
              </td>
              <td style={{ padding: '10px 12px', textAlign: 'center', color: 'var(--ss-teal)', fontWeight: 600 }}>{g.model_total ?? '—'}</td>
              <td style={{ padding: '10px 12px', textAlign: 'center', color: 'var(--ss-text)' }}>{g.vegas_total ?? 'N/A'}</td>
              <td style={{ padding: '10px 12px', textAlign: 'center' }}><EdgeBadge edge={g.total_edge} /></td>
              <td style={{ padding: '10px 12px', textAlign: 'center', color: 'var(--ss-text)' }}>
                {g.model_spread != null ? (g.model_spread > 0 ? '+' : '') + g.model_spread : '—'}
              </td>
              <td style={{ padding: '10px 12px', textAlign: 'center', color: 'var(--ss-text)' }}>{g.vegas_spread ?? 'N/A'}</td>
              <td style={{ padding: '10px 12px', textAlign: 'center' }}><EdgeBadge edge={g.spread_edge} /></td>
              <td style={{ padding: '10px 12px', textAlign: 'center', color: 'var(--ss-text)', fontWeight: 600 }}>{g.vegas_h_ml ?? 'N/A'}</td>
              <td style={{ padding: '10px 12px', textAlign: 'center', color: 'var(--ss-text)', fontWeight: 600 }}>{g.vegas_a_ml ?? 'N/A'}</td>
              <td style={{ padding: '10px 12px', textAlign: 'center' }}><StarRating stars={g.total_stars} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Forecast Tool ─────────────────────────────────────────────────────────────

function ForecastTool({ games }) {
  const [gameIdx, setGameIdx] = useState(0)
  const [temp, setTemp] = useState(72)
  const [windSpeed, setWindSpeed] = useState(5)
  const [windDir, setWindDir] = useState('neutral')
  const [parkOverride, setParkOverride] = useState(null)

  // Show ALL games in selector; no-stats games are shown disabled
  const g = games[gameIdx] || null
  const gHasStats = g ? g.has_stats !== false : false

  const hPark = parkOverride !== null ? parkOverride : (g?.h_park ?? 1.0)
  const aPark = parkOverride !== null ? parkOverride : (g?.a_park ?? 1.0)

  const hProj = (g && gHasStats) ? calcProjRuns(g.h_base, hPark, temp, windSpeed, windDir) : null
  const aProj = (g && gHasStats) ? calcProjRuns(g.a_base, aPark, temp, windSpeed, windDir) : null
  const modelTotal = (hProj !== null && aProj !== null) ? Math.round((hProj + aProj) * 100) / 100 : null
  const totalEdge = (modelTotal !== null && g?.vegas_total) ? Math.round((modelTotal - g.vegas_total) * 100) / 100 : null

  const inputStyle = {
    background: 'var(--ss-bg)', border: '1px solid var(--ss-border)', borderRadius: '6px',
    color: 'var(--ss-text)', padding: '7px 10px', fontSize: '13px', width: '100%', boxSizing: 'border-box',
  }
  const labelStyle = { fontSize: '11px', fontWeight: 700, color: 'var(--ss-text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }

  if (!games.length) return (
    <div style={{ textAlign: 'center', padding: '40px', color: 'var(--ss-text-muted)' }}>
      Scan NCAA Baseball first to load games into the Forecast tool.
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{
        background: 'rgba(14,165,233,0.06)', border: '1px solid rgba(14,165,233,0.2)',
        borderRadius: '10px', padding: '12px 16px', fontSize: '13px', color: 'var(--ss-text-muted)',
      }}>
        <b style={{ color: 'var(--ss-teal)' }}>VLS Forecast Engine</b> — Proprietary run projection calculator.
        Adjust weather and park conditions to model how environmental factors shift the total.
        Games marked "(No Projection)" lack historical stats data.
      </div>

      {/* Game selector — all ESPN games; no-stats entries labeled "(No Projection)" */}
      <div>
        <div style={labelStyle}>Select Game</div>
        <select
          value={gameIdx}
          onChange={e => { setGameIdx(Number(e.target.value)); setParkOverride(null) }}
          style={inputStyle}
        >
          {games.map((g, i) => {
            const noStats = g.has_stats === false
            const label = `${g.rank_away ? `#${g.rank_away} ` : ''}${g.away} @ ${g.rank_home ? `#${g.rank_home} ` : ''}${g.home} — ${g.commence_time}${noStats ? ' (No Projection)' : ''}`
            return <option key={i} value={i}>{label}</option>
          })}
        </select>
      </div>

      {/* Controls grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
        <div>
          <div style={labelStyle}>Temperature — {temp}°F</div>
          <input type="range" min={40} max={105} step={1} value={temp}
            onChange={e => setTemp(Number(e.target.value))}
            style={{ width: '100%', accentColor: 'var(--ss-teal)' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--ss-text-muted)', marginTop: '2px' }}>
            <span>40°F</span><span>105°F</span>
          </div>
        </div>
        <div>
          <div style={labelStyle}>Wind Speed — {windSpeed} mph</div>
          <input type="range" min={0} max={25} step={1} value={windSpeed}
            onChange={e => setWindSpeed(Number(e.target.value))}
            style={{ width: '100%', accentColor: 'var(--ss-teal)' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--ss-text-muted)', marginTop: '2px' }}>
            <span>0 mph</span><span>25 mph</span>
          </div>
        </div>
        <div>
          <div style={labelStyle}>Wind Direction</div>
          <select value={windDir} onChange={e => setWindDir(e.target.value)} style={inputStyle}>
            <option value="out">Blowing Out (favors scoring)</option>
            <option value="neutral">Neutral / Cross</option>
            <option value="in">Blowing In (suppresses scoring)</option>
          </select>
        </div>
        <div>
          <div style={labelStyle}>Park Factor — {(parkOverride !== null ? parkOverride : hPark).toFixed(2)}</div>
          <input type="range" min={0.80} max={1.20} step={0.01}
            value={parkOverride !== null ? parkOverride : hPark}
            onChange={e => setParkOverride(Number(e.target.value))}
            style={{ width: '100%', accentColor: 'var(--ss-teal)' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--ss-text-muted)', marginTop: '2px' }}>
            <span>0.80</span>
            <span onClick={() => setParkOverride(null)}
              style={{ cursor: 'pointer', color: 'var(--ss-teal)', textDecoration: 'underline' }}>Reset</span>
            <span>1.20</span>
          </div>
        </div>
      </div>

      {/* Output panel */}
      {g && (
        <div style={{ background: 'var(--ss-surface)', border: '1px solid var(--ss-border)', borderRadius: '14px', overflow: 'hidden' }}>
          <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--ss-border)', background: 'rgba(255,255,255,0.02)', fontWeight: 700, fontSize: '14px' }}>
            Forecast Output — {g.away} @ {g.home}
          </div>
          {!gHasStats && (
            <div style={{
              padding: '16px 20px', background: 'rgba(245,158,11,0.08)',
              borderBottom: '1px solid rgba(245,158,11,0.2)', fontSize: '13px',
              color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '8px',
            }}>
              ⚠️ No historical stats data available for one or both teams in this matchup.
              Projection N/A — select a different game to use the Forecast Engine.
            </div>
          )}
          <div style={{ display: 'flex', flexWrap: 'wrap' }}>
            {[
              { label: `${g.away} (Away)`, value: aProj, sub: 'projected runs' },
              { label: `${g.home} (Home)`, value: hProj, sub: 'projected runs' },
              { label: 'Model Total', value: modelTotal, sub: 'combined', highlight: true },
              {
                label: 'Vegas Total',
                value: g.vegas_total ?? 'N/A',
                sub: totalEdge !== null ? (totalEdge > 0 ? `OVER by ${totalEdge}` : `UNDER by ${Math.abs(totalEdge)}`) : '—',
                edgeColor: totalEdge !== null ? (totalEdge > 0 ? '#84cc16' : '#0ea5e9') : null,
              },
            ].map(({ label, value, sub, highlight, edgeColor }) => (
              <div key={label} style={{ flex: '1 1 140px', padding: '20px 16px', textAlign: 'center', borderRight: '1px solid var(--ss-border)' }}>
                <div style={{ fontSize: '10px', color: 'var(--ss-text-muted)', fontWeight: 700, letterSpacing: '0.6px', marginBottom: '8px' }}>
                  {label.toUpperCase()}
                </div>
                <div style={{ fontSize: '32px', fontWeight: 800, lineHeight: 1, color: highlight ? 'var(--ss-teal)' : 'var(--ss-text)' }}>
                  {value ?? '—'}
                </div>
                <div style={{ fontSize: '11px', color: edgeColor ?? 'var(--ss-text-muted)', marginTop: '6px', fontWeight: edgeColor ? 700 : 400 }}>
                  {sub}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── NcaaBaseball container ────────────────────────────────────────────────────

function NcaaBaseball() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [tab, setTab] = useState('previews')

  const run = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/ncaa/baseball')
      const json = await res.json()
      setData(json)
    } catch (e) {
      setData({ status: 'error', message: e.message, games: [] })
    } finally {
      setLoading(false)
    }
  }

  const games = data?.games ?? []
  const rankedCount = games.filter(g => (g.rank_home && g.rank_home <= 25) || (g.rank_away && g.rank_away <= 25)).length
  const liveCount   = games.filter(g => g.status === 'in_progress').length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: '18px' }}>⚾ College Hardball Syndicate</div>
          <div style={{ fontSize: '13px', color: 'var(--ss-text-muted)', marginTop: '4px' }}>
            Full D1 slate · ELO + RPG + ERA model · Top 25 · Conference view · VLS Standard
          </div>
        </div>
        <button onClick={run} disabled={loading} className="ss-btn-primary">
          {loading ? '⏳ Scanning...' : '🚀 Scan NCAA Baseball'}
        </button>
      </div>

      {/* Error */}
      {data?.status === 'error' && (
        <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '10px', padding: '16px', color: '#f87171' }}>
          ⚠️ {data.message}
        </div>
      )}

      {/* Empty state before scan */}
      {!data && !loading && (
        <div style={{ background: 'var(--ss-surface)', border: '1px dashed var(--ss-border)', borderRadius: '14px', padding: '60px', textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '12px' }}>⚾</div>
          <div style={{ fontSize: '16px', fontWeight: 700, marginBottom: '8px' }}>NCAA Baseball Model</div>
          <div style={{ fontSize: '13px', color: 'var(--ss-text-muted)' }}>
            Click Scan NCAA Baseball to pull today's full D1 slate with ELO + RPG + ERA projections.
          </div>
        </div>
      )}

      {/* After scan */}
      {data && data.status !== 'error' && (
        <>
          {/* Summary stat cards */}
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            {[
              { label: 'Games',        value: data.total },
              { label: 'Live Now',     value: liveCount,   accent: liveCount > 0 ? '#f87171' : null },
              { label: 'Ranked Games', value: rankedCount, accent: rankedCount > 0 ? '#f59e0b' : null },
              { label: 'Overs',        value: games.filter(g => g.total_edge > 0).length },
              { label: 'Unders',       value: games.filter(g => g.total_edge < 0).length },
              { label: 'Elite Edges',  value: games.filter(g => Math.abs(g.total_edge) >= 2).length },
            ].map(({ label, value, accent }) => (
              <div key={label} style={{
                flex: 1, minWidth: '70px', background: 'var(--ss-surface)',
                border: '1px solid var(--ss-border)', borderRadius: '10px',
                padding: '12px 16px', textAlign: 'center',
              }}>
                <div style={{ fontSize: '22px', fontWeight: 800, color: accent || 'var(--ss-teal)' }}>{value}</div>
                <div style={{ fontSize: '11px', color: 'var(--ss-text-muted)', marginTop: '2px' }}>{label}</div>
              </div>
            ))}
          </div>

          {/* Sub-tab nav */}
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            <SubTabBtn active={tab === 'previews'}    onClick={() => setTab('previews')}>🔭 Game Previews</SubTabBtn>
            <SubTabBtn active={tab === 'top25'}       onClick={() => setTab('top25')}>🏆 Top 25</SubTabBtn>
            <SubTabBtn active={tab === 'conferences'} onClick={() => setTab('conferences')}>🏟️ Conferences</SubTabBtn>
            <SubTabBtn active={tab === 'bets'}        onClick={() => setTab('bets')}>🎯 Best Bets</SubTabBtn>
            <SubTabBtn active={tab === 'forecast'}    onClick={() => setTab('forecast')}>🌡️ Forecast</SubTabBtn>
          </div>

          {tab === 'previews'    && <GamePreviews games={games} />}
          {tab === 'top25'       && <Top25 games={games} />}
          {tab === 'conferences' && <ConferencesTab games={games} />}
          {tab === 'bets'        && <BestBets games={games} />}
          {tab === 'forecast'    && <ForecastTool games={games} />}
        </>
      )}
    </div>
  )
}

// ── NCAA Hoops ─────────────────────────────────────────────────────────────────

function NcaaHoops() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [view, setView] = useState('total')

  const run = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/ncaa/hoops')
      const json = await res.json()
      setData(json)
    } catch (e) {
      setData({ status: 'error', message: e.message, games: [] })
    } finally {
      setLoading(false)
    }
  }

  const games = data?.games ?? []

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: '18px' }}>🏀 Hardwood Upset Radar (NCAA)</div>
          <div style={{ fontSize: '13px', color: 'var(--ss-text-muted)', marginTop: '4px' }}>
            Torvik tempo-adjusted model · AdjOE · AdjDE · Pythagorean win probability
          </div>
        </div>
        <button onClick={run} disabled={loading} className="ss-btn-primary">
          {loading ? '⏳ Scanning...' : '🚀 Scan Hoops Slate'}
        </button>
      </div>

      {data?.status === 'error' && (
        <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '10px', padding: '16px', color: '#f87171' }}>
          ⚠️ {data.message}
        </div>
      )}

      {data?.status === 'no_data' && (
        <div style={{ background: 'var(--ss-surface)', border: '1px dashed var(--ss-border)', borderRadius: '14px', padding: '50px', textAlign: 'center' }}>
          <div style={{ fontSize: '40px', marginBottom: '12px' }}>📊</div>
          <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--ss-text)', marginBottom: '8px' }}>No data available</div>
          <div style={{ fontSize: '13px', color: 'var(--ss-text-muted)' }}>Check back after the next scheduled update.</div>
        </div>
      )}

      {games.length > 0 && (
        <>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            {[
              { label: 'Games',        value: data.total },
              { label: 'Spread Edges', value: games.filter(g => Math.abs(g.spread_edge) >= 2).length },
              { label: 'Total Edges',  value: games.filter(g => Math.abs(g.total_edge) >= 2).length },
            ].map(({ label, value }) => (
              <div key={label} style={{ flex: 1, minWidth: '80px', background: 'var(--ss-surface)', border: '1px solid var(--ss-border)', borderRadius: '10px', padding: '12px 16px', textAlign: 'center' }}>
                <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--ss-teal)' }}>{value}</div>
                <div style={{ fontSize: '11px', color: 'var(--ss-text-muted)', marginTop: '2px' }}>{label}</div>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: '6px' }}>
            {['total', 'spread', 'moneyline'].map(v => (
              <button key={v} onClick={() => setView(v)} style={{
                padding: '6px 14px', borderRadius: '6px', fontSize: '13px', fontWeight: 600,
                border: view === v ? '1px solid var(--ss-teal)' : '1px solid var(--ss-border)',
                background: view === v ? 'rgba(14,165,233,0.15)' : 'transparent',
                color: view === v ? 'var(--ss-teal)' : 'var(--ss-text-muted)', cursor: 'pointer',
              }}>
                {v.charAt(0).toUpperCase() + v.slice(1)}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {games.map((g, i) => (
              <div key={i} style={{ background: 'var(--ss-surface)', border: '1px solid var(--ss-border)', borderRadius: '12px', overflow: 'hidden' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', borderBottom: '1px solid var(--ss-border)', background: 'rgba(255,255,255,0.02)' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '15px' }}>{g.matchup}</div>
                    <div style={{ fontSize: '12px', color: 'var(--ss-text-muted)', marginTop: '2px' }}>{g.commence_time}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--ss-teal)', letterSpacing: '0.7px', textTransform: 'uppercase', marginBottom: '4px' }}>
                      Projected Final
                    </div>
                    <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--ss-text)', lineHeight: 1 }}>
                      {g.home} <span style={{ color: 'var(--ss-teal)' }}>{g.h_proj}</span>
                      <span style={{ color: 'var(--ss-text-muted)', fontWeight: 400, fontSize: '14px' }}> – </span>
                      {g.away} <span style={{ color: 'var(--ss-teal)' }}>{g.a_proj}</span>
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--ss-text-muted)', marginTop: '3px' }}>
                      {g.home} {g.h_win_prob} win | {g.away} {g.a_win_prob} win
                    </div>
                  </div>
                </div>
                <div style={{ padding: '14px 20px' }}>
                  {view === 'total' && (
                    <div style={{ flex: 1, background: 'rgba(255,255,255,0.03)', borderRadius: '8px', padding: '10px' }}>
                      <div style={{ fontSize: '11px', color: 'var(--ss-text-muted)', marginBottom: '4px' }}>TOTAL</div>
                      <div style={{ fontWeight: 600 }}>Model: {g.model_total}</div>
                      <div style={{ fontSize: '12px', color: 'var(--ss-text-muted)' }}>Vegas: {g.vegas_total ?? 'N/A'}</div>
                      <div style={{ marginTop: '6px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <EdgeBadge edge={g.total_edge} /><StarRating stars={g.total_stars} />
                      </div>
                    </div>
                  )}
                  {view === 'spread' && (
                    <div style={{ flex: 1, background: 'rgba(255,255,255,0.03)', borderRadius: '8px', padding: '10px' }}>
                      <div style={{ fontSize: '11px', color: 'var(--ss-text-muted)', marginBottom: '4px' }}>SPREAD</div>
                      <div style={{ fontWeight: 600 }}>Model: {g.model_spread}</div>
                      <div style={{ fontSize: '12px', color: 'var(--ss-text-muted)' }}>Vegas: {g.vegas_spread ?? 'N/A'}</div>
                      <div style={{ marginTop: '6px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <EdgeBadge edge={g.spread_edge} /><StarRating stars={g.spread_stars} />
                      </div>
                    </div>
                  )}
                  {view === 'moneyline' && (
                    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                      <div style={{ flex: 1, background: 'rgba(255,255,255,0.03)', borderRadius: '8px', padding: '10px' }}>
                        <div style={{ fontSize: '11px', color: 'var(--ss-text-muted)', marginBottom: '4px' }}>{g.home} (HOME)</div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <div>Model ML: {g.model_h_ml}</div>
                          <div style={{ color: 'var(--ss-text-muted)' }}>Vegas: {g.vegas_h_ml}</div>
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--ss-text-muted)', marginTop: '4px' }}>Win prob: {g.h_win_prob}</div>
                      </div>
                      <div style={{ flex: 1, background: 'rgba(255,255,255,0.03)', borderRadius: '8px', padding: '10px' }}>
                        <div style={{ fontSize: '11px', color: 'var(--ss-text-muted)', marginBottom: '4px' }}>{g.away} (AWAY)</div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <div>Model ML: {g.model_a_ml}</div>
                          <div style={{ color: 'var(--ss-text-muted)' }}>Vegas: {g.vegas_a_ml}</div>
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--ss-text-muted)', marginTop: '4px' }}>Win prob: {g.a_win_prob}</div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {data?.status === 'ok' && games.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--ss-text-muted)' }}>
          No upcoming NCAA Hoops games on the board today.
        </div>
      )}

      {!data && !loading && (
        <div style={{ background: 'var(--ss-surface)', border: '1px dashed var(--ss-border)', borderRadius: '14px', padding: '60px', textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '12px' }}>🏀</div>
          <div style={{ fontSize: '16px', fontWeight: 700, marginBottom: '8px' }}>NCAA Hoops Model</div>
          <div style={{ fontSize: '13px', color: 'var(--ss-text-muted)' }}>Click Scan Hoops Slate to load spread, total, and moneyline edges.</div>
        </div>
      )}
    </div>
  )
}

// ── Hub shell ─────────────────────────────────────────────────────────────────

const TOOLS = [
  { to: '/ncaa',       label: 'Baseball', icon: '⚾', end: true },
  { to: '/ncaa/hoops', label: 'Hoops',    icon: '🏀' },
]

export default function NcaaHub() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '960px', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <span style={{ fontSize: '40px' }}>🎓</span>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 800, margin: 0 }}>NCAA</h1>
          <p style={{ fontSize: '13px', color: 'var(--ss-text-muted)', marginTop: '2px', marginBottom: 0 }}>
            College Baseball + Basketball model outputs with Vegas edge detection
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
        <Route index element={<NcaaBaseball />} />
        <Route path="hoops" element={<NcaaHoops />} />
      </Routes>
    </div>
  )
}
