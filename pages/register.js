import { useState, useRef } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';

export default function Register() {
  const [accountQuery, setAccountQuery] = useState('');
  const [accountSuggestions, setAccountSuggestions] = useState([]);
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [isNewCompany, setIsNewCompany] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState('');
  const [newCompanyWebsite, setNewCompanyWebsite] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const searchTimeout = useRef(null);
  const router = useRouter();

  function handleAccountInput(e) {
    const val = e.target.value;
    setAccountQuery(val);
    setSelectedAccount(null);
    setIsNewCompany(false);

    clearTimeout(searchTimeout.current);
    if (val.length < 2) { setAccountSuggestions([]); return; }

    searchTimeout.current = setTimeout(async () => {
      const res = await fetch(`/api/accounts?q=${encodeURIComponent(val)}`);
      if (res.ok) setAccountSuggestions(await res.json());
    }, 300);
  }

  function selectAccount(acct) {
    setSelectedAccount(acct);
    setAccountQuery(acct.Name);
    setAccountSuggestions([]);
    setIsNewCompany(false);
  }

  function chooseNewCompany() {
    setSelectedAccount(null);
    setNewCompanyName(accountQuery);
    setIsNewCompany(true);
    setAccountSuggestions([]);
  }

  async function handleSubmit(e) {
    e.preventDefault();

    if (!isNewCompany && !selectedAccount) {
      setError('Please select an account from the list, or register a new company.');
      return;
    }
    if (isNewCompany && !newCompanyWebsite) {
      setError('A website is required for new companies (e.g. acme.com).');
      return;
    }
    setLoading(true);
    setError('');

    const tier = 'Unframe Ambassador';
    const isDuplicate = !isNewCompany && selectedAccount?.Registration_Active__c;
    const body = isNewCompany
      ? { accountName: newCompanyName, accountWebsite: newCompanyWebsite, tier, notes }
      : { accountId: selectedAccount.Id, tier, notes, isDuplicate: !!isDuplicate, accountDisplayName: selectedAccount.Name };

    const res = await fetch('/api/registrations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      setSuccess(true);
      setTimeout(() => router.push('/dashboard'), 2000);
    } else {
      const data = await res.json();
      setError(data.error || 'Submission failed.');
      setLoading(false);
    }
  }

  return (
    <>
      <nav className="nav">
        <img src="/logo-white.svg" alt="Unframe" className="nav-logo" />
        <span className="nav-user">
          <Link href="/dashboard" className="btn btn-secondary btn-sm">Back to dashboard</Link>
        </span>
      </nav>

      <div className="container">
        <div className="page-header">
          <h1>New Registration Request</h1>
        </div>

        <div style={{ maxWidth: 560 }}>
          {success && (
            <div className="success-msg">
              Registration submitted. Shea will review it shortly. Redirecting…
            </div>
          )}
          {error && <div className="error-msg">{error}</div>}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="account">Account *</label>
              {!isNewCompany ? (
                <div className="autocomplete-wrap">
                  <input
                    id="account"
                    type="text"
                    value={accountQuery}
                    onChange={handleAccountInput}
                    placeholder="Search for an account…"
                    autoComplete="off"
                  />
                  {accountSuggestions.length > 0 && (
                    <div className="autocomplete-list">
                      {accountSuggestions.map(a => (
                        <div key={a.Id} className="autocomplete-item" onClick={() => selectAccount(a)}>
                          <span>{a.Name}</span>
                          {a.Website && <div style={{ fontSize: 12, color: '#6b778c' }}>{a.Website}</div>}
                        </div>
                      ))}
                      {accountQuery.length >= 2 && (
                        <div className="autocomplete-item" style={{ borderTop: '1px solid #dfe1e6', color: '#0052cc' }} onClick={chooseNewCompany}>
                          + Register "{accountQuery}" as a new company
                        </div>
                      )}
                    </div>
                  )}
                  {selectedAccount && (
                    <>
                      <div style={{ marginTop: 6, fontSize: 12, color: '#006644' }}>
                        Selected: {selectedAccount.Name}
                      </div>
                      {selectedAccount.Registration_Active__c && (
                        <div style={{ marginTop: 8, padding: '10px 14px', background: '#fff7e6', border: '1px solid #ffe0a3', borderRadius: 6, fontSize: 13, color: '#7a4f00' }}>
                          This account is currently held. However, you can still submit your application to be considered if it becomes available.
                        </div>
                      )}
                    </>
                  )}
                </div>
              ) : (
                <div>
                  <div className="form-group" style={{ marginBottom: 10 }}>
                    <input type="text" value={newCompanyName} onChange={e => setNewCompanyName(e.target.value)} placeholder="Company name" required />
                  </div>
                  <div className="form-group" style={{ marginBottom: 4 }}>
                    <input type="text" value={newCompanyWebsite} onChange={e => setNewCompanyWebsite(e.target.value)} placeholder="Website (e.g. acme.com) — required" required />
                  </div>
                  <button type="button" className="btn btn-secondary btn-sm" style={{ marginTop: 6 }} onClick={() => { setIsNewCompany(false); setAccountQuery(''); }}>
                    Search existing accounts instead
                  </button>
                </div>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="notes">Notes</label>
              <textarea id="notes" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Any context on your relationship with this account…" />
            </div>

            <button className="btn btn-primary" type="submit" disabled={loading || success}>
              {loading ? 'Submitting…' : 'Submit for approval'}
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
