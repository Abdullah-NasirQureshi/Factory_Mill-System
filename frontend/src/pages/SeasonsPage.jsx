import { useEffect, useState, useCallback } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

function fmt(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString();
}
function num(n) {
  return Number(n || 0).toLocaleString();
}

// ─── Opening Balance Editor ───────────────────────────────────────────────────
function OpeningBalanceEditor({ onSaved }) {
  const [data, setData]       = useState(null);
  const [edits, setEdits]     = useState({});   // key: "TYPE-id" → value string
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState('');
  const [success, setSuccess] = useState('');
  const [tab, setTab]         = useState('CUSTOMER'); // CUSTOMER | SUPPLIER | EMPLOYEE

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get('/seasons/active/opening-balances/entities');
      setData(r.data);
      // Pre-fill edits with existing balances
      const init = {};
      r.data.customers.forEach(c => { if (c.opening_balance != 0) init[`CUSTOMER-${c.id}`] = String(c.opening_balance); });
      r.data.suppliers.forEach(s => { if (s.opening_balance != 0) init[`SUPPLIER-${s.id}`] = String(s.opening_balance); });
      r.data.employees.forEach(e => { if (e.opening_balance != 0) init[`EMPLOYEE-${e.id}`] = String(e.opening_balance); });
      setEdits(init);
    } catch (e) {
      setError('Failed to load entities');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const set = (type, id, val) => {
    setEdits(prev => ({ ...prev, [`${type}-${id}`]: val }));
  };

  const get = (type, id) => edits[`${type}-${id}`] ?? '';

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const entries = [];
      (data?.customers || []).forEach(c => {
        const v = get('CUSTOMER', c.id);
        entries.push({ entity_type: 'CUSTOMER', entity_id: c.id, balance: parseFloat(v) || 0 });
      });
      (data?.suppliers || []).forEach(s => {
        const v = get('SUPPLIER', s.id);
        entries.push({ entity_type: 'SUPPLIER', entity_id: s.id, balance: parseFloat(v) || 0 });
      });
      (data?.employees || []).forEach(e => {
        const v = get('EMPLOYEE', e.id);
        entries.push({ entity_type: 'EMPLOYEE', entity_id: e.id, balance: parseFloat(v) || 0 });
      });

      await api.put('/seasons/active/opening-balances', { entries });
      setSuccess('Opening balances saved successfully.');
      if (onSaved) onSaved();
    } catch (e) {
      setError(e.response?.data?.error?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const tabs = [
    { key: 'CUSTOMER', label: 'Customers', items: data?.customers || [] },
    { key: 'SUPPLIER', label: 'Suppliers', items: data?.suppliers || [] },
    { key: 'EMPLOYEE', label: 'Employees', items: data?.employees || [] },
  ];

  const activeItems = tabs.find(t => t.key === tab)?.items || [];

  const labelFor = (type) => {
    if (type === 'CUSTOMER') return { pos: 'They owe us (receivable)', neg: 'We owe them (credit)' };
    if (type === 'SUPPLIER') return { pos: 'We owe them (payable)',    neg: 'They owe us (advance)' };
    return                          { pos: 'We owe them (loan)',       neg: 'They owe us (advance)' };
  };

  if (loading) return <div style={{ padding: 20, textAlign: 'center' }}>Loading...</div>;

  return (
    <div>
      {/* Info box */}
      <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '12px 16px', marginBottom: 20, fontSize: 14, color: '#1e40af' }}>
        Enter the opening balance for each party from your previous records.
        Use a <strong>positive number</strong> for amounts owed to you, and a <strong>negative number</strong> for amounts you owe them.
        Leave blank or enter 0 for no balance.
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16, borderBottom: '2px solid var(--border)' }}>
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              padding: '8px 20px', border: 'none', background: 'none', cursor: 'pointer',
              fontWeight: tab === t.key ? 700 : 400,
              borderBottom: tab === t.key ? '2px solid var(--primary)' : '2px solid transparent',
              color: tab === t.key ? 'var(--primary)' : 'var(--text-secondary)',
              marginBottom: -2,
            }}
          >
            {t.label}
            {t.items.filter(i => parseFloat(edits[`${t.key}-${i.id}`]) || 0).length > 0 && (
              <span style={{ marginLeft: 6, background: 'var(--primary)', color: '#fff', borderRadius: 10, padding: '1px 7px', fontSize: 11 }}>
                {t.items.filter(i => parseFloat(edits[`${t.key}-${i.id}`]) || 0).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Hint for current tab */}
      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 12 }}>
        {labelFor(tab).pos} → positive &nbsp;|&nbsp; {labelFor(tab).neg} → negative
      </div>

      {/* Entity list */}
      {activeItems.length === 0 ? (
        <div style={{ padding: '20px 0', color: 'var(--text-secondary)', textAlign: 'center' }}>
          No {tab.toLowerCase()}s found.
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 8 }}>
          {activeItems.map(item => {
            const val = get(tab, item.id);
            const parsed = parseFloat(val) || 0;
            return (
              <div key={item.id} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '10px 14px', background: 'var(--bg-secondary)',
                borderRadius: 8, border: parsed !== 0 ? '1px solid var(--primary)' : '1px solid transparent',
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{item.name}</div>
                  {item.phone && <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{item.phone}</div>}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {parsed !== 0 && (
                    <span style={{ fontSize: 12, color: parsed > 0 ? 'var(--success)' : 'var(--danger)', fontWeight: 600 }}>
                      {parsed > 0 ? '▲' : '▼'} {Math.abs(parsed).toLocaleString()}
                    </span>
                  )}
                  <input
                    type="number"
                    className="form-input"
                    style={{ width: 140, textAlign: 'right' }}
                    placeholder="0"
                    value={val}
                    onChange={e => set(tab, item.id, e.target.value)}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Save */}
      {error   && <div style={{ color: 'var(--danger)',  marginTop: 12, fontSize: 14 }}>{error}</div>}
      {success && <div style={{ color: 'var(--success)', marginTop: 12, fontSize: 14 }}>{success}</div>}
      <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end' }}>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save Opening Balances'}
        </button>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function SeasonsPage() {
  const { user, refreshUser } = useAuth();
  const [seasons, setSeasons]               = useState([]);
  const [openingBalances, setOpeningBalances] = useState([]);
  const [selectedSeason, setSelectedSeason] = useState(null);
  const [loading, setLoading]               = useState(true);
  const [obLoading, setObLoading]           = useState(false);
  const [closing, setClosing]               = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [showObEditor, setShowObEditor]     = useState(false);
  const [newSeasonName, setNewSeasonName]   = useState('');
  const [error, setError]                   = useState('');
  const [success, setSuccess]               = useState('');

  const load = () => {
    setLoading(true);
    api.get('/seasons').then(r => setSeasons(r.data.seasons || [])).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const viewOpeningBalances = async (season) => {
    setSelectedSeason(season);
    setObLoading(true);
    try {
      const r = await api.get(`/seasons/${season.id}/opening-balances`);
      setOpeningBalances(r.data.opening_balances || []);
    } finally {
      setObLoading(false);
    }
  };

  const handleClose = async () => {
    if (!newSeasonName.trim()) { setError('Please enter a name for the new season'); return; }
    setError('');
    setClosing(true);
    try {
      const r = await api.post('/seasons/close', { new_season_name: newSeasonName.trim() });
      setSuccess(r.data.message);
      setShowCloseModal(false);
      setNewSeasonName('');
      load();
      await refreshUser();
    } catch (e) {
      setError(e.response?.data?.error?.message || 'Failed to close season');
    } finally {
      setClosing(false);
    }
  };

  const activeSeason = seasons.find(s => s.is_active);
  const grouped = (type) => openingBalances.filter(o => o.entity_type === type);

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Seasons</h1>
        <div style={{ display: 'flex', gap: 10 }}>
          {user?.role === 'ADMIN' && activeSeason && (
            <button className="btn btn-secondary" onClick={() => setShowObEditor(v => !v)}>
              {showObEditor ? '✕ Close Editor' : '✎ Set Opening Balances'}
            </button>
          )}
          {user?.role === 'ADMIN' && activeSeason && (
            <button className="btn btn-danger" onClick={() => { setShowCloseModal(true); setError(''); setSuccess(''); }}>
              Close Season &amp; Start New
            </button>
          )}
        </div>
      </div>

      {success && (
        <div style={{ marginBottom: 16, padding: '12px 16px', background: '#d1fae5', border: '1px solid #6ee7b7', borderRadius: 8, color: '#065f46' }}>
          {success}
        </div>
      )}

      {/* Active Season Banner */}
      {activeSeason && (
        <div style={{ background: 'var(--primary)', color: '#fff', borderRadius: 10, padding: '14px 20px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          <div>
            <strong>Active Season:</strong> {activeSeason.name}
            <span style={{ marginLeft: 12, opacity: 0.85, fontSize: 13 }}>Started {fmt(activeSeason.start_date)}</span>
          </div>
        </div>
      )}

      {/* Opening Balance Editor */}
      {showObEditor && (
        <div className="card" style={{ marginBottom: 24 }}>
          <div className="card-header">
            <h3 className="card-title">Opening Balances — {activeSeason?.name}</h3>
          </div>
          <div style={{ padding: '0 20px 20px' }}>
            <OpeningBalanceEditor onSaved={() => setSuccess('Opening balances saved.')} />
          </div>
        </div>
      )}

      {/* Seasons List */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-header"><h3 className="card-title">All Seasons</h3></div>
        {loading ? <div style={{ padding: 20, textAlign: 'center' }}>Loading...</div> : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Name</th>
                  <th>Start Date</th>
                  <th>End Date</th>
                  <th>Status</th>
                  <th>Closed By</th>
                  <th>Opening Balances</th>
                </tr>
              </thead>
              <tbody>
                {seasons.map(s => (
                  <tr key={s.id}>
                    <td>{s.id}</td>
                    <td><strong>{s.name}</strong></td>
                    <td>{fmt(s.start_date)}</td>
                    <td>{fmt(s.end_date)}</td>
                    <td>
                      <span className={`badge ${s.is_active ? 'badge-success' : 'badge-secondary'}`}>
                        {s.is_active ? 'Active' : 'Closed'}
                      </span>
                    </td>
                    <td>{s.closed_by_name || '—'}</td>
                    <td>
                      {!s.is_active && (
                        <button className="btn btn-secondary btn-sm" onClick={() => viewOpeningBalances(s)}>
                          View
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Opening Balances Viewer (closed seasons) */}
      {selectedSeason && (
        <div className="card">
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 className="card-title">Opening Balances carried from "{selectedSeason.name}"</h3>
            <button className="btn btn-secondary btn-sm" onClick={() => { setSelectedSeason(null); setOpeningBalances([]); }}>✕ Close</button>
          </div>
          {obLoading ? <div style={{ padding: 20, textAlign: 'center' }}>Loading...</div> : (
            <div style={{ padding: '0 20px 20px' }}>
              {['CUSTOMER', 'SUPPLIER', 'EMPLOYEE', 'BANK', 'CASH'].map(type => {
                const rows = grouped(type);
                if (!rows.length) return null;
                return (
                  <div key={type} style={{ marginTop: 16 }}>
                    <div style={{ fontWeight: 600, marginBottom: 8, color: 'var(--text-secondary)', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 }}>{type}</div>
                    <table className="table" style={{ marginBottom: 0 }}>
                      <thead><tr><th>Name</th><th style={{ textAlign: 'right' }}>Balance</th></tr></thead>
                      <tbody>
                        {rows.map(r => (
                          <tr key={r.id}>
                            <td>{r.entity_name}</td>
                            <td style={{ textAlign: 'right', color: r.balance > 0 ? 'var(--success)' : 'var(--danger)' }}>
                              {num(r.balance)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Close Season Modal */}
      {showCloseModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div className="card" style={{ width: '100%', maxWidth: 480, margin: 0 }}>
            <div className="card-header">
              <h3 className="card-title" style={{ color: 'var(--danger)' }}>⚠ Close Season</h3>
            </div>
            <div style={{ padding: '0 20px 20px' }}>
              <p style={{ marginBottom: 16, color: 'var(--text-secondary)' }}>
                This will <strong>close "{activeSeason?.name}"</strong> and start a new season.
                All ledger data stays in the closed season. Customer, supplier, employee, bank and cash balances will be carried forward as opening balances.
              </p>
              <div className="form-group">
                <label className="form-label">New Season Name *</label>
                <input
                  className="form-input"
                  placeholder="e.g. Season 2025-26"
                  value={newSeasonName}
                  onChange={e => setNewSeasonName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleClose()}
                />
              </div>
              {error && <div style={{ color: 'var(--danger)', marginBottom: 12, fontSize: 14 }}>{error}</div>}
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
                <button className="btn btn-secondary" onClick={() => { setShowCloseModal(false); setError(''); }} disabled={closing}>
                  Cancel
                </button>
                <button className="btn btn-danger" onClick={handleClose} disabled={closing}>
                  {closing ? 'Processing...' : 'Close Season & Start New'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
