import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';

const STATUS_CLASS = {
  'Pending Approval': 'pending',
  'Approved':         'approved',
  'Intro Made':       'intro-made',
  'Active':           'active',
  'Converted':        'converted',
  'Expired':          'expired',
  'Released':         'released',
  'Rejected':         'rejected',
};

const LOCKING_STATUSES = new Set(['Approved', 'Intro Made', 'Active']);

function fmt(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function daysUntil(dateStr) {
  if (!dateStr) return null;
  return Math.ceil((new Date(dateStr) - new Date()) / 86400000);
}

function DateItem({ label, value }) {
  const days = daysUntil(value);
  let cls = '';
  if (days !== null && value) {
    if (days < 0) cls = 'expired';
    else if (days < 14) cls = 'expiring';
  }
  return (
    <div className="date-item">
      <div className="date-label">{label}</div>
      <div className={`date-value ${cls}`}>
        {fmt(value)}
        {days !== null && value && days >= 0 && days < 30 && (
          <span style={{ fontSize: 11, marginLeft: 6 }}>({days}d left)</span>
        )}
      </div>
    </div>
  );
}

function RegistrationCard({ reg }) {
  const statusClass = STATUS_CLASS[reg.Status__c] || 'pending';
  const isLocking = LOCKING_STATUSES.has(reg.Status__c);
  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h2>{reg['Account__r']?.Name || '—'}</h2>
          <div className="card-meta">
            {reg.Tier__c} &middot; Submitted {fmt(reg.CreatedDate)}
            {isLocking && <span style={{ marginLeft: 8, color: '#006644', fontWeight: 600 }}>· Account held</span>}
          </div>
          {reg['Lead__r']?.Name && (
            <div style={{ fontSize: 13, color: '#344563', marginTop: 2 }}>
              Referred lead: <strong>{reg['Lead__r'].Name}</strong>
            </div>
          )}
        </div>
        <span className={`badge badge-${statusClass}`}>{reg.Status__c}</span>
      </div>

      <div className="dates-grid">
        <DateItem label="Approval Date"           value={reg.Approval_Date__c} />
        <DateItem label="Introduction Date"       value={reg.Introduction_Date__c} />
        <DateItem label="Intro Meeting Date"      value={reg.Intro_Meeting_Date__c} />
        <DateItem label="Intro Window Expiry"     value={reg.Intro_Window_Expiry__c} />
        <DateItem label="Close Window (6mo)"      value={reg.Close_Window_Expiry__c} />
        <DateItem label="Registration Lock (6mo)" value={reg.Registration_Expiry__c} />
        <DateItem label="Upsell Window (12mo)"    value={reg.Upsell_Eligibility_Expiry__c} />
      </div>

      {reg.Notes__c && (
        <div style={{ marginTop: 14, fontSize: 13, color: '#6b778c' }}>
          <strong>Notes:</strong> {reg.Notes__c}
        </div>
      )}
    </div>
  );
}

function OpportunityRow({ opp }) {
  return (
    <tr>
      <td>{opp['Account']?.Name || '—'}</td>
      <td>{opp.Name}</td>
      <td><span className={`badge badge-${opp.StageName === 'Closed Won' ? 'converted' : opp.StageName === 'Closed Lost' ? 'rejected' : 'intro-made'}`}>{opp.StageName}</span></td>
      <td>{fmt(opp.CloseDate)}</td>
    </tr>
  );
}

