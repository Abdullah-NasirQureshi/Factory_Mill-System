import { useEffect, useState } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

function fmt(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString();
}

export default function SeasonsPage() {
  const { user, refreshUser } = useAuth();
  const [seasons, setSeasons] = useState([]);
  const [openingBalances, setOpeningBalances] = useState([]);
  const [selectedSeason, setSelectedSeason] = useState(null);
  const [loading, setLoading] = useState(true);
  const [obLoading, setObLoading] = useState(false);
  const [closing, setClosing] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [newSeasonName, setNewSeasonName] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

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
      await refreshUser(); // update season badge in header
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
        {user?.role === 'ADMIN' && activeSeason && (
          <button className="btn btn-danger" onClick={() => { setShowCloseModal(true); setError(''); setSuccess(''); }}>
            Close Season &amp; Start New
          </button>
        )}
      </div>

      {success && (
        <div className="alert alert-success" style={{ marginBottom: 16, padding: '12px 16px', background: '#d1fae5', border: '1px solid #6ee7b7', borderRadius: 8, color: '#065f46' }}>
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

      {/* Opening Balances Panel */}
      {selectedSeason && (
        <div className="card">
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 className="card-title">Opening Balances carried into next season from "{selectedSeason.name}"</h3>
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
                      <thead>
                        <tr>
                          <th>Name</th>
                          <th style={{ textAlign: 'right' }}>Opening Balance</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map(r => (
                          <tr key={r.id}>
                            <td>{r.entity_name}</td>
                            <td style={{ textAlign: 'right', color: r.balance > 0 ? 'var(--success)' : 'var(--danger)' }}>
                              {Number(r.balance).toLocaleString()}
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
