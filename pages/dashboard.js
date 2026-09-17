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
  // Salesforce Date fields are date-only; render in UTC so they don't shift a day in local time.
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

function daysUntil(dateStr) {
  if (!dateStr) return null;
  // Compare calendar dates only (no time-of-day), so the count matches the displayed date.
  const d = new Date(dateStr);
  const now = new Date();
  const target = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((target - today) / 86400000);
}

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Month + year only (e.g. "Nov 2026") for the partner-facing target close date.
function fmtMonthYear(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });
}

function fmtAmount(n) {
  if (n === null || n === undefined || n === '') return '—';
  return `$${Math.round(Number(n)).toLocaleString('en-US')}`;
}

// Partner-friendly pipeline: show a stage's position so ambassadors don't need
// to know our internal stage names (e.g. "Discovery (2/5)"). Terminal stages
// (Closed Won/Lost, Disqualified, Churned) show their label without a step.
const STAGE_SEQUENCE = ['Stage 0', 'Discovery', 'Use Case', 'POC', 'Negotiate'];
function stageLabel(stage) {
  const i = STAGE_SEQUENCE.indexOf(stage);
  return i >= 0 ? `${stage} (${i + 1}/${STAGE_SEQUENCE.length})` : (stage || '—');
}

function ownershipOf(reg) {
  if (!LOCKING_STATUSES.has(reg.Status__c)) return 'Not Held';
  return reg.Intro_Meeting_Date__c && reg.Intro_Meeting_Date__c <= todayISO() ? 'Account Registered' : 'Account Held';
}

function applyFilters(regs, filterStatus, filterHeld, sortDate) {
  return regs
    .filter(r => filterStatus === 'All' || r.Status__c === filterStatus)
    .filter(r => filterHeld === 'All' || ownershipOf(r) === filterHeld)
    .sort((a, b) => {
      const da = a.Approval_Date__c ? new Date(a.Approval_Date__c) : new Date(0);
      const db = b.Approval_Date__c ? new Date(b.Approval_Date__c) : new Date(0);
      return sortDate === 'asc' ? da - db : db - da;
    });
}

