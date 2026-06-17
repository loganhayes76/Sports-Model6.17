import { Routes, Route, NavLink, Navigate } from 'react-router-dom'
import MlbProps      from './MlbProps.jsx'
import MlbCleanupCrew from './MlbCleanupCrew.jsx'
import MlbUmpire     from './MlbUmpire.jsx'
import MlbBullpen    from './MlbBullpen.jsx'
import MlbWeather    from './MlbWeather.jsx'
import MlbF5Yrfi     from './MlbF5Yrfi.jsx'
import MlbPropMatrix from './MlbPropMatrix.jsx'
import WallStreetCluster from './WallStreetCluster.jsx'
import './MlbHub.css'

const MLB_TOOLS = [
  { to: '/mlb',              label: 'Cleanup Crew',   icon: '💥', end: true },
  { to: '/mlb/props',       label: 'Props',           icon: '📊' },
  { to: '/mlb/matrix',      label: 'Prop Matrix',     icon: '🎯' },
  { to: '/mlb/umpire',      label: 'Umpire Radar',    icon: '🧑‍⚖️' },
  { to: '/mlb/bullpen',     label: 'Bullpen Radar',   icon: '💪' },
  { to: '/mlb/weather',     label: 'Weather & Park',  icon: '🌤️' },
  { to: '/mlb/f5',          label: 'F5 / YRFI',      icon: '⚡' },
  { to: '/mlb/wall-street', label: 'Wall Street',     icon: '📈' },
]

function Stub({ title, icon, desc }) {
  return (
    <div style={{
      display:'flex', flexDirection:'column', alignItems:'center',
      justifyContent:'center', gap:'12px', padding:'60px 24px',
      textAlign:'center', background:'var(--ss-surface)',
      border:'1px dashed var(--ss-border)', borderRadius:'14px',
    }}>
      <span style={{ fontSize:'48px' }}>{icon}</span>
      <h2 style={{ fontSize:'20px', fontWeight:700, color:'var(--ss-text)' }}>{title}</h2>
      <p style={{ fontSize:'14px', color:'var(--ss-text-muted)', maxWidth:'360px' }}>{desc}</p>
      <span style={{
        background:'linear-gradient(135deg, var(--ss-teal-dim), var(--ss-green-dim))',
        color:'#fff', fontSize:'11px', fontWeight:700, letterSpacing:'1px',
        textTransform:'uppercase', padding:'4px 12px', borderRadius:'20px',
      }}>Coming in v0.20.1</span>
    </div>
  )
}

export default function MlbHub() {
  return (
    <div className="mlb-hub">
      <div className="hub-header">
        <span>⚾</span>
        <div>
          <h1>MLB</h1>
          <p>Matchup models, props, umpire tendencies, bullpen usage &amp; more</p>
        </div>
      </div>

      <nav className="mlb-subnav">
        {MLB_TOOLS.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            end={!!t.end}
            className={({ isActive }) => 'mlb-subnav-link' + (isActive ? ' active' : '')}
          >
            <span>{t.icon}</span> {t.label}
          </NavLink>
        ))}
      </nav>

      <div className="hub-content">
        <Routes>
          <Route index        element={<MlbCleanupCrew />} />
          <Route path="props"   element={<MlbProps />} />
          <Route path="matrix"  element={<MlbPropMatrix />} />
          <Route path="umpire"  element={<MlbUmpire />} />
          <Route path="bullpen" element={<MlbBullpen />} />
          <Route path="weather" element={<MlbWeather />} />
          <Route path="f5"          element={<MlbF5Yrfi />} />
          <Route path="wall-street" element={<WallStreetCluster />} />
          <Route path="dfs"     element={<Stub title="MLB DFS" icon="🎯" desc="DFS lineup optimizer — coming in v0.20.1" />} />
          <Route path="*"       element={<Navigate to="/mlb" replace />} />
        </Routes>
      </div>
    </div>
  )
}
