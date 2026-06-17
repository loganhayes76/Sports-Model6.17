import React, { useState, useEffect } from 'react'
import './MlbPages.css'
import STADIUM_INFO from './stadiumData.js'

const BAT_COLORS  = { L: '#0ea5e9', R: '#84cc16', S: '#f59e0b', B: '#f59e0b' }
const HAND_COLORS = { LHP: '#a78bfa', RHP: '#fb923c' }

const HEADSHOT_BASE     = 'https://img.mlbstatic.com/mlb-photos/image/upload'
const HEADSHOT_FALLBACK = `${HEADSHOT_BASE}/d_people:generic:headshot:67:current.png/w_40,h_40/v1/people/0/headshot/67/current`

function hsURL(id, w = 40) {
  return id
    ? `${HEADSHOT_BASE}/d_people:generic:headshot:67:current.png/w_${w},h_${w}/v1/people/${id}/headshot/67/current`
    : HEADSHOT_FALLBACK
}

function Headshot({ playerId }) {
  return (
    <img
      src={hsURL(playerId)}
      alt=""
      onError={e => { e.currentTarget.src = HEADSHOT_FALLBACK }}
      style={{
        width: '26px', height: '26px', borderRadius: '50%',
        objectFit: 'cover', flexShrink: 0,
        background: 'rgba(255,255,255,0.06)',
        border: '1px solid rgba(255,255,255,0.1)',
      }}
    />
  )
}

function BatChip({ bats }) {
  if (!bats) return null
  const label = bats === 'B' ? 'S' : bats
  return (
    <span style={{
      display: 'inline-block', fontSize: '10px', fontWeight: 700,
      padding: '1px 5px', borderRadius: '4px', lineHeight: 1.5,
      background: `${BAT_COLORS[bats] || '#888'}22`,
      color: BAT_COLORS[bats] || '#888',
      border: `1px solid ${BAT_COLORS[bats] || '#888'}55`,
    }}>{label}</span>
  )
}

function HandChip({ hand }) {
  if (!hand) return null
  const color = HAND_COLORS[hand] || '#888'
  return (
    <span style={{
      display: 'inline-block', fontSize: '10px', fontWeight: 700,
      padding: '1px 6px', borderRadius: '4px', lineHeight: 1.5,
      background: `${color}22`, color, border: `1px solid ${color}55`,
    }}>{hand}</span>
  )
}

function PitcherCard({ name, hand, pitcherId, number, era }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '4px 0 6px' }}>
      <Headshot playerId={pitcherId} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap' }}>
          {number && (
            <span style={{ fontSize: '10px', color: 'var(--ss-text-muted)', fontWeight: 700 }}>
              #{number}
            </span>
          )}
          <span style={{
            fontSize: '12px', fontWeight: 700, color: 'var(--ss-text)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>{name || 'TBD'}</span>
          <HandChip hand={hand} />
        </div>
        {era && era !== '--' && (
          <span style={{ fontSize: '10px', color: 'var(--ss-text-muted)' }}>
            <strong style={{ color: 'var(--ss-text)' }}>{era}</strong> ERA
          </span>
        )}
      </div>
    </div>
  )
}

