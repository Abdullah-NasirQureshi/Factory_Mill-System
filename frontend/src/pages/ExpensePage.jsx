import { useEffect, useState, useMemo, useRef } from 'react';
import api from '../services/api';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';

function fmt(n) { return Number(n || 0).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function today() { return new Date().toISOString().slice(0, 10); }
function monthStart() { const d = new Date(); d.setDate(1); return d.toISOString().slice(0, 10); }

// ─── Searchable Group→Khata Combobox ─────────────────────────────────────────
function ExpenseCombobox({ groups, value, onChange }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  // Flatten to options list
  const options = useMemo(() => {
    const list = [];
    (groups || []).forEach(g => {
      if (!g.is_active) return;
      (g.khatas || []).forEach(k => {
        if (!k.is_active) return;
        list.push({ group_id: g.id, group_name: g.name, khata_id: k.id, khata_name: k.name,
                    label: `${g.name} → ${k.name}` });
      });
    });
    return list;
  }, [groups]);

  const filtered = query
    ? options.filter(o => o.label.toLowerCase().includes(query.toLowerCase()))
    : options;

  const selected = options.find(o => o.khata_id === value?.khata_id);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const select = (opt) => {
    onChange(opt);
    setQuery('');
    setOpen(false);
  };

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <input
        className="form-input"
        placeholder="Search Group → Khata..."
        value={open ? query : (selected?.label || '')}
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
            : filtered.map(o => (
              <div key={o.khata_id}
                style={{ padding: '9px 14px', cursor: 'pointer', fontSize: 14,
                         background: value?.khata_id === o.khata_id ? '#eff6ff' : '#ffffff',
                         borderBottom: '1px solid #f1f5f9' }}
                onMouseDown={() => select(o)}
                onMouseEnter={e => e.currentTarget.style.background = '#f1f5f9'}
                onMouseLeave={e => e.currentTarget.style.background = value?.khata_id === o.khata_id ? '#eff6ff' : '#ffffff'}>
                <span style={{ color: '#94a3b8', fontSize: 12 }}>{o.group_name} →</span>{' '}
                <strong style={{ color: '#1e293b' }}>{o.khata_name}</strong>
              </div>
            ))
          }
        </div>
      )}
    </div>
  );
}


// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ExpensePage() {
  const { user } = useAuth();
  const toast = useToast();
  const isAdmin = user?.role === 'ADMIN';

  // Data
  const [groups, setGroups] = useState([]);
  const [banks, setBanks] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [filters, setFilters] = useState({ from: monthStart(), to: today(), group_id: '', khata_id: '' });

  // Entry form
  const emptyForm = { khata: null, description: '', amount: '', payment_method: 'CASH', bank_id: '', expense_date: today() };
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  // Category management modal
  const [showCatMgr, setShowCatMgr] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newKhata, setNewKhata] = useState({ group_id: '', name: '' });
  const [catSaving, setCatSaving] = useState(false);

  const loadGroups = () => api.get('/expenses/groups').then(r => setGroups(r.data.groups || []));
  const loadBanks  = () => api.get('/banks').then(r => setBanks(r.data.banks || []));

  const loadExpenses = () => {
    const params = new URLSearchParams();
    if (filters.from)     params.set('from', filters.from);
    if (filters.to)       params.set('to', filters.to);
    if (filters.group_id) params.set('group_id', filters.group_id);
    if (filters.khata_id) params.set('khata_id', filters.khata_id);
    return api.get(`/expenses?${params}`).then(r => setExpenses(r.data.expenses || []));
  };

  useEffect(() => {
    Promise.all([loadGroups(), loadBanks(), loadExpenses()])
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // Re-fetch expenses when filters change
  useEffect(() => { loadExpenses().catch(console.error); }, [filters]);

  // Summary cards
  const summary = useMemo(() => {
    const total = expenses.reduce((s, e) => s + parseFloat(e.amount), 0);
    const cash  = expenses.filter(e => e.payment_method === 'CASH').reduce((s, e) => s + parseFloat(e.amount), 0);
    const bank  = expenses.filter(e => e.payment_method === 'BANK').reduce((s, e) => s + parseFloat(e.amount), 0);
    return { total, cash, bank, count: expenses.length };
  }, [expenses]);

  // Khatas for selected filter group
  const filterKhatas = useMemo(() => {
    if (!filters.group_id) return [];
    const g = groups.find(g => String(g.id) === String(filters.group_id));
    return g?.khatas?.filter(k => k.is_active) || [];
  }, [filters.group_id, groups]);

  // ── Submit expense ──────────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.khata) { toast('Select a Group → Khata', 'error'); return; }
    if (!form.amount || Number(form.amount) <= 0) { toast('Enter a valid amount', 'error'); return; }
    if (form.payment_method === 'BANK' && !form.bank_id) { toast('Select a bank account', 'error'); return; }
    setSaving(true);
    try {
      await api.post('/expenses', {
        group_id: form.khata.group_id,
        khata_id: form.khata.khata_id,
        description: form.description,
        amount: Number(form.amount),
        payment_method: form.payment_method,
        bank_id: form.payment_method === 'BANK' ? Number(form.bank_id) : null,
        expense_date: form.expense_date,
      });
      toast('Expense recorded', 'success');
      setForm(emptyForm);
      loadExpenses();
    } catch (err) {
      toast(err.response?.data?.error?.message || 'Failed to save expense', 'error');
    } finally { setSaving(false); }
  };

  // ── Delete expense ──────────────────────────────────────────────────────────
  const handleDelete = async (id) => {
    if (!confirm('Delete this expense? The balance will be reversed.')) return;
    try {
      await api.delete(`/expenses/${id}`);
      toast('Expense deleted', 'success');
      loadExpenses();
    } catch (err) {
      toast(err.response?.data?.error?.message || 'Delete failed', 'error');
    }
  };

  // ── Category management ─────────────────────────────────────────────────────
  const handleAddGroup = async (e) => {
    e.preventDefault();
    if (!newGroupName.trim()) return;
    setCatSaving(true);
    try {
      await api.post('/expenses/groups', { name: newGroupName.trim() });
      toast('Group added', 'success');
      setNewGroupName('');
      loadGroups();
    } catch (err) {
      toast(err.response?.data?.error?.message || 'Failed', 'error');
    } finally { setCatSaving(false); }
  };

  const handleAddKhata = async (e) => {
    e.preventDefault();
    if (!newKhata.group_id || !newKhata.name.trim()) return;
    setCatSaving(true);
    try {
      await api.post('/expenses/khatas', { group_id: Number(newKhata.group_id), name: newKhata.name.trim() });
      toast('Khata added', 'success');
      setNewKhata({ group_id: newKhata.group_id, name: '' });
      loadGroups();
    } catch (err) {
      toast(err.response?.data?.error?.message || 'Failed', 'error');
    } finally { setCatSaving(false); }
  };

  const deleteGroup = async (g) => {
    if (!confirm(`Delete group "${g.name}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/expenses/groups/${g.id}`);
      toast('Group deleted', 'success');
      loadGroups();
    } catch (err) { toast(err.response?.data?.error?.message || 'Failed', 'error'); }
  };

  const deleteKhata = async (k) => {
    if (!confirm(`Delete khata "${k.name}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/expenses/khatas/${k.id}`);
      toast('Khata deleted', 'success');
      loadGroups();
    } catch (err) { toast(err.response?.data?.error?.message || 'Failed', 'error'); }
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Expenses</h1>
        {isAdmin && (
          <button className="btn btn-secondary" onClick={() => setShowCatMgr(true)}>
            Manage Categories
          </button>
        )}
      </div>

      {/* Summary Cards */}
      <div className="stats-grid" style={{ marginBottom: 24 }}>
        <div className="stat-card">
          <div className="stat-label">Total Expenses</div>
          <div className="stat-value">Rs {fmt(summary.total)}</div>
          <div className="stat-change">{summary.count} transactions</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Cash Expenses</div>
          <div className="stat-value">Rs {fmt(summary.cash)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Bank Expenses</div>
          <div className="stat-value">Rs {fmt(summary.bank)}</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.6fr', gap: 20, alignItems: 'start' }}>

        {/* ── Entry Form ── */}
        <div className="card">
          <div className="card-header"><h3 className="card-title">Record Expense</h3></div>
          <div className="card-body">
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Date</label>
                <input className="form-input" type="date" value={form.expense_date}
                  onChange={e => setForm(f => ({ ...f, expense_date: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Account (Group → Khata) *</label>
                <ExpenseCombobox groups={groups} value={form.khata}
                  onChange={k => setForm(f => ({ ...f, khata: k }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Description</label>
                <input className="form-input" placeholder="Optional note..." value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Amount (Rs) *</label>
                <input className="form-input" type="number" min="1" step="0.01" placeholder="0.00"
                  value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Payment Method</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {['CASH', 'BANK'].map(m => (
                    <button key={m} type="button"
                      className={`btn btn-sm ${form.payment_method === m ? 'btn-primary' : 'btn-secondary'}`}
                      onClick={() => setForm(f => ({ ...f, payment_method: m, bank_id: '' }))}>
                      {m}
                    </button>
                  ))}
                </div>
              </div>
              {form.payment_method === 'BANK' && (
                <div className="form-group">
                  <label className="form-label">Bank Account *</label>
                  <select className="form-select" value={form.bank_id}
                    onChange={e => setForm(f => ({ ...f, bank_id: e.target.value }))} required>
                    <option value="">-- Select Bank --</option>
                    {banks.map(b => <option key={b.id} value={b.id}>{b.bank_name} — {b.account_number}</option>)}
                  </select>
                </div>
              )}
              <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={saving}>
                {saving ? 'Saving...' : 'Record Expense'}
              </button>
            </form>
          </div>
        </div>

        {/* ── Filters + Table ── */}
        <div>
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-body" style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div className="form-group" style={{ margin: 0, flex: '1 1 120px' }}>
                <label className="form-label">From</label>
                <input className="form-input" type="date" value={filters.from}
                  onChange={e => setFilters(f => ({ ...f, from: e.target.value }))} />
              </div>
              <div className="form-group" style={{ margin: 0, flex: '1 1 120px' }}>
                <label className="form-label">To</label>
                <input className="form-input" type="date" value={filters.to}
                  onChange={e => setFilters(f => ({ ...f, to: e.target.value }))} />
              </div>
              <div className="form-group" style={{ margin: 0, flex: '1 1 140px' }}>
                <label className="form-label">Group</label>
                <select className="form-select" value={filters.group_id}
                  onChange={e => setFilters(f => ({ ...f, group_id: e.target.value, khata_id: '' }))}>
                  <option value="">All Groups</option>
                  {groups.filter(g => g.is_active).map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              </div>
              {filterKhatas.length > 0 && (
                <div className="form-group" style={{ margin: 0, flex: '1 1 140px' }}>
                  <label className="form-label">Khata</label>
                  <select className="form-select" value={filters.khata_id}
                    onChange={e => setFilters(f => ({ ...f, khata_id: e.target.value }))}>
                    <option value="">All Khatas</option>
                    {filterKhatas.map(k => <option key={k.id} value={k.id}>{k.name}</option>)}
                  </select>
                </div>
              )}
            </div>
          </div>

          <div className="card">
            <div className="card-body" style={{ padding: 0 }}>
              {loading ? (
                <div style={{ padding: 32, textAlign: 'center' }}><div className="spinner" /></div>
              ) : (
                <table className="table">
                  <thead>
                    <tr>
                      <th>Date</th><th>Account</th><th>Description</th>
                      <th>Method</th><th style={{ textAlign: 'right' }}>Amount</th>
                      {isAdmin && <th></th>}
                    </tr>
                  </thead>
                  <tbody>
                    {expenses.length === 0 && (
                      <tr><td colSpan={isAdmin ? 6 : 5} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 24 }}>
                        No expenses found
                      </td></tr>
                    )}
                    {expenses.map(e => (
                      <tr key={e.id}>
                        <td style={{ whiteSpace: 'nowrap' }}>{new Date(e.expense_date).toLocaleDateString()}</td>
                        <td>
                          <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{e.group_name} →</span>{' '}
                          <strong>{e.khata_name}</strong>
                        </td>
                        <td style={{ color: 'var(--text-muted)', fontSize: 13 }}>{e.description || '—'}</td>
                        <td>
                          <span className={`badge ${e.payment_method === 'CASH' ? 'badge-success' : 'badge-info'}`}>
                            {e.payment_method}{e.bank_name ? ` · ${e.bank_name}` : ''}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 600 }}>Rs {fmt(e.amount)}</td>
                        {isAdmin && (
                          <td>
                            <button className="btn btn-danger btn-sm" onClick={() => handleDelete(e.id)}>🗑️</button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                  {expenses.length > 0 && (
                    <tfoot>
                      <tr style={{ fontWeight: 700, background: 'var(--bg-secondary, #f8fafc)' }}>
                        <td colSpan={isAdmin ? 4 : 3} style={{ textAlign: 'right', paddingRight: 12 }}>Total</td>
                        <td style={{ textAlign: 'right' }}>Rs {fmt(summary.total)}</td>
                        {isAdmin && <td />}
                      </tr>
                    </tfoot>
                  )}
                </table>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Category Management Modal ── */}
      {showCatMgr && (
        <div className="modal-overlay" onClick={() => setShowCatMgr(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 560, maxHeight: '85vh', overflowY: 'auto' }}>
            <div className="modal-header">
              <h3 className="modal-title">Manage Categories</h3>
              <button className="modal-close" onClick={() => setShowCatMgr(false)}>✕</button>
            </div>
            <div className="modal-body">

              {/* Add Group */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontWeight: 600, marginBottom: 8 }}>Add New Group</div>
                <form onSubmit={handleAddGroup} style={{ display: 'flex', gap: 8 }}>
                  <input className="form-input" placeholder="Group name..." value={newGroupName}
                    onChange={e => setNewGroupName(e.target.value)} style={{ flex: 1 }} />
                  <button type="submit" className="btn btn-primary btn-sm" disabled={catSaving}>Add</button>
                </form>
              </div>

              {/* Add Khata */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontWeight: 600, marginBottom: 8 }}>Add New Khata</div>
                <form onSubmit={handleAddKhata} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <select className="form-select" value={newKhata.group_id} style={{ flex: '1 1 160px' }}
                    onChange={e => setNewKhata(k => ({ ...k, group_id: e.target.value }))}>
                    <option value="">-- Select Group --</option>
                    {groups.filter(g => g.is_active).map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                  </select>
                  <input className="form-input" placeholder="Khata name..." value={newKhata.name} style={{ flex: '1 1 160px' }}
                    onChange={e => setNewKhata(k => ({ ...k, name: e.target.value }))} />
                  <button type="submit" className="btn btn-primary btn-sm" disabled={catSaving}>Add</button>
                </form>
              </div>

              {/* Groups list */}
              <div style={{ fontWeight: 600, marginBottom: 8 }}>All Groups & Khatas</div>
              {groups.length === 0 && <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>No categories yet</div>}
              {groups.map(g => (
                <div key={g.id} style={{ marginBottom: 12, border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
                  <div style={{ display: 'flex', alignItems: 'center', padding: '8px 12px',
                                background: 'var(--bg-secondary, #f8fafc)', gap: 8 }}>
                    <span style={{ flex: 1, fontWeight: 600 }}>{g.name}</span>
                    <button className="btn btn-danger btn-sm" onClick={() => deleteGroup(g)}>Delete</button>
                  </div>
                  {(g.khatas || []).map(k => (
                    <div key={k.id} style={{ display: 'flex', alignItems: 'center', padding: '6px 12px 6px 24px',
                                            borderTop: '1px solid var(--border)', gap: 8 }}>
                      <span style={{ flex: 1, fontSize: 13 }}>{k.name}</span>
                      <button className="btn btn-danger btn-sm" onClick={() => deleteKhata(k)}>Delete</button>
                    </div>
                  ))}
                  {(g.khatas || []).length === 0 && (
                    <div style={{ padding: '6px 24px', fontSize: 12, color: 'var(--text-muted)' }}>No khatas yet</div>
                  )}
                </div>
              ))}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowCatMgr(false)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
