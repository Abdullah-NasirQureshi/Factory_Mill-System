import { useEffect, useState, useRef, useMemo } from 'react';
import api from '../services/api';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';

function fmt(n) { return Number(n || 0).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function currentMonth() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; }

// Employee search combobox
function EmployeeCombobox({ employees, value, onChange }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const filtered = useMemo(() => {
    if (!query) return employees;
    return employees.filter(e => e.name.toLowerCase().includes(query.toLowerCase()) || (e.phone || '').includes(query));
  }, [employees, query]);

  const selected = employees.find(e => e.id === value?.id);

  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <input className="form-input"
        placeholder="Search employee..."
        value={open ? query : (selected?.name || '')}
        onFocus={() => { setOpen(true); setQuery(''); }}
        onChange={e => { setQuery(e.target.value); setOpen(true); }}
        autoComplete="off"
      />
      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 200,
          background: '#ffffff', border: '1px solid #cbd5e1',
          borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.15)', maxHeight: 220, overflowY: 'auto',
        }}>
          {filtered.length === 0
            ? <div style={{ padding: '10px 14px', color: 'var(--text-muted)', fontSize: 13 }}>No results</div>
            : filtered.map(e => (
              <div key={e.id}
                style={{ padding: '9px 14px', cursor: 'pointer', fontSize: 14,
                         background: value?.id === e.id ? '#eff6ff' : '#ffffff',
                         borderBottom: '1px solid #f1f5f9' }}
                onMouseDown={() => { onChange(e); setOpen(false); setQuery(''); }}
                onMouseEnter={ev => ev.currentTarget.style.background = '#f1f5f9'}
                onMouseLeave={ev => ev.currentTarget.style.background = value?.id === e.id ? '#eff6ff' : '#ffffff'}>
                <strong>{e.name}</strong>
                {e.phone && <span style={{ color: '#94a3b8', marginLeft: 8, fontSize: 12 }}>{e.phone}</span>}
                <span style={{ float: 'right', color: '#64748b', fontSize: 12 }}>Rs {fmt(e.monthly_salary)}/mo</span>
              </div>
            ))
          }
        </div>
      )}
    </div>
  );
}