function DateItem({ label, value, note }) {
  const days = daysUntil(value);
  let cls = '';
  if (days !== null && value) {
    if (days < 0) cls = 'expired';
    else if (days < 14) cls = 'expiring';
  }
  return (
    <div className="date-item">
      <div className="date-label">{label}</div>
      {note && <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--brand-purple)', marginBottom: 2 }}>{note}</div>}
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
  const isRegistered = isLocking && reg.Intro_Meeting_Date__c && reg.Intro_Meeting_Date__c <= todayISO();
  const ownership = !isLocking ? null : (isRegistered ? 'Account Registered' : 'Account Held');
  // Senior Advisors to the CEO Office don't have an intro window, so hide its expiry.
  const isSeniorAdvisor = reg['Ambassador__r']?.Ambassador_Tier__c === 'Senior Advisor to the CEO Office';
  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h2>{reg['Account__r']?.Name || '—'}</h2>
          <div className="card-meta">
            {reg.Tier__c} &middot; Submitted {fmt(reg.CreatedDate)}
            {ownership && <span style={{ marginLeft: 8, color: isRegistered ? 'var(--brand-blue)' : 'var(--ok-fg)', fontWeight: 600 }}>· {ownership}</span>}
            {reg.Intro_Window_Extended__c && <span style={{ marginLeft: 8, color: 'var(--brand-purple)', fontWeight: 600 }}>· Intro window extended +30d</span>}
          </div>
          {reg.Referred_Lead_Title__c && (
            <div style={{ fontSize: 13, color: 'var(--ink-2)', marginTop: 2 }}>
              Referred lead title: <strong>{reg.Referred_Lead_Title__c}</strong>
            </div>
          )}
        </div>
        <span className={`badge badge-${statusClass}`}>{reg.Status__c}</span>
      </div>

      <div className="dates-grid">
        <DateItem label="Approval Date"           value={reg.Approval_Date__c} />
        <DateItem label="Intro Meeting Date"      value={reg.Intro_Meeting_Date__c} />
        {!isSeniorAdvisor && (
          <DateItem label="Intro Window Expiry"   value={reg.Intro_Window_Expiry__c} note={reg.Intro_Window_Extended__c ? 'Extended +30d' : null} />
        )}
        <DateItem label="Close Window (6mo)"      value={reg.Close_Window_Expiry__c} />
        <DateItem label="Registration Lock (6mo)" value={reg.Registration_Expiry__c} />
        <DateItem label="Upsell Window (12mo)"    value={reg.Upsell_Eligibility_Expiry__c} />
      </div>

      {reg.Notes__c && (
        <div style={{ marginTop: 14, fontSize: 13, color: 'var(--ink-3)' }}>
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
      <td><span className={`badge badge-${stageClass(opp.StageName)}`}>{stageLabel(opp.StageName)}</span></td>
      <td>{fmtAmount(opp.Amount)}</td>
      <td>{fmtMonthYear(opp.CloseDate)}</td>
    </tr>
  );
}

const selectStyle = { padding: '6px 10px', borderRadius: 6, border: '1px solid var(--line)', fontSize: 13, fontFamily: 'inherit', background: '#fff', cursor: 'pointer' };
const labelStyle = { fontSize: 11, fontWeight: 600, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.05em' };

function FilterBar({ filterStatus, setFilterStatus, filterHeld, setFilterHeld, sortDate, setSortDate }) {
  return (
    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20, alignItems: 'center' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <label style={labelStyle}>Status</label>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={selectStyle}>
          <option value="All">All Statuses</option>
          {Object.keys(STATUS_CLASS).map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <label style={labelStyle}>Ownership</label>
        <select value={filterHeld} onChange={e => setFilterHeld(e.target.value)} style={selectStyle}>
          <option value="All">All Ownership</option>
          <option value="Account Held">Account Held</option>
          <option value="Account Registered">Account Registered</option>
          <option value="Not Held">Not Held</option>
        </select>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <label style={labelStyle}>Approval Date</label>
        <select value={sortDate} onChange={e => setSortDate(e.target.value)} style={selectStyle}>
          <option value="desc">Newest First</option>
          <option value="asc">Oldest First</option>
        </select>
      </div>
    </div>
  );
}

// Ambassador's own view: their registration cards + referred opportunities.
function AmbassadorView({ regs, opps }) {
  const [filterStatus, setFilterStatus] = useState('All');
  const [filterHeld, setFilterHeld] = useState('All');
  const [sortDate, setSortDate] = useState('desc');

  const filtered = applyFilters(regs, filterStatus, filterHeld, sortDate);

  return (
    <>
      <div className="page-header">
        <h1>My Registrations</h1>
      </div>

      {regs.length > 0 && (
        <FilterBar
          filterStatus={filterStatus} setFilterStatus={setFilterStatus}
          filterHeld={filterHeld} setFilterHeld={setFilterHeld}
          sortDate={sortDate} setSortDate={setSortDate}
        />
      )}

      {regs.length === 0 ? (
        <div className="empty">
          <h2>No registrations yet</h2>
          <p>Submit an account registration and it will appear here once approved.</p>
          <Link href="/register" className="btn btn-primary">Submit your first registration</Link>
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty">
          <h2>No results</h2>
          <p>No registrations match the current filters.</p>
        </div>
      ) : (
        filtered.map(reg => <RegistrationCard key={reg.Id} reg={reg} />)
      )}

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
                  <th>Estimated Amount</th>
                  <th>Target Close Date</th>
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
  );
}

function stageClass(stage) {
  if (stage === 'Closed Won') return 'converted';
  if (stage === 'Closed Lost' || stage === 'Disqualified' || stage === 'Churned') return 'rejected';
  return 'intro-made';
}

// Ambassador's opportunities (via OpportunityContactRole) in the admin view.
function AdminOpportunities({ opps }) {
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 8px' }}>
        Opportunities ({opps.length})
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Account</th>
              <th>Opportunity</th>
              <th>Stage</th>
              <th>Estimated Amount</th>
              <th>Next Steps Date</th>
              <th>Target Close Date</th>
            </tr>
          </thead>
          <tbody>
            {opps.map(o => (
              <tr key={o.rowId}>
                <td>{o.AccountName || '—'}</td>
                <td>{o.Name || '—'}</td>
                <td><span className={`badge badge-${stageClass(o.StageName)}`}>{stageLabel(o.StageName)}</span></td>
                <td>{fmtAmount(o.Amount)}</td>
                <td>{fmt(o.Next_Steps_Date__c)}</td>
                <td>{fmtMonthYear(o.CloseDate)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Admin view: every registration and every ambassador opportunity, grouped by
// ambassador, with a searchable ambassador filter that narrows to one person.
function AdminView({ regs, opps }) {
  const [filterStatus, setFilterStatus] = useState('All');
  const [filterHeld, setFilterHeld] = useState('All');
  const [sortDate, setSortDate] = useState('desc');
  const [ambSearch, setAmbSearch] = useState('');
  const [selectedAmb, setSelectedAmb] = useState('All');

  // Opportunities grouped by ambassador id.
  const oppsByAmb = new Map();
  for (const o of opps) {
    const id = o.ambassadorId || 'unassigned';
    if (!oppsByAmb.has(id)) oppsByAmb.set(id, []);
    oppsByAmb.get(id).push(o);
  }

  // Distinct ambassadors from registrations and opportunities, sorted by name.
  const ambassadors = [];
  const ambIndex = new Map();
  function noteAmbassador(id, name, email) {
    if (ambIndex.has(id)) {
      if (email && !ambassadors[ambIndex.get(id)].email) ambassadors[ambIndex.get(id)].email = email;
      return;
    }
    ambIndex.set(id, ambassadors.length);
    ambassadors.push({ id, name: name || 'Unassigned', email: email || '' });
  }
  for (const r of regs) noteAmbassador(r.Ambassador__c || 'unassigned', r['Ambassador__r']?.Name, r['Ambassador__r']?.Email);
  for (const o of opps) noteAmbassador(o.ambassadorId || 'unassigned', o.ambassadorName, '');
  ambassadors.sort((a, b) => a.name.localeCompare(b.name));

  const searchLc = ambSearch.trim().toLowerCase();
  const searchable = searchLc
    ? ambassadors.filter(a => a.name.toLowerCase().includes(searchLc) || a.email.toLowerCase().includes(searchLc))
    : ambassadors;

  const filteredRegs = applyFilters(regs, filterStatus, filterHeld, sortDate);

  // Build one group per ambassador (respecting the selection), carrying both
  // their filtered registrations and their opportunities.
  const groups = [];
  const groupIndex = new Map();
  function ensureGroup(id, name, email) {
    if (groupIndex.has(id)) return groups[groupIndex.get(id)];
    groupIndex.set(id, groups.length);
    const g = { id, name: name || 'Unassigned', email: email || '', regs: [], opps: [] };
    groups.push(g);
    return g;
  }
  for (const r of filteredRegs) {
    const id = r.Ambassador__c || 'unassigned';
    if (selectedAmb !== 'All' && id !== selectedAmb) continue;
    ensureGroup(id, r['Ambassador__r']?.Name, r['Ambassador__r']?.Email).regs.push(r);
  }
  for (const [id, list] of oppsByAmb) {
    if (selectedAmb !== 'All' && id !== selectedAmb) continue;
    ensureGroup(id, list[0]?.ambassadorName).opps = list;
  }
  // Drop groups the registration filters emptied that also have no opportunities.
  const visibleGroups = groups.filter(g => g.regs.length > 0 || g.opps.length > 0);
  visibleGroups.sort((a, b) => a.name.localeCompare(b.name));

  const totalAmbassadors = ambassadors.length;

  return (
    <>
      <div className="page-header">
        <h1>All Registrations</h1>
        <p style={{ color: 'var(--ink-3)', fontSize: 14, margin: '4px 0 0' }}>
          Admin view · {regs.length} registration{regs.length === 1 ? '' : 's'} · {opps.length} opportunit{opps.length === 1 ? 'y' : 'ies'} · {totalAmbassadors} ambassador{totalAmbassadors === 1 ? '' : 's'}
        </p>
      </div>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20, alignItems: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 260 }}>
          <label style={labelStyle}>Ambassador</label>
          <input
            type="text"
            value={ambSearch}
            onChange={e => setAmbSearch(e.target.value)}
            placeholder="Search ambassadors…"
            autoComplete="off"
            style={{ ...selectStyle, cursor: 'text', marginBottom: 6 }}
          />
          <select value={selectedAmb} onChange={e => setSelectedAmb(e.target.value)} style={selectStyle}>
            <option value="All">All ambassadors ({totalAmbassadors})</option>
            {searchable.map(a => (
              <option key={a.id} value={a.id}>
                {a.name}{a.email ? ` — ${a.email}` : ''}
              </option>
            ))}
          </select>
        </div>
        <FilterBar
          filterStatus={filterStatus} setFilterStatus={setFilterStatus}
          filterHeld={filterHeld} setFilterHeld={setFilterHeld}
          sortDate={sortDate} setSortDate={setSortDate}
        />
      </div>

      {visibleGroups.length === 0 ? (
        <div className="empty">
          <h2>No results</h2>
          <p>No registrations or opportunities match the current filters.</p>
        </div>
      ) : (
        visibleGroups.map(g => (
          <div key={g.id} style={{ marginBottom: 32 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, padding: '10px 0 12px', borderBottom: '2px solid var(--line)', marginBottom: 16 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>{g.name}</h2>
              {g.email && <span style={{ fontSize: 13, color: 'var(--ink-3)' }}>{g.email}</span>}
              <span style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 600, color: 'var(--ink-3)' }}>
                {g.regs.length} registration{g.regs.length === 1 ? '' : 's'} · {g.opps.length} opportunit{g.opps.length === 1 ? 'y' : 'ies'}
              </span>
            </div>
            {g.regs.map(reg => <RegistrationCard key={reg.Id} reg={reg} />)}
            {g.opps.length > 0 && <AdminOpportunities opps={g.opps} />}
          </div>
        ))
      )}
    </>
  );
}

export default function Dashboard() {
  const [me, setMe] = useState(null);
  const [regs, setRegs] = useState([]);
  const [opps, setOpps] = useState([]);
  const [adminRegs, setAdminRegs] = useState([]);
  const [adminOpps, setAdminOpps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const router = useRouter();

  useEffect(() => {
    (async () => {
      try {
        const meRes = await fetch('/api/me');
        if (meRes.status === 401) { router.push('/'); return; }
        const meData = await meRes.json();
        setMe(meData);

        if (meData.isAdmin) {
          const [regsRes, oppsRes] = await Promise.all([
            fetch('/api/admin/registrations'),
            fetch('/api/admin/opportunities'),
          ]);
          if (regsRes.status === 401 || oppsRes.status === 401) { router.push('/'); return; }
          setAdminRegs(regsRes.ok ? await regsRes.json() : []);
          setAdminOpps(oppsRes.ok ? await oppsRes.json() : []);
        } else {
          const [regsData, oppsData] = await Promise.all([
            fetch('/api/registrations').then(r => { if (r.status === 401) { router.push('/'); return null; } return r.json(); }),
            fetch('/api/opportunities').then(r => r.ok ? r.json() : []),
          ]);
          if (regsData) setRegs(regsData);
          if (oppsData) setOpps(oppsData);
        }
        setLoading(false);
      } catch {
        setError('Failed to load data.');
        setLoading(false);
      }
    })();
  }, []);

  async function logout() {
    await fetch('/api/auth', { method: 'DELETE' });
    router.push('/');
  }

  return (
    <>
      <nav className="nav">
        <img src="/logo-on-dark.svg" alt="Unframe" className="nav-logo" />
        <span className="nav-user">
          {me && !me.isAdmin && <Link href="/register" className="btn btn-primary btn-sm">+ New Registration</Link>}
          <button className="btn btn-secondary btn-sm" onClick={logout}>Sign out</button>
        </span>
      </nav>

      <div className="container">
        {error && <div className="error-msg" style={{ marginTop: 24 }}>{error}</div>}
        {loading && <p style={{ color: 'var(--ink-3)', fontSize: 14, marginTop: 32 }}>Loading…</p>}

        {!loading && me && (
          me.isAdmin
            ? <AdminView regs={adminRegs} opps={adminOpps} />
            : <AmbassadorView regs={regs} opps={opps} />
        )}
      </div>
    </>
  );
}