export default function Dashboard() {
  const [regs, setRegs] = useState([]);
  const [opps, setOpps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterStatus, setFilterStatus] = useState('All');
  const [filterHeld, setFilterHeld] = useState('All');
  const [sortDate, setSortDate] = useState('desc');
  const router = useRouter();

  useEffect(() => {
    Promise.all([
      fetch('/api/registrations').then(r => { if (r.status === 401) { router.push('/'); return null; } return r.json(); }),
      fetch('/api/opportunities').then(r => r.ok ? r.json() : []),
    ]).then(([regsData, oppsData]) => {
      if (regsData) setRegs(regsData);
      if (oppsData) setOpps(oppsData);
      setLoading(false);
    }).catch(() => { setError('Failed to load data.'); setLoading(false); });
  }, []);

  async function logout() {
    await fetch('/api/auth', { method: 'DELETE' });
    router.push('/');
  }

  return (
    <>
      <nav className="nav">
        <img src="/logo-white.svg" alt="Unframe" className="nav-logo" />
        <span className="nav-user">
          <Link href="/register" className="btn btn-primary btn-sm">+ New Registration</Link>
          <button className="btn btn-secondary btn-sm" onClick={logout}>Sign out</button>
        </span>
      </nav>

      <div className="container">
        {error && <div className="error-msg" style={{ marginTop: 24 }}>{error}</div>}
        {loading && <p style={{ color: '#6b778c', fontSize: 14, marginTop: 32 }}>Loading…</p>}

        {!loading && (
          <>
            <div className="page-header">
              <h1>My Registrations</h1>
            </div>

            {regs.length > 0 && (
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20, alignItems: 'center' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <label style={{ fontSize: 11, fontWeight: 600, color: '#6b778c', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Status</label>
                  <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #dfe1e6', fontSize: 13, background: '#fff', cursor: 'pointer' }}>
                    <option value="All">All Statuses</option>
                    {Object.keys(STATUS_CLASS).map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <label style={{ fontSize: 11, fontWeight: 600, color: '#6b778c', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Account Held</label>
                  <select value={filterHeld} onChange={e => setFilterHeld(e.target.value)} style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #dfe1e6', fontSize: 13, background: '#fff', cursor: 'pointer' }}>
                    <option value="All">All Accounts</option>
                    <option value="held">Account Held</option>
                    <option value="not-held">Not Held</option>
                  </select>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <label style={{ fontSize: 11, fontWeight: 600, color: '#6b778c', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Approval Date</label>
                  <select value={sortDate} onChange={e => setSortDate(e.target.value)} style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #dfe1e6', fontSize: 13, background: '#fff', cursor: 'pointer' }}>
                    <option value="desc">Newest First</option>
                    <option value="asc">Oldest First</option>
                  </select>
                </div>
              </div>
            )}

            {(() => {
              const filtered = regs
                .filter(r => filterStatus === 'All' || r.Status__c === filterStatus)
                .filter(r => {
                  if (filterHeld === 'All') return true;
                  const held = LOCKING_STATUSES.has(r.Status__c);
                  return filterHeld === 'held' ? held : !held;
                })
                .sort((a, b) => {
                  const da = a.Approval_Date__c ? new Date(a.Approval_Date__c) : new Date(0);
                  const db = b.Approval_Date__c ? new Date(b.Approval_Date__c) : new Date(0);
                  return sortDate === 'asc' ? da - db : db - da;
                });

              if (regs.length === 0) return (
                <div className="empty">
                  <h2>No registrations yet</h2>
                  <p>Submit an account registration and it will appear here once approved.</p>
                  <Link href="/register" className="btn btn-primary">Submit your first registration</Link>
                </div>
              );

              if (filtered.length === 0) return (
                <div className="empty">
                  <h2>No results</h2>
                  <p>No registrations match the current filters.</p>
                </div>
              );

              return filtered.map(reg => <RegistrationCard key={reg.Id} reg={reg} />);
            })()}

            {opps.length > 0 && (
              <>
                <div className="page-header" style={{ marginTop: 16 }}>
                  <h1>My Referred Opportunities</h1>
                </div>
                <div className="table-wrap" style={{ marginBottom: 40 }}>
                  <table>
                    <thead>
                      <tr>
                        <th>Account</th>
                        <th>Opportunity</th>
                        <th>Stage</th>
                        <th>Close Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {opps.map(o => <OpportunityRow key={o.Id} opp={o} />)}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </>
  );
}
