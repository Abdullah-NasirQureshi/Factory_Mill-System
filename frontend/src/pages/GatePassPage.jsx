import { useEffect, useState, useRef } from 'react';
import api from '../services/api';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';

function fmt(dt) {
  if (!dt) return '—';
  return new Date(dt).toLocaleString('en-PK', { dateStyle: 'short', timeStyle: 'short' });
}

function today() { return new Date().toISOString().slice(0, 16); }
function monthStart() { const d = new Date(); d.setDate(1); return d.toISOString().slice(0, 10); }
function todayDate() { return new Date().toISOString().slice(0, 10); }

const EMPTY_FORM = {
  pass_type: 'OUT', vehicle_number: '', driver_name: '', driver_phone: '',
  party_type: 'CUSTOMER', party_name: '', description: '', pass_date: today(),
};

// ── Print view ────────────────────────────────────────────────────────────────
function GatePassPrint({ gp, settings, onClose }) {
  const handlePrint = () => window.print();
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>
        <div className="modal-header">
          <h3>Gate Pass — {gp.gp_number}</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body" id="gp-print-area">
          <div style={{ textAlign: 'center', marginBottom: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 18 }}>{settings?.company_name || 'Factory'}</div>
            {settings?.address && <div style={{ fontSize: 12, color: '#64748b' }}>{settings.address}</div>}
            {settings?.phone && <div style={{ fontSize: 12, color: '#64748b' }}>{settings.phone}</div>}
          </div>
          <div style={{ textAlign: 'center', fontWeight: 700, fontSize: 15, marginBottom: 12, letterSpacing: 1 }}>
            GATE PASS
          </div>
          <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
            {[
              ['GP Number', gp.gp_number],
              ['Date / Time', fmt(gp.pass_date)],
              ['Type', gp.pass_type],
              ['Vehicle No', gp.vehicle_number || '—'],
              ['Driver Name', gp.driver_name || '—'],
              ['Driver Phone', gp.driver_phone || '—'],
              ['Party', `${gp.party_name} (${gp.party_type})`],
              ['Description', gp.description || '—'],
            ].map(([label, val]) => (
              <tr key={label}>
                <td style={{ padding: '5px 8px', fontWeight: 600, width: '40%', borderBottom: '1px solid #e2e8f0' }}>{label}</td>
                <td style={{ padding: '5px 8px', borderBottom: '1px solid #e2e8f0' }}>{val}</td>
              </tr>
            ))}
          </table>
          <div style={{ marginTop: 32, display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
            <div>Guard Signature: _______________</div>
            <div>Authorized By: _______________</div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Close</button>
          <button className="btn btn-primary" onClick={handlePrint}>🖨 Print</button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function GatePassPage() {
  const { user } = useAuth();
  const showToast = useToast();
  const isAdmin = user?.role === 'ADMIN';

  const [passes, setPasses] = useState([]);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ from: monthStart(), to: todayDate(), type: '', search: '' });
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [printGp, setPrintGp] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const load = async (f = filters) => {
    setLoading(true);
    try {
      const params = {};
      if (f.from)   params.from = f.from;
      if (f.to)     params.to = f.to;
      if (f.type)   params.type = f.type;
      if (f.search) params.search = f.search;
      const r = await api.get('/gate-passes', { params });
      setPasses(r.data.gate_passes || []);
    } catch { showToast('Failed to load gate passes', 'error'); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    load();
    api.get('/settings').then(r => setSettings(r.data.settings)).catch(() => {});
  }, []);

  useEffect(() => { load(); }, [filters]);

  const todayIn  = passes.filter(p => p.pass_type === 'IN').length;
  const todayOut = passes.filter(p => p.pass_type === 'OUT').length;

  const handleSave = async () => {
    if (!form.party_name.trim()) return showToast('Party name is required', 'error');
    setSaving(true);
    try {
      await api.post('/gate-passes', form);
      showToast('Gate pass created');
      setShowModal(false);
      setForm(EMPTY_FORM);
      load();
    } catch (e) {
      showToast(e.response?.data?.error?.message || 'Failed to save', 'error');
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    try {
      await api.delete(`/gate-passes/${deleteTarget.id}`);
      showToast('Gate pass deleted');
      setDeleteTarget(null);
      load();
    } catch (e) {
      showToast(e.response?.data?.error?.message || 'Delete failed', 'error');
      setDeleteTarget(null);
    }
  };

  const handlePrint = async (gp) => {
    // fetch full record if needed
    try {
      const r = await api.get(`/gate-passes/${gp.id}`);
      setPrintGp(r.data.gate_pass);
    } catch { setPrintGp(gp); }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Gate Pass</h1>
          <p className="page-subtitle">Manage vehicle entry and exit records</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setForm(EMPTY_FORM); setShowModal(true); }}>
          + New Gate Pass
        </button>
      </div>

      {/* Summary */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', marginBottom: 24 }}>
        <div className="stat-card">
          <div className="stat-label">Total (filtered)</div>
          <div className="stat-value">{passes.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">IN</div>
          <div className="stat-value" style={{ color: '#22c55e' }}>{todayIn}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">OUT</div>
          <div className="stat-value" style={{ color: '#ef4444' }}>{todayOut}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">From</label>
            <input className="form-input" type="date" value={filters.from}
              onChange={e => setFilters(f => ({ ...f, from: e.target.value }))} />
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">To</label>
            <input className="form-input" type="date" value={filters.to}
              onChange={e => setFilters(f => ({ ...f, to: e.target.value }))} />
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Type</label>
            <select className="form-input" value={filters.type}
              onChange={e => setFilters(f => ({ ...f, type: e.target.value }))}>
              <option value="">All</option>
              <option value="IN">IN</option>
              <option value="OUT">OUT</option>
            </select>
          </div>
          <div className="form-group" style={{ margin: 0, flex: '1 1 200px' }}>
            <label className="form-label">Search (party / vehicle)</label>
            <input className="form-input" placeholder="Search..." value={filters.search}
              onChange={e => setFilters(f => ({ ...f, search: e.target.value }))} />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="card">
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>GP #</th>
                <th>Date / Time</th>
                <th>Type</th>
                <th>Vehicle No</th>
                <th>Driver</th>
                <th>Party</th>
                <th>Description</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>Loading...</td></tr>
              ) : passes.length === 0 ? (
                <tr><td colSpan={8} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>No gate passes found</td></tr>
              ) : passes.map(gp => (
                <tr key={gp.id}>
                  <td><span className="badge badge-info">{gp.gp_number}</span></td>
                  <td style={{ whiteSpace: 'nowrap' }}>{fmt(gp.pass_date)}</td>
                  <td>
                    <span className={`badge ${gp.pass_type === 'IN' ? 'badge-success' : 'badge-danger'}`}>
                      {gp.pass_type}
                    </span>
                  </td>
                  <td>{gp.vehicle_number || '—'}</td>
                  <td>
                    <div>{gp.driver_name || '—'}</div>
                    {gp.driver_phone && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{gp.driver_phone}</div>}
                  </td>
                  <td>
                    <div>{gp.party_name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{gp.party_type}</div>
                  </td>
                  <td style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {gp.description || '—'}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-secondary btn-sm" onClick={() => handlePrint(gp)}>🖨 Print</button>
                      {isAdmin && (
                        <button className="btn btn-sm" style={{ background: '#fee2e2', color: '#dc2626', border: 'none' }}
                          onClick={() => setDeleteTarget(gp)}>Delete</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* New Gate Pass Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 520 }}>
            <div className="modal-header">
              <h3>New Gate Pass</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              {/* Pass Type */}
              <div className="form-group">
                <label className="form-label">Pass Type</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {['IN','OUT'].map(t => (
                    <button key={t}
                      className={`btn btn-sm ${form.pass_type === t ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ flex: 1, ...(t === 'OUT' && form.pass_type === 'OUT' ? { background: '#dc2626', borderColor: '#dc2626' } : {}) }}
                      onClick={() => setForm(f => ({ ...f, pass_type: t }))}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label className="form-label">Vehicle Number</label>
                  <input className="form-input" placeholder="e.g. ABC-123" value={form.vehicle_number}
                    onChange={e => setForm(f => ({ ...f, vehicle_number: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Date / Time</label>
                  <input className="form-input" type="datetime-local" value={form.pass_date}
                    onChange={e => setForm(f => ({ ...f, pass_date: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Driver Name</label>
                  <input className="form-input" placeholder="Driver name" value={form.driver_name}
                    onChange={e => setForm(f => ({ ...f, driver_name: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Driver Phone</label>
                  <input className="form-input" placeholder="Driver phone" value={form.driver_phone}
                    onChange={e => setForm(f => ({ ...f, driver_phone: e.target.value }))} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 12 }}>
                <div className="form-group">
                  <label className="form-label">Party Type</label>
                  <select className="form-input" value={form.party_type}
                    onChange={e => setForm(f => ({ ...f, party_type: e.target.value }))}>
                    <option value="CUSTOMER">Customer</option>
                    <option value="SUPPLIER">Supplier</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Party Name *</label>
                  <input className="form-input" placeholder="Customer / Supplier / Other name" value={form.party_name}
                    onChange={e => setForm(f => ({ ...f, party_name: e.target.value }))} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Description</label>
                <input className="form-input" placeholder="Goods description, purpose, etc." value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving...' : 'Create Gate Pass'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {deleteTarget && (
        <div className="modal-overlay" onClick={() => setDeleteTarget(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 400 }}>
            <div className="modal-header">
              <h3>Delete Gate Pass</h3>
              <button className="modal-close" onClick={() => setDeleteTarget(null)}>✕</button>
            </div>
            <div className="modal-body">
              <p>Delete gate pass <strong>{deleteTarget.gp_number}</strong>? This cannot be undone.</p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setDeleteTarget(null)}>Cancel</button>
              <button className="btn" style={{ background: '#dc2626', color: '#fff' }} onClick={handleDelete}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Print View */}
      {printGp && <GatePassPrint gp={printGp} settings={settings} onClose={() => setPrintGp(null)} />}
    </div>
  );
}
