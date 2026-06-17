import { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext.jsx'

const ADMIN_TOKEN_KEY = 'ss_admin_token'

function useAdminToken() {
  const [token, setToken] = useState(() => localStorage.getItem(ADMIN_TOKEN_KEY) || '')
  const save = (t) => { setToken(t); localStorage.setItem(ADMIN_TOKEN_KEY, t) }
  return [token, save]
}

function AdminLogin({ onSuccess }) {
  const [input, setInput] = useState('')
  const [error, setError] = useState('')

  const tryLogin = async () => {
    try {
      const res = await fetch('/api/admin/status', {
        headers: { 'x-admin-token': input },
      })
      const json = await res.json()
      if (json.status === 'ok') {
        onSuccess(input)
      } else {
        setError('Invalid admin password. Check your ADMIN_PASSWORD secret.')
      }
    } catch (e) {
      setError(e.message)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '300px', gap: '16px' }}>
      <div style={{ fontSize: '48px' }}>🔒</div>
      <div style={{ fontWeight: 700, fontSize: '18px' }}>Admin Access Required</div>
      <div style={{ fontSize: '13px', color: 'var(--ss-text-muted)' }}>Enter your admin password to continue</div>
      <div style={{ display: 'flex', gap: '10px', width: '100%', maxWidth: '360px' }}>
        <input
          type="password"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && tryLogin()}
          placeholder="Admin password..."
          style={{ flex: 1, background: 'var(--ss-bg)', border: '1px solid var(--ss-border)', color: 'var(--ss-text)', borderRadius: '8px', padding: '10px 14px', fontSize: '14px' }}
        />
        <button onClick={tryLogin} className="ss-btn-primary">Unlock</button>
      </div>
      {error && <div style={{ color: '#f87171', fontSize: '13px' }}>{error}</div>}
    </div>
  )
}