function ScorecardRow({ slot, player }) {
  if (typeof player === 'string') {
    return (
      <tr>
        <td style={slotCell}>{slot}</td>
        <td colSpan={5} style={{ padding: '5px 8px', color: 'var(--ss-text)' }}>{player}</td>
      </tr>
    )
  }
  if (!player || typeof player !== 'object') return null
  const avg = player.avg && player.avg !== '.000' && player.avg !== '---' ? player.avg : '—'
  return (
    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
      <td style={slotCell}>{slot}</td>
      <td style={numCell}>#{player.number || '—'}</td>
      <td style={{ ...nameCell, padding: '4px 6px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
          <Headshot playerId={player.id} />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {player.name || '—'}
          </span>
        </div>
      </td>
      <td style={posCell}>{player.position || '—'}</td>
      <td style={{ padding: '5px 6px', textAlign: 'center' }}>
        <BatChip bats={player.bats} />
      </td>
      <td style={avgCell}>{avg}</td>
    </tr>
  )
}

const slotCell = {
  padding: '5px 8px', textAlign: 'center', fontWeight: 700,
  color: 'var(--ss-text-muted)', fontSize: '12px', width: '28px',
}
const numCell = {
  padding: '5px 6px', color: 'var(--ss-text-muted)', fontSize: '11px',
  whiteSpace: 'nowrap', width: '36px',
}
const nameCell = {
  padding: '5px 6px', color: 'var(--ss-text)', fontSize: '12px',
  fontWeight: 500, maxWidth: '130px', whiteSpace: 'nowrap',
  overflow: 'hidden', textOverflow: 'ellipsis',
}
const posCell = {
  padding: '5px 6px', color: '#0ea5e9', fontSize: '11px',
  fontWeight: 700, width: '32px', textAlign: 'center',
}
const avgCell = {
  padding: '5px 8px', color: 'var(--ss-text-muted)', fontSize: '11px',
  width: '44px', textAlign: 'right',
}

function ScorecardTable({ lineup, manager, pitcher = {}, side, abbr }) {
  return (
    <div className="team-col">
      <div className="team-label">
        {side === 'away' ? '✈️' : '🏠'} {abbr}
      </div>
      <PitcherCard
        name={pitcher.name}
        hand={pitcher.hand}
        pitcherId={pitcher.id}
        number={pitcher.number}
        era={pitcher.era}
      />
      {manager ? (
        <div style={{ fontSize: '11px', color: 'var(--ss-text-muted)', marginBottom: '6px' }}>
          Mgr: {manager}
        </div>
      ) : null}
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.12)' }}>
            <th style={{ ...slotCell, color: 'var(--ss-text-muted)', fontSize: '10px', fontWeight: 600 }}>#</th>
            <th style={{ ...numCell, color: 'var(--ss-text-muted)', fontSize: '10px', fontWeight: 600 }}>No.</th>
            <th style={{ ...nameCell, color: 'var(--ss-text-muted)', fontSize: '10px', fontWeight: 600 }}>Player</th>
            <th style={{ ...posCell, color: 'var(--ss-text-muted)', fontSize: '10px', fontWeight: 600 }}>Pos</th>
            <th style={{ padding: '4px 6px', textAlign: 'center', color: 'var(--ss-text-muted)', fontSize: '10px', fontWeight: 600 }}>Bat</th>
            <th style={{ ...avgCell, color: 'var(--ss-text-muted)', fontSize: '10px', fontWeight: 600 }}>AVG</th>
          </tr>
        </thead>
        <tbody>
          {(lineup || []).slice(0, 9).map((p, i) => (
            <ScorecardRow key={i} slot={i + 1} player={p} />
          ))}
          {(lineup || []).length === 0 && (
            <tr>
              <td colSpan={6} style={{ padding: '12px 8px', textAlign: 'center', color: 'var(--ss-text-muted)', fontSize: '12px' }}>
                Lineup not yet posted
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

function EngineRow({ name, data, awayAbbr }) {
  if (!data || typeof data !== 'object') return null
  const spread = data.spread ?? 0
  const total  = data.total  ?? null
  const aRuns  = total != null ? ((total + spread) / 2).toFixed(1) : null
  const hRuns  = total != null ? ((total - spread) / 2).toFixed(1) : null
  return (
    <tr>
      <td>{name}</td>
      <td>{total ?? '—'}</td>
      <td>{data.h_win_pct != null ? `${data.h_win_pct}%` : '—'}</td>
      <td style={{ whiteSpace: 'nowrap' }}>
        {aRuns != null && awayAbbr ? `${aRuns} – ${hRuns}` : '—'}
      </td>
    </tr>
  )
}

// ─── Scorecard HTML generator ──────────────────────────────────────────────────
// Produces a complete self-contained HTML document for the print scorecard
// opened in a new browser window.

function scLineupRows(lineup, count = 9) {
  const blankRow = `
    <tr class="sc-blank-row">
      <td class="sc-slot"></td>
      <td class="sc-num"></td>
      <td class="sc-name"></td>
      <td class="sc-pos"></td>
      <td class="sc-bats"></td>
      <td class="sc-avg"></td>
    </tr>`

  const rows = []
  const players = (lineup || []).slice(0, count)

  for (let i = 0; i < count; i++) {
    const p = players[i]
    if (p && typeof p === 'object') {
      const avg = p.avg && p.avg !== '.000' && p.avg !== '---' ? p.avg : ''
      const batLabel = p.bats === 'B' ? 'S' : (p.bats || '')
      const batColor = { L: '#0ea5e9', R: '#84cc16', S: '#f59e0b' }[batLabel] || '#888'
      const batBadge = batLabel
        ? `<span style="display:inline-block;font-size:9px;font-weight:700;padding:1px 4px;border-radius:3px;background:${batColor}22;color:${batColor};border:1px solid ${batColor}55">${batLabel}</span>`
        : ''
      const img = `<img src="${hsURL(p.id, 28)}" width="22" height="22" style="border-radius:50%;vertical-align:middle;margin-right:4px;object-fit:cover" onerror="this.src='${HEADSHOT_FALLBACK}'" alt="">`
      rows.push(`
    <tr class="sc-player-row">
      <td class="sc-slot">${i + 1}</td>
      <td class="sc-num">${p.number ? '#' + p.number : ''}</td>
      <td class="sc-name">${img}${p.name || ''}</td>
      <td class="sc-pos">${p.position || ''}</td>
      <td class="sc-bats">${batBadge}</td>
      <td class="sc-avg">${avg}</td>
    </tr>`)
    } else {
      rows.push(blankRow)
    }
  }
  return rows.join('')
}

function scSubRows(count = 3) {
  const rows = []
  for (let i = 0; i < count; i++) {
    rows.push(`
    <tr class="sc-blank-row">
      <td class="sc-slot"></td>
      <td class="sc-num"></td>
      <td class="sc-name"></td>
      <td class="sc-pos"></td>
      <td class="sc-bats"></td>
      <td class="sc-avg"></td>
    </tr>`)
  }
  return rows.join('')
}

function scScoreGrid(aAbbr, hAbbr) {
  const innings = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
  const heads = innings.map(n => `<th>${n}</th>`).join('')
  const cells = innings.map(() => '<td></td>').join('')
  return `
  <table class="sc-grid">
    <thead>
      <tr>
        <th class="sc-grid-team">Team</th>
        ${heads}
        <th class="sc-rhe">R</th>
        <th class="sc-rhe">H</th>
        <th class="sc-rhe">E</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td class="sc-grid-team">${aAbbr}</td>
        ${cells}
        <td class="sc-rhe"></td>
        <td class="sc-rhe"></td>
        <td class="sc-rhe"></td>
      </tr>
      <tr>
        <td class="sc-grid-team">${hAbbr}</td>
        ${cells}
        <td class="sc-rhe"></td>
        <td class="sc-rhe"></td>
        <td class="sc-rhe"></td>
      </tr>
    </tbody>
  </table>`
}

function scPitcherBlock(name, hand, pitcherId, number, era) {
  const handColor = hand === 'LHP' ? '#7c3aed' : hand === 'RHP' ? '#ea580c' : '#888'
  const handBadge = hand
    ? `<span style="display:inline-block;font-size:9px;font-weight:700;padding:1px 5px;border-radius:3px;background:${handColor}22;color:${handColor};border:1px solid ${handColor}55">${hand}</span>`
    : ''
  const eraText = era && era !== '--' ? `<span class="sc-era">${era} ERA</span>` : ''
  const img = `<img src="${hsURL(pitcherId, 36)}" width="36" height="36" style="border-radius:50%;object-fit:cover;flex-shrink:0" onerror="this.src='${HEADSHOT_FALLBACK}'" alt="">`
  const numBadge = number ? `<span class="sc-p-num">#${number}</span>` : ''
  return `
  <div class="sc-pitcher">
    ${img}
    <div class="sc-p-info">
      <div class="sc-p-top">${numBadge}<strong class="sc-p-name">${name || 'TBD'}</strong>${handBadge}</div>
      ${eraText}
    </div>
  </div>`
}

function scBullpenBlock(abbr, bp) {
  if (!bp || typeof bp !== 'object') return ''
  const colorMap = {
    red:    '#dc2626',
    orange: '#ea580c',
    yellow: '#ca8a04',
    green:  '#16a34a',
  }
  const statusColor = colorMap[bp.color] || '#555'
  const arms = Array.isArray(bp.arms) && bp.arms.length
    ? bp.arms.map(a => {
        const num  = a.number
          ? `<span class="sc-bp-num">#${a.number}</span>`
          : `<span class="sc-bp-num sc-bp-num--unknown">#—</span>`
        const hand = a.throws && a.throws !== '?'
          ? `<span class="sc-bp-hand sc-bp-hand--${a.throws.toLowerCase()}">${a.throws}</span>`
          : `<span class="sc-bp-hand sc-bp-hand--unknown">?</span>`
        return `<span class="sc-bp-arm">${num}${hand}<span class="sc-bp-arm-name">${a.name}</span><strong class="sc-bp-arm-p">${a.pitches}p</strong></span>`
      }).join('')
    : '<span style="color:#888">No bullpen data</span>'
  return `
  <div class="sc-bullpen">
    <div class="sc-bp-hdr">Bullpen — ${abbr}</div>
    <div class="sc-bp-status-row">
      <span class="sc-bp-badge" style="color:${statusColor};border-color:${statusColor}">${bp.status || '—'}</span>
      <span class="sc-bp-pitches">${bp.pitches ?? 0} pitches / 3d</span>
    </div>
    <div class="sc-bp-action">${bp.action || ''}</div>
    <div class="sc-bp-arms">${arms}</div>
  </div>`
}

function buildScorecardHTML(game) {
  const stadium = STADIUM_INFO[game.home_abbr] || {}
  const venueDisplay = game.venue_name || stadium.venue || ''

  const dims = stadium.lf
    ? `LF ${stadium.lf} &bull; LCF ${stadium.lcf} &bull; CF ${stadium.cf} &bull; RCF ${stadium.rcf} &bull; RF ${stadium.rf}`
    : ''
  const stadiumStrip = venueDisplay ? `
  <div class="sc-stadium">
    <strong>${venueDisplay}</strong>
    ${stadium.capacity ? `&nbsp;&bull;&nbsp;Cap: ${stadium.capacity}` : ''}
    ${stadium.surface  ? `&nbsp;&bull;&nbsp;${stadium.surface}` : ''}
    ${stadium.roof     ? `&nbsp;&bull;&nbsp;Roof: ${stadium.roof}` : ''}
    ${dims             ? `<br><span class="sc-dims">${dims}</span>` : ''}
  </div>` : ''

  const css = `
    *, *::before, *::after { box-sizing: border-box; }
    @page { size: landscape; margin: 0.5in; }
    @media print { .no-print { display: none !important; } }
    body {
      font-family: Georgia, 'Times New Roman', serif;
      background: #fff; color: #111;
      margin: 0; padding: 12px 16px; font-size: 11px;
    }
    a { color: inherit; text-decoration: none; }

    /* ── Header ── */
    .sc-header {
      border-bottom: 2px solid #222;
      padding-bottom: 8px;
      margin-bottom: 6px;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .sc-top-row {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
    }
    .sc-brand {
      font-size: 10px;
      font-weight: 700;
      color: #0ea5e9;
      letter-spacing: 1px;
      text-transform: uppercase;
    }
    .sc-matchup {
      font-size: 20px;
      font-weight: 900;
      line-height: 1.1;
      margin: 2px 0;
    }
    .sc-meta {
      font-size: 10px;
      color: #555;
      margin: 1px 0;
    }
    .sc-stadium {
      font-size: 10px;
      background: #f5f5f5;
      border: 1px solid #ddd;
      border-radius: 4px;
      padding: 4px 8px;
      margin-top: 4px;
    }
    .sc-dims { color: #666; }
    .print-btn {
      font-family: Arial, sans-serif;
      font-size: 11px; font-weight: 700;
      background: #0ea5e9; color: #fff;
      border: none; border-radius: 6px;
      padding: 5px 14px; cursor: pointer;
      white-space: nowrap;
    }
    .print-btn:hover { background: #0284c7; }

    /* ── Two-column layout ── */
    .sc-columns {
      display: grid;
      grid-template-columns: 1fr 1px 1fr;
      gap: 0;
      margin-top: 8px;
    }
    .sc-divider { background: #bbb; }
    .sc-team { padding: 0 12px; }
    .sc-team:first-child { padding-left: 0; }
    .sc-team:last-child  { padding-right: 0; }
    .sc-team-hdr {
      font-size: 13px;
      font-weight: 900;
      color: #0369a1;
      margin-bottom: 6px;
      border-bottom: 1px solid #ddd;
      padding-bottom: 4px;
    }

    /* ── Pitcher block ── */
    .sc-pitcher {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 8px;
      padding: 6px 8px;
      background: #f9f9f9;
      border: 1px solid #e5e5e5;
      border-radius: 6px;
    }
    .sc-p-info { display: flex; flex-direction: column; gap: 2px; }
    .sc-p-top  { display: flex; align-items: center; gap: 5px; flex-wrap: wrap; }
    .sc-p-num  { font-size: 9px; font-weight: 700; color: #666; }
    .sc-p-name { font-size: 12px; color: #111; }
    .sc-era    { font-size: 10px; color: #444; }

    /* ── Lineup table ── */
    .sc-mgr { font-size: 9px; color: #777; margin-bottom: 4px; }
    .sc-lineup {
      width: 100%;
      border-collapse: collapse;
      font-size: 10px;
    }
    .sc-lineup thead th {
      font-size: 9px;
      font-weight: 700;
      color: #666;
      text-align: left;
      padding: 3px 4px;
      border-bottom: 2px solid #222;
      white-space: nowrap;
    }
    .sc-lineup td {
      padding: 3px 4px;
      vertical-align: middle;
      border-bottom: 1px solid #e5e5e5;
    }
    .sc-slot  { width: 18px; text-align: center; font-weight: 700; color: #555; }
    .sc-num   { width: 30px; color: #666; white-space: nowrap; }
    .sc-name  { min-width: 110px; }
    .sc-pos   { width: 26px; text-align: center; font-weight: 700; color: #0369a1; }
    .sc-bats  { width: 24px; text-align: center; }
    .sc-avg   { width: 34px; text-align: right; color: #555; }

    .sc-blank-row td { border-bottom: 1px solid #aaa; height: 20px; }
    .sc-blank-row .sc-name { min-width: 110px; }

    .sc-subs-hdr td {
      font-size: 9px;
      font-style: italic;
      color: #888;
      padding: 5px 4px 3px;
      border-bottom: 1px solid #ccc;
      letter-spacing: 0.5px;
      text-transform: uppercase;
    }

    /* ── Score grid ── */
    .sc-grid-wrap {
      margin-top: 12px;
      border-top: 2px solid #222;
      padding-top: 8px;
    }
    .sc-grid-label {
      font-size: 9px;
      font-weight: 700;
      color: #666;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      margin-bottom: 4px;
    }
    .sc-grid {
      width: 100%;
      border-collapse: collapse;
      font-size: 11px;
    }
    .sc-grid th {
      font-weight: 700;
      text-align: center;
      padding: 4px 2px;
      border: 1px solid #333;
      background: #f0f0f0;
      min-width: 28px;
    }
    .sc-grid td {
      text-align: center;
      border: 1px solid #333;
      height: 34px;
      min-width: 28px;
    }
    .sc-grid-team {
      font-weight: 700;
      text-align: left !important;
      padding: 4px 8px !important;
      min-width: 40px !important;
      white-space: nowrap;
    }
    .sc-rhe {
      background: #f5f5f5;
      font-weight: 700;
      border-left: 2px solid #555 !important;
    }

    /* ── Footer ── */
    .sc-footer {
      margin-top: 8px;
      font-size: 9px;
      color: #888;
      text-align: center;
      border-top: 1px solid #ddd;
      padding-top: 4px;
    }

    /* ── Bullpen panel ── */
    .sc-bullpen {
      margin-top: 8px;
      padding: 6px 8px;
      background: #f9f9f9;
      border: 1px solid #e0e0e0;
      border-radius: 5px;
      font-size: 10px;
    }
    .sc-bp-hdr {
      font-size: 10px;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #333;
      border-bottom: 1px solid #ddd;
      padding-bottom: 3px;
      margin-bottom: 4px;
    }
    .sc-bp-status-row {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 3px;
    }
    .sc-bp-badge {
      display: inline-block;
      font-size: 9px;
      font-weight: 700;
      padding: 1px 6px;
      border-radius: 3px;
      border: 1px solid;
      background: transparent;
    }
    .sc-bp-pitches {
      font-size: 9px;
      color: #666;
    }
    .sc-bp-action {
      font-size: 9px;
      color: #444;
      font-style: italic;
      margin-bottom: 3px;
    }
    .sc-bp-arms {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
    }
    .sc-bp-arm {
      display: inline-flex;
      align-items: center;
      gap: 3px;
      font-size: 9px;
      color: #333;
      background: #eee;
      border-radius: 3px;
      padding: 2px 5px;
      white-space: nowrap;
    }
    .sc-bp-num {
      font-family: monospace;
      font-weight: 700;
      font-size: 9px;
      color: #555;
    }
    .sc-bp-num--unknown {
      color: #aaa;
    }
    .sc-bp-hand {
      font-size: 8px;
      font-weight: 800;
      padding: 0px 3px;
      border-radius: 2px;
      line-height: 1.4;
    }
    .sc-bp-hand--l {
      background: #fff7ed;
      color: #c2410c;
      border: 1px solid #fed7aa;
    }
    .sc-bp-hand--r {
      background: #eff6ff;
      color: #1d4ed8;
      border: 1px solid #bfdbfe;
    }
    .sc-bp-hand--unknown {
      background: #f3f4f6;
      color: #9ca3af;
      border: 1px solid #e5e7eb;
    }
    .sc-bp-arm-name {
      color: #222;
    }
    .sc-bp-arm-p {
      color: #555;
    }

    /* ── Stadium theming hook — baseline (override per .sc-{abbr} in task #72) ── */
    body[class^="sc-"] .sc-team-hdr { color: #0369a1; }
    body[class^="sc-"] .sc-grid th  { background: #f0f0f0; }
  `

  const aMgr = game.a_manager ? `<div class="sc-mgr">Mgr: ${game.a_manager}</div>` : ''
  const hMgr = game.h_manager ? `<div class="sc-mgr">Mgr: ${game.h_manager}</div>` : ''

  const aLineupRows = scLineupRows(game.a_lineup)
  const hLineupRows = scLineupRows(game.h_lineup)
  const subRows     = scSubRows(3)

  const aPitcher   = scPitcherBlock(game.a_pitcher, game.a_pitcher_hand, game.a_pitcher_id, game.a_pitcher_number, game.a_pitcher_era)
  const hPitcher   = scPitcherBlock(game.h_pitcher, game.h_pitcher_hand, game.h_pitcher_id, game.h_pitcher_number, game.h_pitcher_era)
  const aBullpen   = scBullpenBlock(game.away_abbr, game.a_bullpen)
  const hBullpen   = scBullpenBlock(game.home_abbr, game.h_bullpen)

  const scoreGrid = scScoreGrid(game.away_abbr, game.home_abbr)

  const rawDate = game.game_date || ''
  const today = rawDate
    ? new Date(rawDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
    : new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Scorecard — ${game.matchup}</title>
  <style>${css}</style>
</head>
<body class="sc-${game.home_abbr}">

  <div class="sc-header">
    <div class="sc-top-row">
      <div>
        <div class="sc-brand">SpreadSlayer ⚾ Scorecard</div>
        <div class="sc-matchup">${game.matchup}</div>
        <div class="sc-meta">${venueDisplay ? venueDisplay + '&nbsp;&bull;&nbsp;' : ''}${today}&nbsp;&bull;&nbsp;${game.game_time || ''}</div>
        <div class="sc-meta">
          Ump: ${game.ump_name || 'TBD'}
          &nbsp;&bull;&nbsp;${game.w_display || ''}
          &nbsp;&bull;&nbsp;Park Factor: ${game.park_fac || '1.00'}x
          &nbsp;&bull;&nbsp;O/U: ${game.consensus_total}
          &nbsp;&bull;&nbsp;${game.home_abbr} ${game.h_win_pct}% / ${game.away_abbr} ${game.a_win_pct}%
        </div>
      </div>
      <button class="print-btn no-print" onclick="window.print()">🖨&nbsp;Print</button>
    </div>
    ${stadiumStrip}
  </div>

  <div class="sc-columns">

    <!-- Away team -->
    <div class="sc-team">
      <div class="sc-team-hdr">✈ ${game.away_abbr} &mdash; Away</div>
      ${aPitcher}
      ${aMgr}
      <table class="sc-lineup">
        <thead>
          <tr>
            <th class="sc-slot">#</th>
            <th class="sc-num">No.</th>
            <th class="sc-name">Player</th>
            <th class="sc-pos">Pos</th>
            <th class="sc-bats">B</th>
            <th class="sc-avg">AVG</th>
          </tr>
        </thead>
        <tbody>
          ${aLineupRows}
          <tr class="sc-subs-hdr"><td colspan="6">— Substitutes —</td></tr>
          ${subRows}
        </tbody>
      </table>
      ${aBullpen}
    </div>

    <div class="sc-divider"></div>

    <!-- Home team -->
    <div class="sc-team">
      <div class="sc-team-hdr">🏠 ${game.home_abbr} &mdash; Home</div>
      ${hPitcher}
      ${hMgr}
      <table class="sc-lineup">
        <thead>
          <tr>
            <th class="sc-slot">#</th>
            <th class="sc-num">No.</th>
            <th class="sc-name">Player</th>
            <th class="sc-pos">Pos</th>
            <th class="sc-bats">B</th>
            <th class="sc-avg">AVG</th>
          </tr>
        </thead>
        <tbody>
          ${hLineupRows}
          <tr class="sc-subs-hdr"><td colspan="6">— Substitutes —</td></tr>
          ${subRows}
        </tbody>
      </table>
      ${hBullpen}
    </div>

  </div>

  <!-- Score grid -->
  <div class="sc-grid-wrap">
    <div class="sc-grid-label">Score by Inning</div>
    ${scoreGrid}
  </div>

  <div class="sc-footer no-print">
    Generated by SpreadSlayer &bull; spreadslayer.com &bull; For informational use only
  </div>

</body>
</html>`
}

// ─── CardErrorBoundary ────────────────────────────────────────────────────────

class CardErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, errorMsg: '' }
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, errorMsg: error?.message || String(error) }
  }
  componentDidCatch(error, info) {
    console.error('[CardErrorBoundary]', error, info)
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="mlb-card" style={{ padding: '14px 16px', color: '#f87171', fontSize: '12px', borderColor: 'rgba(248,113,113,0.3)' }}>
          <strong>Card error:</strong> {this.state.errorMsg}
        </div>
      )
    }
    return this.props.children
  }
}

// ─── GameCard ─────────────────────────────────────────────────────────────────

function GameCard({ game }) {
  const [open, setOpen] = useState(false)

  const homeIsFav = (game.h_win_pct ?? 0) >= 50
  const favAbbr   = homeIsFav ? game.home_abbr : game.away_abbr
  const favPct    = homeIsFav ? game.h_win_pct  : game.a_win_pct

  function handleOpenScorecard(e) {
    e.stopPropagation()
    const html = buildScorecardHTML(game)
    const w = window.open('', '_blank', 'width=1100,height=750')
    if (w) {
      w.document.open()
      w.document.write(html)
      w.document.close()
    }
  }

  const engineEntries = Object.entries(game.engine_outs || {})
    .filter(([, d]) => d && typeof d === 'object')

  const avgTotal = engineEntries.length
    ? (engineEntries.reduce((s, [, d]) => s + (d.total ?? 0), 0) / engineEntries.length).toFixed(2)
    : null
  const avgHWinPct = engineEntries.length
    ? (engineEntries.reduce((s, [, d]) => s + (d.h_win_pct ?? 0), 0) / engineEntries.length).toFixed(1)
    : null
  const avgSpread = engineEntries.length
    ? engineEntries.reduce((s, [, d]) => s + (d.spread ?? 0), 0) / engineEntries.length
    : 0
  const avgATotal = avgTotal != null ? ((parseFloat(avgTotal) + avgSpread) / 2).toFixed(1) : null
  const avgHTotal = avgTotal != null ? ((parseFloat(avgTotal) - avgSpread) / 2).toFixed(1) : null

  return (
    <div className="mlb-card game-card">
      <div className="game-header" onClick={() => setOpen(!open)}>
        <div>
          <span className="matchup-label">{game.matchup}</span>
          <span className="game-time">{game.game_time}</span>
        </div>
        <div className="game-proj">
          <span className="proj-total">O/U {game.consensus_total}</span>
          {avgATotal != null && (
            <span className="proj-score">
              Proj {game.away_abbr} {avgATotal} – {game.home_abbr} {avgHTotal}
            </span>
          )}
          <span className={`win-side ${homeIsFav ? 'fav' : 'dog'}`}>
            {favAbbr} {Math.round(favPct ?? 0)}%
          </span>
        </div>
        <span className="expand-arrow">{open ? '▲' : '▼'}</span>
      </div>

      {open && (
        <div className="game-detail">
          <div style={{ fontSize: '11px', color: 'var(--ss-text-muted)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '16px' }}>
            <span>Away: <strong style={{ color: game.a_lineup_status === 'Confirmed' ? '#84cc16' : '#f59e0b' }}>{game.a_lineup_status} Lineup</strong></span>
            <span>Home: <strong style={{ color: game.h_lineup_status === 'Confirmed' ? '#84cc16' : '#f59e0b' }}>{game.h_lineup_status} Lineup</strong></span>
            <button className="print-scorecard-btn" onClick={handleOpenScorecard}>
              📋 Scorecard
            </button>
          </div>
          <div className="matchup-cols">
            <ScorecardTable
              lineup={game.a_lineup}
              manager={game.a_manager}
              pitcher={{ name: game.a_pitcher, hand: game.a_pitcher_hand, id: game.a_pitcher_id, number: game.a_pitcher_number, era: game.a_pitcher_era }}
              side="away"
              abbr={game.away_abbr}
            />
            <div className="model-col">
              <div className="env-info">
                <div>{game.w_display}</div>
                <div>Park Factor: {game.park_fac}x</div>
                <div>Ump: {game.ump_name || 'TBD'}</div>
              </div>
              <table className="engine-table">
                <thead>
                  <tr>
                    <th>Engine</th>
                    <th>Total</th>
                    <th>Home Win%</th>
                    <th>Score ({game.away_abbr}–{game.home_abbr})</th>
                  </tr>
                </thead>
                <tbody>
                  {engineEntries.map(([name, data]) => (
                    <EngineRow key={name} name={name} data={data} awayAbbr={game.away_abbr} homeAbbr={game.home_abbr} />
                  ))}
                </tbody>
                {avgTotal != null && (
                  <tfoot>
                    <tr style={{ borderTop: '1px solid rgba(255,255,255,0.18)', fontWeight: 700 }}>
                      <td>Average</td>
                      <td>{avgTotal}</td>
                      <td>{avgHWinPct}%</td>
                      <td style={{ whiteSpace: 'nowrap' }}>{avgATotal} – {avgHTotal}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
            <ScorecardTable
              lineup={game.h_lineup}
              manager={game.h_manager}
              pitcher={{ name: game.h_pitcher, hand: game.h_pitcher_hand, id: game.h_pitcher_id, number: game.h_pitcher_number, era: game.h_pitcher_era }}
              side="home"
              abbr={game.home_abbr}
            />
          </div>
        </div>
      )}
    </div>
  )
}

export default function MlbCleanupCrew() {
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)

  useEffect(() => {
    fetch('/api/mlb/model')
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [])

  if (loading) return <div className="mlb-loading">Running 5-engine consensus model...</div>
  if (error)   return <div className="mlb-error">Error: {error}</div>

  const games = data?.games || []
  if (!games.length) return (
    <div className="mlb-empty">
      <span>💥</span>
      <p>No games on today's slate.</p>
    </div>
  )

  return (
    <div className="mlb-page">
      <div className="page-header">
        <h2>Cleanup Crew — Consensus Model</h2>
        <span className="count-badge">{games.length} games</span>
      </div>
      <p className="page-sub">Click any game to expand scorecard lineups and engine breakdown</p>
      <div className="cards-stack">
        {games.map((g, i) => (
          <CardErrorBoundary key={i}>
            <GameCard game={g} />
          </CardErrorBoundary>
        ))}
      </div>
    </div>
  )
}
