import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';

function fmt(n) { return Number(n || 0).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function today() { return new Date().toISOString().slice(0, 10); }

const EMPTY_ENTRY = { entry_type: 'DEBIT', amount: '', description: '', entry_date: today(),
                      has_cash_movement: false, payment_method: 'CASH', bank_id: '' };

export default function EmployeeDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const showToast = useToast();
  const isAdmin = user?.role === 'ADMIN';

  const [employee, setEmployee] = useState(null);
  const [entries, setEntries] = useState([]);
  const [banks, setBanks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(EMPTY_ENTRY);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const loadEmployee = async () => {
    const res = await api.get(`/employees/${id}`);
    setEmployee(res.data.employee);
  };

  const loadKhata = async () => {
    const res = await api.get(`/employees/${id}/khata`);
    setEntries(res.data.entries || []);
  };

  const loadBanks = async () => {
    const res = await api.get('/banks');
    setBanks(res.data.banks || []);
  };

  useEffect(() => {
    Promise.all([loadEmployee(), loadKhata(), loadBanks()])
      .catch(() => showToast('Failed to load data', 'error'))
      .finally(() => setLoading(false));
  }, [id]);

  const f = form;
  // CREDIT always has cash movement; DEBIT only if has_cash_movement toggled on
  const needsCash = f.entry_type === 'CREDIT' || (f.entry_type === 'DEBIT' && f.has_cash_movement);

  const handleSubmit = async () => {
    if (!f.amount || Number(f.amount) <= 0) return showToast('Enter a valid amount', 'error');
    if (needsCash && !f.payment_method) return showToast('Select payment method', 'error');
    if (needsCash && f.payment_method === 'BANK' && !f.bank_id) return showToast('Select a bank', 'error');
    setSaving(true);
    try {
      const payload = {
        entry_type: f.entry_type,
        amount: f.amount,
        description: f.description,
        entry_date: f.entry_date,
        has_cash_movement: needsCash,
        ...(needsCash ? { payment_method: f.payment_method, bank_id: f.bank_id || undefined } : {}),
      };
      await api.post(`/employees/${id}/khata`, payload);
      showToast('Entry recorded');
      setForm(EMPTY_ENTRY);
      await Promise.all([loadEmployee(), loadKhata()]);
    } catch (e) {
      showToast(e.response?.data?.error?.message || 'Failed to save entry', 'error');
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    try {
      await api.delete(`/employees/${id}/khata/${deleteTarget.id}`);
      showToast('Entry deleted');
      setDeleteTarget(null);
      await Promise.all([loadEmployee(), loadKhata()]);
    } catch (e) {
      showToast(e.response?.data?.error?.message || 'Delete failed', 'error');
      setDeleteTarget(null);
    }
  };

  if (loading) return <div className="page-container"><p style={{ color: 'var(--text-muted)' }}>Loading...</p></div>;
  if (!employee) return <div className="page-container"><p>Employee not found.</p></div>;

  const outstanding = parseFloat(employee.outstanding_balance || 0);

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <div>
          <button className="btn btn-secondary btn-sm" onClick={() => navigate('/employees')} style={{ marginBottom: 8 }}>← Back</button>
          <h1 className="page-title">{employee.name}</h1>
          <p className="page-subtitle">{employee.phone || 'No phone'} · Monthly Salary: Rs {fmt(employee.monthly_salary)}</p>
        </div>
        <div className="stat-card" style={{ minWidth: 180, textAlign: 'right' }}>
          <div className="stat-label">Outstanding Balance</div>
          <div className="stat-value" style={{ color: outstanding > 0 ? '#ef4444' : '#22c55e' }}>
            Rs {fmt(outstanding)}
          </div>
        </div>
      </div>

      {/* Entry Form */}
      <div className="card" style={{ marginBottom: 24 }}>
        <h3 style={{ marginBottom: 16, fontSize: 15, fontWeight: 600 }}>Record Khata Entry</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
          <div className="form-group">
            <label className="form-label">Date</label>
            <input className="form-input" type="date" value={f.entry_date}
              onChange={e => setForm(p => ({ ...p, entry_date: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Type</label>
            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              {['DEBIT', 'CREDIT'].map(t => (
                <button key={t}
                  className={`btn btn-sm ${f.entry_type === t ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ flex: 1, ...(t === 'CREDIT' ? { background: f.entry_type === 'CREDIT' ? '#dc2626' : '', borderColor: f.entry_type === 'CREDIT' ? '#dc2626' : '' } : {}) }}
                  onClick={() => setForm(p => ({ ...p, entry_type: t, has_cash_movement: false }))}>
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Amount (Rs)</label>
            <input className="form-input" type="number" min="0" placeholder="0.00"
              value={f.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} />
          </div>
          <div className="form-group" style={{ gridColumn: 'span 2' }}>
            <label className="form-label">Description</label>
            <input className="form-input" placeholder="e.g. Salary earned, Loan given, Repayment..."
              value={f.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
          </div>
        </div>

        {/* DEBIT: cash repayment toggle */}
        {f.entry_type === 'DEBIT' && (
          <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 10 }}>
            <input type="checkbox" id="cashRepay" checked={f.has_cash_movement}
              onChange={e => setForm(p => ({ ...p, has_cash_movement: e.target.checked }))} />
            <label htmlFor="cashRepay" style={{ fontSize: 14, cursor: 'pointer' }}>
              Cash repayment (employee returned cash to mill)
            </label>
          </div>
        )}

        {/* Cash/Bank selector when cash moves */}
        {needsCash && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginTop: 12 }}>
            <div className="form-group">
              <label className="form-label">Payment Method</label>
              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                {['CASH', 'BANK'].map(m => (
                  <button key={m} className={`btn btn-sm ${f.payment_method === m ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ flex: 1 }} onClick={() => setForm(p => ({ ...p, payment_method: m, bank_id: '' }))}>
                    {m}
                  </button>
                ))}
              </div>
            </div>
            {f.payment_method === 'BANK' && (
              <div className="form-group">
                <label className="form-label">Bank Account</label>
                <select className="form-input" value={f.bank_id} onChange={e => setForm(p => ({ ...p, bank_id: e.target.value }))}>
                  <option value="">Select bank...</option>
                  {banks.map(b => <option key={b.id} value={b.id}>{b.bank_name} — {b.account_title}</option>)}
                </select>
              </div>
            )}
          </div>
        )}

        {/* Type hint */}
        <div style={{ marginTop: 10, fontSize: 13, color: 'var(--text-muted)', background: '#f8fafc', padding: '8px 12px', borderRadius: 6 }}>
          {f.entry_type === 'DEBIT'
            ? f.has_cash_movement
              ? '↑ Debit (cash repayment): employee returns cash → mill cash increases, outstanding decreases'
              : '↑ Debit (salary earned): employee earned salary → outstanding decreases, no cash movement'
            : '↓ Credit (cash out): mill gives cash to employee → mill cash decreases, outstanding increases'}
        </div>

        <div style={{ marginTop: 16 }}>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={saving}>
            {saving ? 'Saving...' : 'Record Entry'}
          </button>
        </div>
      </div>

      {/* Khata Table */}
      <div className="card">
        <h3 style={{ marginBottom: 16, fontSize: 15, fontWeight: 600 }}>Khata Ledger</h3>
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Description</th>
                <th style={{ textAlign: 'right', color: '#2563eb' }}>Debit</th>
                <th style={{ textAlign: 'right', color: '#dc2626' }}>Credit</th>
                <th style={{ textAlign: 'right' }}>Balance</th>
                {isAdmin && <th>Action</th>}
              </tr>
            </thead>
            <tbody>
              {entries.length === 0 ? (
                <tr><td colSpan={isAdmin ? 6 : 5} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>No entries yet</td></tr>
              ) : entries.map(e => (
                <tr key={e.id}>
                  <td>{new Date(e.entry_date).toLocaleDateString('en-PK')}</td>
                  <td>{e.description || '—'}</td>
                  <td style={{ textAlign: 'right', color: '#2563eb' }}>
                    {e.entry_type === 'DEBIT' ? `Rs ${fmt(e.amount)}` : ''}
                  </td>
                  <td style={{ textAlign: 'right', color: '#dc2626' }}>
                    {e.entry_type === 'CREDIT' ? `Rs ${fmt(e.amount)}` : ''}
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 600,
                    color: parseFloat(e.running_balance) > 0 ? '#ef4444' : '#22c55e' }}>
                    Rs {fmt(e.running_balance)}
                  </td>
                  {isAdmin && (
                    <td>
                      <button className="btn btn-sm" style={{ background: '#fee2e2', color: '#dc2626', border: 'none' }}
                        onClick={() => setDeleteTarget(e)}>Delete</button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Delete Confirm */}
      {deleteTarget && (
        <div className="modal-overlay" onClick={() => setDeleteTarget(null)}>
          <div className="modal" onClick={ev => ev.stopPropagation()} style={{ maxWidth: 400 }}>
            <div className="modal-header">
              <h3>Delete Entry</h3>
              <button className="modal-close" onClick={() => setDeleteTarget(null)}>✕</button>
            </div>
            <div className="modal-body">
              <p>Delete this {deleteTarget.entry_type} entry of Rs {fmt(deleteTarget.amount)}?
                {deleteTarget.has_cash_movement && ' The cash/bank balance will be reversed.'}
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setDeleteTarget(null)}>Cancel</button>
              <button className="btn" style={{ background: '#dc2626', color: '#fff' }} onClick={handleDelete}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
