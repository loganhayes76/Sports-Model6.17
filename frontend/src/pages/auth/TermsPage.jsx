import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'

export default function TermsPage() {
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/terms')
      .then(r => r.json())
      .then(d => { setContent(d.content || ''); setLoading(false) })
      .catch(() => { setContent('Unable to load Terms & Conditions.'); setLoading(false) })
  }, [])

  return (
    <div style={{ maxWidth: '720px', margin: '0 auto', padding: '40px 24px' }}>
      <Link
        to="/"
        style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--ss-teal)', fontSize: '13px', fontWeight: 600, marginBottom: '24px' }}
      >
        ← Back
      </Link>
      <h1 style={{ fontSize: '28px', fontWeight: 800, marginBottom: '24px' }}>Terms &amp; Conditions</h1>
      {loading ? (
        <div style={{ color: 'var(--ss-text-muted)' }}>Loading...</div>
      ) : (
        <pre style={{
          background: 'var(--ss-surface)',
          border: '1px solid var(--ss-border)',
          borderRadius: '12px',
          padding: '24px',
          fontFamily: 'inherit',
          fontSize: '14px',
          lineHeight: '1.75',
          color: 'var(--ss-text)',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}>
          {content}
        </pre>
      )}
    </div>
  )
}
