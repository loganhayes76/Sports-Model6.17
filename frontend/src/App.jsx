import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext.jsx'
import Layout from './components/Layout.jsx'
import GuestGate from './components/GuestGate.jsx'
import LoginPage from './pages/auth/LoginPage.jsx'
import TermsPage from './pages/auth/TermsPage.jsx'
import Home from './pages/Home.jsx'
import MlbHub from './pages/mlb/MlbHub.jsx'
import NbaHub from './pages/nba/NbaHub.jsx'
import NcaaHub from './pages/ncaa/NcaaHub.jsx'
import NascarHub from './pages/nascar/NascarHub.jsx'
import FantasyDraftBoard from './pages/fantasy/FantasyDraftBoard.jsx'
import DfsHub from './pages/dfs/DfsHub.jsx'
import AdminHub from './pages/admin/AdminHub.jsx'
import Tracker from './pages/tracker/Tracker.jsx'
import MasterBoard from './pages/master-board/MasterBoard.jsx'
import ParlayGrader from './pages/parlay-grader/ParlayGrader.jsx'

function FutureSuite({ icon, title, desc }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px', padding: '80px 24px', maxWidth: '480px', margin: '0 auto', textAlign: 'center' }}>
      <span style={{ fontSize: '56px' }}>{icon}</span>
      <h1 style={{ fontSize: '24px', fontWeight: 800, margin: 0 }}>{title}</h1>
      {desc && <p style={{ fontSize: '14px', color: 'var(--ss-text-muted)', margin: 0 }}>{desc}</p>}
      <span style={{ fontSize: '12px', fontWeight: 700, padding: '4px 14px', borderRadius: '12px', background: 'rgba(14,165,233,0.12)', color: 'var(--ss-teal)', letterSpacing: '1px', textTransform: 'uppercase' }}>Future Integration</span>
    </div>
  )
}

function AppRoutes() {
  const { auth, loading } = useAuth()

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'var(--ss-text-muted)' }}>
        Loading...
      </div>
    )
  }

  if (!auth) {
    return (
      <Routes>
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="*" element={<LoginPage />} />
      </Routes>
    )
  }

  return (
    <Routes>
      <Route path="/terms" element={<TermsPage />} />
      <Route path="/login" element={<Navigate to="/" replace />} />
      <Route path="/" element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="mlb/*" element={<MlbHub />} />
        <Route path="nba/*" element={<NbaHub />} />
        <Route path="ncaa/*" element={<NcaaHub />} />

        {/* Future suites — admin only */}
        <Route path="nascar/*" element={
          <GuestGate requireRole="admin">
            <NascarHub />
          </GuestGate>
        } />
        <Route path="fantasy/*" element={
          <GuestGate requireRole="admin">
            <FantasyDraftBoard />
          </GuestGate>
        } />
        <Route path="nfl/*" element={
          <GuestGate requireRole="admin">
            <FutureSuite icon="🏈" title="NFL" desc="Game lines · Player props · Model edges — coming in a future release." />
          </GuestGate>
        } />
        <Route path="ncaaf/*" element={
          <GuestGate requireRole="admin">
            <FutureSuite icon="🏈" title="NCAAF" desc="College football spreads · Model edges — coming in a future release." />
          </GuestGate>
        } />

        {/* DFS — requires dfs or admin role */}
        <Route path="dfs/*" element={
          <GuestGate requireRole="dfs">
            <DfsHub />
          </GuestGate>
        } />

        {/* Admin — requires admin role */}
        <Route path="admin/*" element={
          <GuestGate requireRole="admin">
            <AdminHub />
          </GuestGate>
        } />

        {/* Tracker — requires member or higher */}
        <Route path="tracker" element={
          <GuestGate requireRole="member">
            <Tracker />
          </GuestGate>
        } />

        {/* Master Board — requires member or higher */}
        <Route path="master-board" element={
          <GuestGate requireRole="member">
            <MasterBoard />
          </GuestGate>
        } />

        <Route path="parlay-grader" element={<ParlayGrader />} />
      </Route>
    </Routes>
  )
}

function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  )
}

export default App