export default function SalaryPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const isAdmin = user?.role === 'ADMIN';

  const [employees, setEmployees] = useState([]);
  const [selectedEmp, setSelectedEmp] = useState(null);
  const [salaryHistory, setSalaryHistory] = useState([]);
  const [banks, setBanks] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const [form, setForm] = useState({
    salary_month: currentMonth(),
    amount: '',
    payment_method: 'CASH',
    bank_id: '',
    notes: '',
  });

  useEffect(() => {
    api.get('/employees', { params: { active: 'true' } })
      .then(r => setEmployees(r.data.data.employees || []))
      .catch(() => showToast('Failed to load employees', 'error'));
    api.get('/banks')
      .then(r => setBanks(r.data.data.banks || []))
      .catch(() => {});
  }, []);

  const loadHistory = async (emp) => {
    if (!emp) return;
    setLoadingHistory(true);
    try {
      const r = await api.get(`/employees/${emp.id}/salary`);
      setSalaryHistory(r.data.data.payments || []);
    } catch { showToast('Failed to load salary history', 'error'); }
    finally { setLoadingHistory(false); }
  };

  const selectEmployee = (emp) => {
    setSelectedEmp(emp);
    setForm(f => ({ ...f, amount: emp.monthly_salary || '' }));
    loadHistory(emp);
  };

  const handlePay = async () => {
    if (!selectedEmp) return showToast('Select an employee', 'error');
    if (!form.amount || Number(form.amount) <= 0) return showToast('Enter a valid amount', 'error');
    if (form.payment_method === 'BANK' && !form.bank_id) return showToast('Select a bank', 'error');
    setSaving(true);
    try {
      // salary_month needs to be a date (first of month)
      const monthDate = form.salary_month + '-01';
      await api.post(`/employees/${selectedEmp.id}/salary`, { ...form, salary_month: monthDate });
      showToast('Salary recorded');
      setForm(f => ({ ...f, notes: '' }));
      loadHistory(selectedEmp);
      // Refresh employee list to update outstanding
      const r = await api.get('/employees', { params: { active: 'true' } });
      const updated = (r.data.data.employees || []);
      setEmployees(updated);
      setSelectedEmp(updated.find(e => e.id === selectedEmp.id) || selectedEmp);
    } catch (e) {
      showToast(e.response?.data?.error?.message || 'Failed to record salary', 'error');
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    try {
      await api.delete(`/employees/${selectedEmp.id}/salary/${deleteTarget.id}`);
      showToast('Salary payment deleted');
      setDeleteTarget(null);
      loadHistory(selectedEmp);
    } catch (e) {
      showToast(e.response?.data?.error?.message || 'Delete failed', 'error');
      setDeleteTarget(null);
    }
  };

  const formatMonth = (dateStr) => {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return d.toLocaleString('en-US', { month: 'long', year: 'numeric' });
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Salary</h1>
          <p className="page-subtitle">Record monthly salary payments for employees</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: 24, alignItems: 'start' }}>
        {/* Left: Employee selector + payment form */}
        <div>
          <div className="card" style={{ marginBottom: 16 }}>
            <h3 style={{ marginBottom: 12, fontSize: 14, fontWeight: 600 }}>Select Employee</h3>
            <EmployeeCombobox employees={employees} value={selectedEmp} onChange={selectEmployee} />
            {selectedEmp && (
              <div style={{ marginTop: 12, padding: '10px 12px', background: '#f8fafc', borderRadius: 8, fontSize: 13 }}>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>{selectedEmp.name}</div>
                <div style={{ color: 'var(--text-muted)' }}>Monthly Salary: Rs {fmt(selectedEmp.monthly_salary)}</div>
                <div style={{ color: parseFloat(selectedEmp.outstanding_balance) > 0 ? '#ef4444' : '#22c55e', marginTop: 2 }}>
                  Outstanding: Rs {fmt(selectedEmp.outstanding_balance)}
                </div>
              </div>
            )}
          </div>

          {selectedEmp && (
            <div className="card">
              <h3 style={{ marginBottom: 14, fontSize: 14, fontWeight: 600 }}>Pay Salary</h3>
              <div className="form-group">
                <label className="form-label">Month</label>
                <input className="form-input" type="month" value={form.salary_month}
                  onChange={e => setForm(f => ({ ...f, salary_month: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Amount (Rs)</label>
                <input className="form-input" type="number" min="0" value={form.amount}
                  onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Payment Method</label>
                <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                  {['CASH', 'BANK'].map(m => (
                    <button key={m} className={`btn btn-sm ${form.payment_method === m ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ flex: 1 }} onClick={() => setForm(f => ({ ...f, payment_method: m, bank_id: '' }))}>
                      {m}
                    </button>
                  ))}
                </div>
              </div>
              {form.payment_method === 'BANK' && (
                <div className="form-group">
                  <label className="form-label">Bank Account</label>
                  <select className="form-input" value={form.bank_id} onChange={e => setForm(f => ({ ...f, bank_id: e.target.value }))}>
                    <option value="">Select bank...</option>
                    {banks.map(b => <option key={b.id} value={b.id}>{b.bank_name} — {b.account_title}</option>)}
                  </select>
                </div>
              )}
              <div className="form-group">
                <label className="form-label">Notes (optional)</label>
                <input className="form-input" placeholder="Any notes..." value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12, padding: '8px 10px', background: '#fef9c3', borderRadius: 6 }}>
                This will deduct Rs {fmt(form.amount)} from {form.payment_method === 'CASH' ? 'cash' : 'bank'} and post a Credit entry in {selectedEmp.name}'s khata.
              </div>
              <button className="btn btn-primary" style={{ width: '100%' }} onClick={handlePay} disabled={saving}>
                {saving ? 'Recording...' : 'Record Salary Payment'}
              </button>
            </div>
          )}
        </div>

        {/* Right: Salary history */}
        <div className="card">
          <h3 style={{ marginBottom: 16, fontSize: 15, fontWeight: 600 }}>
            {selectedEmp ? `Salary History — ${selectedEmp.name}` : 'Salary History'}
          </h3>
          {!selectedEmp ? (
            <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Select an employee to view their salary history.</p>
          ) : loadingHistory ? (
            <p style={{ color: 'var(--text-muted)' }}>Loading...</p>
          ) : (
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Month</th>
                    <th>Amount</th>
                    <th>Method</th>
                    <th>Bank</th>
                    <th>Date Recorded</th>
                    {isAdmin && <th>Action</th>}
                  </tr>
                </thead>
                <tbody>
                  {salaryHistory.length === 0 ? (
                    <tr><td colSpan={isAdmin ? 6 : 5} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>No salary payments recorded</td></tr>
                  ) : salaryHistory.map(sp => (
                    <tr key={sp.id}>
                      <td>{formatMonth(sp.salary_month)}</td>
                      <td>Rs {fmt(sp.amount)}</td>
                      <td><span className={`badge ${sp.payment_method === 'CASH' ? 'badge-success' : 'badge-info'}`}>{sp.payment_method}</span></td>
                      <td>{sp.bank_name || '—'}</td>
                      <td>{new Date(sp.created_at).toLocaleDateString('en-PK')}</td>
                      {isAdmin && (
                        <td>
                          <button className="btn btn-sm" style={{ background: '#fee2e2', color: '#dc2626', border: 'none' }}
                            onClick={() => setDeleteTarget(sp)}>Delete</button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirm */}
      {deleteTarget && (
        <div className="modal-overlay" onClick={() => setDeleteTarget(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 400 }}>
            <div className="modal-header">
              <h3>Delete Salary Payment</h3>
              <button className="modal-close" onClick={() => setDeleteTarget(null)}>✕</button>
            </div>
            <div className="modal-body">
              <p>Delete salary payment of Rs {fmt(deleteTarget.amount)} for {formatMonth(deleteTarget.salary_month)}?
                The cash/bank balance will be reversed and the khata entry removed.</p>
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
