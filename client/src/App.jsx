import { useState } from 'react';
import { api } from './api.js';

const TYPES = ['New ID', 'Renewal', 'Correction'];
const STATUSES = ['Submitted', 'Under Verification', 'Approved', 'Rejected', 'Ready for Collection'];
const fmt = (d) => new Date(d).toLocaleString();
const blank = { name: '', idNumber: '', type: TYPES[0], city: '' };

function Apply() {
  const [form, setForm] = useState(blank);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    try { setResult(await api.submit(form)); } catch (err) { setError(err.message); }
  };

  if (result) return (
    <section className="panel">
      <h2>Application submitted</h2>
      <p>Your tracking number is</p>
      <p className="ticket">{result.trackingId}</p>
      <p>Keep it safe. You need it to check your status.</p>
      <button onClick={() => { setResult(null); setForm(blank); }}>Start another application</button>
    </section>
  );

  return (
    <form className="panel" onSubmit={submit}>
      <h2>Apply for an ID service</h2>
      <label>Full name<input required value={form.name} onChange={set('name')} /></label>
      <label>ID number<input required placeholder="12345-1234567-1" value={form.idNumber} onChange={set('idNumber')} /></label>
      <label>Service
        <select value={form.type} onChange={set('type')}>{TYPES.map((t) => <option key={t}>{t}</option>)}</select>
      </label>
      <label>City<input required value={form.city} onChange={set('city')} /></label>
      {error && <p className="error">{error}</p>}
      <button type="submit">Submit application</button>
    </form>
  );
}

function Track() {
  const [id, setId] = useState('');
  const [app, setApp] = useState(null);
  const [error, setError] = useState('');

  const find = async (e) => {
    e.preventDefault();
    setError(''); setApp(null);
    try { setApp(await api.track(id.trim())); } catch (err) { setError(err.message); }
  };

  return (
    <section className="panel">
      <h2>Check your application</h2>
      <form className="inline" onSubmit={find}>
        <input required placeholder="CT-1A2B3C4D" value={id} onChange={(e) => setId(e.target.value)} />
        <button type="submit">Check status</button>
      </form>
      {error && <p className="error">{error}</p>}
      {app && (
        <div className="result">
          <p><strong>{app.type}</strong> for {app.name}, {app.city}</p>
          <ol className="stages">
            {STATUSES.filter((s) => s !== 'Rejected' || app.status === 'Rejected').map((s) => (
              <li key={s} className={s === app.status ? 'current' : STATUSES.indexOf(s) < STATUSES.indexOf(app.status) ? 'done' : ''}>{s}</li>
            ))}
          </ol>
          <h3>History</h3>
          <ul className="history">
            {[...app.history].reverse().map((h, i) => (
              <li key={i}><strong>{h.status}</strong> <span>{fmt(h.at)}</span>{h.remark && <em>{h.remark}</em>}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function Staff() {
  const [session, setSession] = useState(null);
  const [creds, setCreds] = useState({ username: '', password: '' });
  const [rows, setRows] = useState([]);
  const [filters, setFilters] = useState({ status: '', type: '' });
  const [audit, setAudit] = useState(null);
  const [error, setError] = useState('');

  const load = async (token, f = filters) => {
    const qs = new URLSearchParams(Object.entries(f).filter(([, v]) => v)).toString();
    try { setRows(await api.list(token, qs ? `?${qs}` : '')); } catch (err) { setError(err.message); }
  };

  const login = async (e) => {
    e.preventDefault(); setError('');
    try { const s = await api.login(creds); setSession(s); load(s.token); } catch (err) { setError(err.message); }
  };

  const decide = async (row, status) => {
    const remark = window.prompt(`Remark for "${status}" (optional):`);
    if (remark === null) return;
    try { await api.update(session.token, row._id, { status, remark }); load(session.token); } catch (err) { setError(err.message); }
  };

  if (!session) return (
    <form className="panel" onSubmit={login}>
      <h2>Staff sign in</h2>
      <label>Username<input required value={creds.username} onChange={(e) => setCreds({ ...creds, username: e.target.value })} /></label>
      <label>Password<input required type="password" value={creds.password} onChange={(e) => setCreds({ ...creds, password: e.target.value })} /></label>
      {error && <p className="error">{error}</p>}
      <button type="submit">Sign in</button>
    </form>
  );

  const setFilter = (k) => (e) => { const f = { ...filters, [k]: e.target.value }; setFilters(f); load(session.token, f); };

  return (
    <section className="panel wide">
      <div className="bar">
        <h2>Applications</h2>
        <span>Signed in as {session.username} ({session.role})
          <button className="link" onClick={() => setSession(null)}>Sign out</button></span>
      </div>
      <div className="inline">
        <select value={filters.status} onChange={setFilter('status')}><option value="">All statuses</option>{STATUSES.map((s) => <option key={s}>{s}</option>)}</select>
        <select value={filters.type} onChange={setFilter('type')}><option value="">All services</option>{TYPES.map((t) => <option key={t}>{t}</option>)}</select>
        {session.role === 'admin' && <button className="secondary" onClick={async () => setAudit(await api.audit(session.token))}>View audit log</button>}
      </div>
      {error && <p className="error">{error}</p>}
      {rows.length === 0 ? <p>No applications match these filters.</p> : (
        <div className="scroll"><table>
          <thead><tr><th>Tracking</th><th>Name</th><th>Service</th><th>City</th><th>Status</th><th>Update</th></tr></thead>
          <tbody>{rows.map((r) => (
            <tr key={r._id}>
              <td>{r.trackingId}</td><td>{r.name}</td><td>{r.type}</td><td>{r.city}</td><td>{r.status}</td>
              <td><select value="" onChange={(e) => e.target.value && decide(r, e.target.value)}>
                <option value="">Change to...</option>{STATUSES.filter((s) => s !== r.status).map((s) => <option key={s}>{s}</option>)}
              </select></td>
            </tr>))}</tbody>
        </table></div>
      )}
      {audit && (
        <div className="result"><h3>Audit log</h3>
          <ul className="history">{audit.map((a) => <li key={a._id}><strong>{a.action}</strong> <span>{a.actor} on {a.target}, {fmt(a.createdAt)}</span>{a.detail && <em>{a.detail}</em>}</li>)}</ul>
        </div>
      )}
    </section>
  );
}

export default function App() {
  const [tab, setTab] = useState('apply');
  const tabs = [['apply', 'Apply'], ['track', 'Track'], ['staff', 'Staff']];
  return (
    <>
      <header>
        <h1>CitizenTrack</h1>
        <nav>{tabs.map(([k, l]) => <button key={k} className={tab === k ? 'active' : ''} onClick={() => setTab(k)}>{l}</button>)}</nav>
      </header>
      <main>{tab === 'apply' ? <Apply /> : tab === 'track' ? <Track /> : <Staff />}</main>
    </>
  );
}