function StatusCard({ label, value, sub, color }) {
  return (
    <div style={{ background: 'var(--ss-surface)', border: '1px solid var(--ss-border)', borderRadius: '12px', padding: '16px 20px' }}>
      <div style={{ fontSize: '11px', color: 'var(--ss-text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>{label}</div>
      <div style={{ fontSize: '24px', fontWeight: 800, color: color || 'var(--ss-text)' }}>{value}</div>
      {sub && <div style={{ fontSize: '12px', color: 'var(--ss-text-muted)', marginTop: '4px' }}>{sub}</div>}
    </div>
  )
}

function AdminPanel({ token }) {
  const [status, setStatus] = useState(null)
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState(null)
  const [tab, setTab] = useState('overview')
  const [logs, setLogs] = useState(null)
  const [logsLoading, setLogsLoading] = useState(false)
  const [graderRunning, setGraderRunning] = useState(false)
  const [graderResult, setGraderResult] = useState(null)
  const [propsRunning, setPropsRunning] = useState(false)
  const [propsResult, setPropsResult] = useState(null)
  const [users, setUsers] = useState(null)
  const [usersLoading, setUsersLoading] = useState(false)
  const [newUser, setNewUser] = useState({ username: '', role: 'member' })
  const [addingUser, setAddingUser] = useState(false)

  const [passkeys, setPasskeys] = useState(null)
  const [pkLoading, setPkLoading] = useState(false)
  const [newPk, setNewPk] = useState({ code: '', max_uses: 1, tag: 'member' })
  const [addingPk, setAddingPk] = useState(false)

  const [termsContent, setTermsContent] = useState('')
  const [termsLoading, setTermsLoading] = useState(false)
  const [termsSaving, setTermsSaving] = useState(false)
  const [termsSaved, setTermsSaved] = useState(false)

  const hdr = { 'x-admin-token': token }

  useEffect(() => {
    fetch('/api/admin/status', { headers: hdr })
      .then(r => r.json())
      .then(setStatus)
      .catch(() => {})
  }, [token])

  const loadUsers = async () => {
    setUsersLoading(true)
    try {
      const res = await fetch('/api/admin/users', { headers: hdr })
      const json = await res.json()
      setUsers(json.users || {})
    } catch { setUsers({}) } finally { setUsersLoading(false) }
  }

  const addUser = async () => {
    if (!newUser.username) return
    setAddingUser(true)
    try {
      const res = await fetch('/api/admin/users/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...hdr },
        body: JSON.stringify({ username: newUser.username, access_code: newUser.username, role: newUser.role }),
      })
      const json = await res.json()
      if (json.status === 'ok') { setUsers(json.users); setNewUser({ username: '', role: 'member' }) }
    } catch {} finally { setAddingUser(false) }
  }

  const deleteUser = async (username) => {
    if (!window.confirm(`Delete user "${username}"?`)) return
    try {
      const res = await fetch(`/api/admin/users/${username}`, { method: 'DELETE', headers: hdr })
      const json = await res.json()
      if (json.status === 'ok') setUsers(json.users)
    } catch {}
  }

  const loadLogs = async () => {
    setLogsLoading(true)
    try {
      const res = await fetch('/api/admin/logs', { headers: hdr })
      const json = await res.json()
      setLogs(json.logs || {})
    } catch { setLogs({}) } finally { setLogsLoading(false) }
  }

  const runGrader = async () => {
    setGraderRunning(true); setGraderResult(null)
    try {
      const res = await fetch('/api/admin/run-grader', { method: 'POST', headers: hdr })
      setGraderResult(await res.json())
    } catch (e) { setGraderResult({ status: 'error', message: e.message }) } finally { setGraderRunning(false) }
  }

  const runPropsUpdate = async () => {
    setPropsRunning(true); setPropsResult(null)
    try {
      const res = await fetch('/api/admin/run-props-update', { method: 'POST', headers: hdr })
      setPropsResult(await res.json())
    } catch (e) { setPropsResult({ status: 'error', message: e.message }) } finally { setPropsRunning(false) }
  }

  const syncGithub = async () => {
    setSyncing(true); setSyncResult(null)
    try {
      const res = await fetch('/api/admin/sync-github', { method: 'POST', headers: hdr })
      setSyncResult(await res.json())
    } catch (e) { setSyncResult({ status: 'error', message: e.message }) } finally { setSyncing(false) }
  }

  const loadPasskeys = async () => {
    setPkLoading(true)
    try {
      const res = await fetch('/api/admin/passkeys', { headers: hdr })
      const json = await res.json()
      setPasskeys(json.passkeys || [])
    } catch { setPasskeys([]) } finally { setPkLoading(false) }
  }

  const createPasskey = async () => {
    if (!newPk.code.trim()) return
    setAddingPk(true)
    try {
      const res = await fetch('/api/admin/passkeys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...hdr },
        body: JSON.stringify({ code: newPk.code.trim().toUpperCase(), max_uses: Number(newPk.max_uses), tag: newPk.tag }),
      })
      const json = await res.json()
      if (json.status === 'ok') { setNewPk({ code: '', max_uses: 1, tag: 'member' }); loadPasskeys() }
      else alert(json.message)
    } catch {} finally { setAddingPk(false) }
  }

  const revokePasskey = async (code) => {
    if (!window.confirm(`Revoke passkey "${code}"?`)) return
    try {
      await fetch(`/api/admin/passkeys/${code}`, { method: 'DELETE', headers: hdr })
      loadPasskeys()
    } catch {}
  }

  const loadTerms = async () => {
    setTermsLoading(true)
    try {
      const res = await fetch('/api/terms')
      const json = await res.json()
      setTermsContent(json.content || '')
    } catch {} finally { setTermsLoading(false) }
  }

  const saveTerms = async () => {
    setTermsSaving(true); setTermsSaved(false)
    try {
      const res = await fetch('/api/admin/terms', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...hdr },
        body: JSON.stringify({ content: termsContent }),
      })
      const json = await res.json()
      if (json.status === 'ok') setTermsSaved(true)
    } catch {} finally { setTermsSaving(false) }
  }

  useEffect(() => {
    if (tab === 'passkeys' && passkeys === null) loadPasskeys()
    if (tab === 'terms' && !termsContent && !termsLoading) loadTerms()
  }, [tab])

  const tracker = status?.tracker || {}
  const files = status?.data_files || {}

  const TABS = [
    { id: 'overview', label: '📊 Overview' },
    { id: 'data', label: '📁 Data Files' },
    { id: 'sync', label: '🔄 GitHub Sync' },
    { id: 'tracker', label: '📈 Tracker Stats' },
    { id: 'logs', label: '📋 System Logs' },
    { id: 'users', label: '👥 Users' },
    { id: 'passkeys', label: '🔑 Passkeys' },
    { id: 'terms', label: '📜 T&C' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: '8px 14px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
            border: tab === t.id ? '1px solid var(--ss-teal)' : '1px solid var(--ss-border)',
            background: tab === t.id ? 'rgba(14,165,233,0.15)' : 'transparent',
            color: tab === t.id ? 'var(--ss-teal)' : 'var(--ss-text-muted)',
          }}>{t.label}</button>
        ))}
      </div>

      {tab === 'overview' && status && (
        <>
          {status.odds_key === 'backup' && (
            <div style={{
              background: 'rgba(234,179,8,0.1)', border: '1px solid rgba(234,179,8,0.35)',
              borderRadius: '10px', padding: '12px 18px',
              display: 'flex', alignItems: 'center', gap: '10px',
            }}>
              <span style={{ fontSize: '18px' }}>⚠️</span>
              <div>
                <div style={{ fontWeight: 700, color: '#eab308', fontSize: '13px' }}>Backup Odds API key in use</div>
                <div style={{ fontSize: '12px', color: 'var(--ss-text-muted)', marginTop: '2px' }}>Primary key quota exhausted. Consider rotating your keys before the next scheduled prop run.</div>
              </div>
            </div>
          )}
          {status.odds_key === 'exhausted' && (
            <div style={{
              background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.35)',
              borderRadius: '10px', padding: '12px 18px',
              display: 'flex', alignItems: 'center', gap: '10px',
            }}>
              <span style={{ fontSize: '18px' }}>🔴</span>
              <div>
                <div style={{ fontWeight: 700, color: '#f87171', fontSize: '13px' }}>Both Odds API keys exhausted</div>
                <div style={{ fontSize: '12px', color: 'var(--ss-text-muted)', marginTop: '2px' }}>Props are unavailable until keys are rotated. Update ODDS_API_KEY and ODDS_API_KEY_BACKUP in Secrets.</div>
              </div>
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '12px' }}>
            <StatusCard label="Total Plays" value={tracker.total || 0} color="var(--ss-teal)" />
            <StatusCard label="Pending" value={tracker.pending || 0} color="#f59e0b" />
            <StatusCard label="Wins" value={tracker.wins || 0} color="#84cc16" />
            <StatusCard label="Losses" value={tracker.losses || 0} color="#f87171" />
            <StatusCard label="Win Rate" value={tracker.win_rate || 'N/A'} color="var(--ss-text)" />
          </div>
          <div style={{ background: 'var(--ss-surface)', border: '1px solid var(--ss-border)', borderRadius: '12px', padding: '16px 20px' }}>
            <div style={{ fontWeight: 600, marginBottom: '12px' }}>System Date: {status.date}</div>
            <div style={{ fontSize: '13px', color: 'var(--ss-text-muted)' }}>
              {Object.values(files).filter(f => f.exists).length} / {Object.keys(files).length} data files present
            </div>
            <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--ss-text-muted)' }}>
              Odds API key: <span style={{ fontWeight: 700, color: status.odds_key === 'primary' ? '#84cc16' : status.odds_key === 'backup' ? '#eab308' : status.odds_key === 'exhausted' ? '#f87171' : 'var(--ss-text-muted)' }}>
                {status.odds_key === 'primary' ? '✓ Primary' : status.odds_key === 'backup' ? '⚠ Backup' : status.odds_key === 'exhausted' ? '✗ Exhausted' : 'Not yet run'}
              </span>
            </div>
          </div>
        </>
      )}

      {tab === 'data' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {Object.entries(files).map(([name, info]) => (
            <div key={name} style={{ background: 'var(--ss-surface)', border: `1px solid ${info.exists ? 'var(--ss-border)' : 'rgba(239,68,68,0.3)'}`, borderRadius: '10px', padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: '14px' }}>{name}</div>
                {info.exists && <div style={{ fontSize: '12px', color: 'var(--ss-text-muted)', marginTop: '2px' }}>{info.size_kb} KB · {info.age_hours}h old</div>}
              </div>
              <span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 700, background: info.exists ? 'rgba(132,204,22,0.1)' : 'rgba(239,68,68,0.1)', color: info.exists ? '#84cc16' : '#f87171' }}>
                {info.exists ? '✓ Present' : '✗ Missing'}
              </span>
            </div>
          ))}
        </div>
      )}

      {tab === 'sync' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ background: 'var(--ss-surface)', border: '1px solid var(--ss-border)', borderRadius: '12px', padding: '20px' }}>
            <div style={{ fontWeight: 700, fontSize: '16px', marginBottom: '8px' }}>GitHub Data Sync</div>
            <div style={{ fontSize: '13px', color: 'var(--ss-text-muted)', marginBottom: '16px' }}>
              Pull the latest data files from your GitHub repository. Requires GITHUB_PAT and GITHUB_REPO secrets.
            </div>
            <button onClick={syncGithub} disabled={syncing} className="ss-btn-primary">
              {syncing ? '⏳ Syncing...' : '🔄 Sync All Files from GitHub'}
            </button>
          </div>
          {syncResult && (
            <div style={{ background: 'var(--ss-surface)', border: `1px solid ${syncResult.status === 'ok' ? 'rgba(132,204,22,0.3)' : 'rgba(239,68,68,0.3)'}`, borderRadius: '12px', padding: '16px 20px' }}>
              {syncResult.status === 'ok' ? (
                <>
                  <div style={{ fontWeight: 600, color: '#84cc16', marginBottom: '10px' }}>✅ Sync Complete — {syncResult.updated}/{syncResult.total} files updated</div>
                  {syncResult.results?.map((r, i) => (
                    <div key={i} style={{ fontSize: '13px', display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid var(--ss-border)' }}>
                      <span>{r.file}</span><span style={{ color: r.status === 'updated' ? '#84cc16' : '#f59e0b' }}>{r.status}</span>
                    </div>
                  ))}
                </>
              ) : <div style={{ color: '#f87171' }}>⚠️ {syncResult.message}</div>}
            </div>
          )}
        </div>
      )}

      {tab === 'tracker' && status && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '12px' }}>
            <StatusCard label="Total Plays" value={tracker.total || 0} color="var(--ss-teal)" />
            <StatusCard label="Graded" value={(tracker.wins || 0) + (tracker.losses || 0)} color="var(--ss-text)" />
            <StatusCard label="Wins" value={tracker.wins || 0} color="#84cc16" />
            <StatusCard label="Losses" value={tracker.losses || 0} color="#f87171" />
            <StatusCard label="Win Rate" value={tracker.win_rate || 'N/A'} color={(tracker.wins || 0) > (tracker.losses || 0) ? '#84cc16' : '#f87171'} />
          </div>
          <div style={{ background: 'var(--ss-surface)', border: '1px solid var(--ss-border)', borderRadius: '12px', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <div style={{ fontWeight: 600, marginBottom: '4px' }}>Manual Auto-Grader</div>
              <div style={{ fontSize: '13px', color: 'var(--ss-text-muted)', marginBottom: '10px' }}>Runs grader.py immediately to update pending play results.</div>
              <button onClick={runGrader} disabled={graderRunning} className="ss-btn-primary">{graderRunning ? '⏳ Running...' : '▶️ Run Grader Now'}</button>
              {graderResult && (
                <div style={{ marginTop: '10px', fontSize: '13px', background: graderResult.status === 'ok' ? 'rgba(132,204,22,0.08)' : 'rgba(239,68,68,0.08)', borderRadius: '8px', padding: '10px 14px', color: graderResult.status === 'ok' ? '#84cc16' : '#f87171' }}>
                  {graderResult.status === 'ok' ? `✅ Grader ran (exit ${graderResult.returncode})` : `⚠️ ${graderResult.message}`}
                  {graderResult.stdout && <pre style={{ marginTop: '6px', fontSize: '11px', color: 'var(--ss-text-muted)', whiteSpace: 'pre-wrap' }}>{graderResult.stdout.slice(0, 500)}</pre>}
                </div>
              )}
            </div>
            <div style={{ borderTop: '1px solid var(--ss-border)', paddingTop: '12px' }}>
              <div style={{ fontWeight: 600, marginBottom: '4px' }}>MLB Props Update</div>
              <div style={{ fontSize: '13px', color: 'var(--ss-text-muted)', marginBottom: '10px' }}>
                Fetches today's MLB player props from the Odds API and writes them to the props data file. Normally runs at 6 AM — use this to trigger it on demand.
              </div>
              <button onClick={runPropsUpdate} disabled={propsRunning} className="ss-btn-primary">
                {propsRunning ? '⏳ Fetching props...' : '⚾ Run Props Update Now'}
              </button>
              {propsResult && (() => {
                const isErr = propsResult.status !== 'ok' || (propsResult.returncode != null && propsResult.returncode !== 0)
                return (
                  <div style={{ marginTop: '10px', fontSize: '13px', background: isErr ? 'rgba(239,68,68,0.08)' : 'rgba(132,204,22,0.08)', borderRadius: '8px', padding: '10px 14px', color: isErr ? '#f87171' : '#84cc16' }}>
                    {propsResult.status !== 'ok'
                      ? `⚠️ ${propsResult.message}`
                      : propsResult.returncode !== 0
                        ? `⚠️ Props update exited with code ${propsResult.returncode}`
                        : `✅ Props update ran successfully (exit 0)`}
                    {propsResult.stdout && <pre style={{ marginTop: '6px', fontSize: '11px', color: 'var(--ss-text-muted)', whiteSpace: 'pre-wrap' }}>{propsResult.stdout.slice(0, 800)}</pre>}
                  </div>
                )
              })()}
            </div>
          </div>
        </div>
      )}

      {tab === 'logs' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <button onClick={loadLogs} disabled={logsLoading} className="ss-btn-primary" style={{ alignSelf: 'flex-start' }}>
            {logsLoading ? '⏳ Loading...' : '🔄 Load Log Files'}
          </button>
          {logs && Object.entries(logs).map(([file, lines]) => (
            <div key={file} style={{ background: 'var(--ss-surface)', border: '1px solid var(--ss-border)', borderRadius: '10px', overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--ss-border)', fontWeight: 600, fontSize: '13px', display: 'flex', justifyContent: 'space-between' }}>
                <span>{file}</span><span style={{ color: 'var(--ss-text-muted)', fontSize: '12px' }}>{lines.length} lines</span>
              </div>
              {lines.length === 0 ? (
                <div style={{ padding: '12px 16px', fontSize: '12px', color: 'var(--ss-text-muted)' }}>No log entries</div>
              ) : (
                <pre style={{ margin: 0, padding: '12px 16px', fontSize: '11px', color: 'var(--ss-text-muted)', overflowX: 'auto', maxHeight: '240px', overflowY: 'auto', background: 'var(--ss-bg)' }}>
                  {lines.join('\n')}
                </pre>
              )}
            </div>
          ))}
          {!logs && <div style={{ color: 'var(--ss-text-muted)', fontSize: '13px' }}>Click "Load Log Files" to view scheduler and grader logs.</div>}
        </div>
      )}

      {tab === 'users' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <button onClick={loadUsers} disabled={usersLoading} className="ss-btn-primary" style={{ alignSelf: 'flex-start' }}>
            {usersLoading ? '⏳ Loading...' : '🔄 Load Users'}
          </button>
          <div style={{ background: 'var(--ss-surface)', border: '1px solid var(--ss-border)', borderRadius: '12px', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ fontWeight: 600, marginBottom: '2px' }}>➕ Add User</div>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <input placeholder="Username" value={newUser.username} onChange={e => setNewUser(u => ({ ...u, username: e.target.value }))}
                style={{ flex: 1, minWidth: '160px', background: 'var(--ss-bg)', border: '1px solid var(--ss-border)', color: 'var(--ss-text)', borderRadius: '8px', padding: '7px 10px', fontSize: '13px' }} />
              <select value={newUser.role} onChange={e => setNewUser(u => ({ ...u, role: e.target.value }))}
                style={{ background: 'var(--ss-bg)', border: '1px solid var(--ss-border)', color: 'var(--ss-text)', borderRadius: '8px', padding: '7px 12px', fontSize: '13px' }}>
                <option value="member">Member</option>
                <option value="dfs">DFS</option>
                <option value="admin">Admin</option>
              </select>
              <button onClick={addUser} disabled={addingUser || !newUser.username} className="ss-btn-primary">
                {addingUser ? '⏳...' : 'Add'}
              </button>
            </div>
            <div style={{ fontSize: '12px', color: 'var(--ss-text-muted)' }}>Note: added users must change their password by signing in with username as password.</div>
          </div>
          {users !== null && (
            Object.keys(users).length === 0 ? (
              <div style={{ color: 'var(--ss-text-muted)', fontSize: '13px', padding: '20px' }}>No users.</div>
            ) : (
              <div style={{ background: 'var(--ss-surface)', border: '1px solid var(--ss-border)', borderRadius: '12px', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--ss-border)' }}>
                      {['Username', 'Role', ''].map(h => (
                        <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: '11px', fontWeight: 700, color: 'var(--ss-text-muted)', textTransform: 'uppercase' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(users).map(([username, info], i) => (
                      <tr key={username} style={{ borderBottom: '1px solid var(--ss-border)', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}>
                        <td style={{ padding: '10px 16px', fontWeight: 600 }}>{username}</td>
                        <td style={{ padding: '10px 16px' }}>
                          <span style={{ padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: 700, background: info.role === 'admin' ? 'rgba(239,68,68,0.1)' : info.role === 'dfs' ? 'rgba(132,204,22,0.1)' : 'rgba(14,165,233,0.1)', color: info.role === 'admin' ? '#f87171' : info.role === 'dfs' ? '#84cc16' : 'var(--ss-teal)' }}>
                            {info.role || 'member'}
                          </span>
                        </td>
                        <td style={{ padding: '10px 16px' }}>
                          <button onClick={() => deleteUser(username)} style={{ padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 700, cursor: 'pointer', border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.1)', color: '#f87171' }}>
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}
        </div>
      )}

      {tab === 'passkeys' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Create passkey */}
          <div style={{ background: 'var(--ss-surface)', border: '1px solid var(--ss-border)', borderRadius: '12px', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ fontWeight: 600 }}>🔑 Create New Invite Code</div>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <input
                placeholder="Code (e.g. SLAYER23)"
                value={newPk.code}
                onChange={e => setNewPk(p => ({ ...p, code: e.target.value.toUpperCase() }))}
                style={{ flex: 2, minWidth: '140px', fontFamily: 'monospace', letterSpacing: '0.1em', background: 'var(--ss-bg)', border: '1px solid var(--ss-border)', color: 'var(--ss-text)', borderRadius: '8px', padding: '7px 10px', fontSize: '13px' }}
              />
              <input
                type="number" min="1" max="100"
                placeholder="Uses"
                value={newPk.max_uses}
                onChange={e => setNewPk(p => ({ ...p, max_uses: Number(e.target.value) }))}
                style={{ width: '80px', background: 'var(--ss-bg)', border: '1px solid var(--ss-border)', color: 'var(--ss-text)', borderRadius: '8px', padding: '7px 10px', fontSize: '13px' }}
              />
              <select value={newPk.tag} onChange={e => setNewPk(p => ({ ...p, tag: e.target.value }))}
                style={{ background: 'var(--ss-bg)', border: '1px solid var(--ss-border)', color: 'var(--ss-text)', borderRadius: '8px', padding: '7px 12px', fontSize: '13px' }}>
                <option value="member">Member</option>
                <option value="dfs">DFS</option>
              </select>
              <button onClick={createPasskey} disabled={addingPk || !newPk.code.trim()} className="ss-btn-primary">
                {addingPk ? '⏳...' : 'Create'}
              </button>
            </div>
            <div style={{ fontSize: '12px', color: 'var(--ss-text-muted)' }}>
              The tag determines the role assigned when someone signs up with this code.
            </div>
          </div>

          {/* Passkey list */}
          <button onClick={loadPasskeys} disabled={pkLoading} className="ss-btn-primary" style={{ alignSelf: 'flex-start' }}>
            {pkLoading ? '⏳ Loading...' : '🔄 Refresh Passkeys'}
          </button>

          {passkeys !== null && (
            passkeys.length === 0 ? (
              <div style={{ color: 'var(--ss-text-muted)', fontSize: '13px', padding: '20px' }}>No passkeys yet. Create one above.</div>
            ) : (
              <div style={{ background: 'var(--ss-surface)', border: '1px solid var(--ss-border)', borderRadius: '12px', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--ss-border)' }}>
                      {['Code', 'Tag/Role', 'Uses Left', 'Max Uses', 'Created', 'Used By', ''].map(h => (
                        <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: '11px', fontWeight: 700, color: 'var(--ss-text-muted)', textTransform: 'uppercase' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {passkeys.map((pk, i) => (
                      <tr key={pk.code} style={{ borderBottom: '1px solid var(--ss-border)', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}>
                        <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontWeight: 700, color: pk.uses_remaining > 0 ? 'var(--ss-teal)' : 'var(--ss-text-muted)' }}>{pk.code}</td>
                        <td style={{ padding: '10px 14px' }}>
                          <span style={{ padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: 700, background: pk.tag === 'dfs' ? 'rgba(132,204,22,0.1)' : 'rgba(14,165,233,0.1)', color: pk.tag === 'dfs' ? '#84cc16' : 'var(--ss-teal)' }}>
                            {pk.tag || 'member'}
                          </span>
                        </td>
                        <td style={{ padding: '10px 14px', color: pk.uses_remaining > 0 ? '#84cc16' : '#f87171', fontWeight: 700 }}>{pk.uses_remaining}</td>
                        <td style={{ padding: '10px 14px', color: 'var(--ss-text-muted)' }}>{pk.max_uses}</td>
                        <td style={{ padding: '10px 14px', color: 'var(--ss-text-muted)', fontSize: '12px' }}>{pk.created}</td>
                        <td style={{ padding: '10px 14px', color: 'var(--ss-text-muted)', fontSize: '12px' }}>{(pk.used_by || []).join(', ') || '—'}</td>
                        <td style={{ padding: '10px 14px' }}>
                          <button onClick={() => revokePasskey(pk.code)} style={{ padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 700, cursor: 'pointer', border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.1)', color: '#f87171' }}>
                            Revoke
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}
        </div>
      )}

      {tab === 'terms' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ background: 'var(--ss-surface)', border: '1px solid var(--ss-border)', borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontWeight: 700, fontSize: '16px' }}>📜 Terms &amp; Conditions Editor</div>
              <a href="/terms" target="_blank" rel="noreferrer" style={{ color: 'var(--ss-teal)', fontSize: '13px', fontWeight: 600 }}>Preview →</a>
            </div>
            <div style={{ fontSize: '13px', color: 'var(--ss-text-muted)' }}>
              This text is shown to users when they create an account. Edit below and save.
            </div>
            {termsLoading ? (
              <div style={{ color: 'var(--ss-text-muted)' }}>Loading...</div>
            ) : (
              <textarea
                value={termsContent}
                onChange={e => { setTermsContent(e.target.value); setTermsSaved(false) }}
                rows={20}
                style={{
                  background: 'var(--ss-bg)', border: '1px solid var(--ss-border)', color: 'var(--ss-text)',
                  borderRadius: '10px', padding: '14px', fontSize: '13px', fontFamily: 'inherit',
                  lineHeight: '1.7', resize: 'vertical', outline: 'none',
                }}
              />
            )}
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <button onClick={saveTerms} disabled={termsSaving} className="ss-btn-primary" style={{ alignSelf: 'flex-start' }}>
                {termsSaving ? '⏳ Saving...' : '💾 Save Terms'}
              </button>
              {termsSaved && <span style={{ color: '#84cc16', fontSize: '13px', fontWeight: 600 }}>✅ Saved!</span>}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function AdminHub() {
  const { auth } = useAuth()
  const [storedToken, setStoredToken] = useAdminToken()
  const [verified, setVerified] = useState(false)
  const [activeToken, setActiveToken] = useState('')

  const handleSuccess = (t) => {
    setStoredToken(t)
    setActiveToken(t)
    setVerified(true)
  }

  useEffect(() => {
    if (auth?.role === 'admin' && auth?.token) {
      setActiveToken(auth.token)
      setVerified(true)
      return
    }
    const t = storedToken
    if (t) {
      fetch('/api/admin/status', { headers: { 'x-admin-token': t } })
        .then(r => r.json())
        .then(json => {
          if (json.status === 'ok') {
            setActiveToken(t)
            setVerified(true)
          }
        })
        .catch(() => {})
    }
  }, [auth, storedToken])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '960px', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <span style={{ fontSize: '40px' }}>⚙️</span>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 800, margin: 0 }}>Admin Panel</h1>
          <p style={{ fontSize: '13px', color: 'var(--ss-text-muted)', marginTop: '2px', marginBottom: 0 }}>
            Data files · GitHub sync · Users · Passkeys · Terms
          </p>
        </div>
      </div>

      {verified ? (
        <AdminPanel token={activeToken} />
      ) : (
        <div style={{ background: 'var(--ss-surface)', border: '1px solid var(--ss-border)', borderRadius: '14px', padding: '40px' }}>
          <AdminLogin onSuccess={handleSuccess} />
        </div>
      )}
    </div>
  )
}
