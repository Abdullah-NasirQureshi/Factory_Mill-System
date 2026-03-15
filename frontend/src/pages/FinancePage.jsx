import { useEffect, useState } from 'react';
import api from '../services/api';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';

function fmt(n) { return Number(n || 0).toLocaleString(); }

export default function FinancePage() {
  const [cash, setCash] = useState(null);
  const [banks, setBanks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showBankForm, setShowBankForm] = useState(false);
  const [bankForm, setBankForm] = useState({ bank_name: '', account_number: '', account_title: '', balance: '' });
  const [editBankId, setEditBankId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [cashEdit, setCashEdit] = useState(false);
  const [newCash, setNewCash] = useState('');
  const toast = useToast();
  const { user } = useAuth();

  const load = () => {
    Promise.all([api.get('/cash'), api.get('/banks')])
      .then(([c, b]) => { setCash(c.data.cash); setBanks(b.data.banks || []); })
      .catch(console.error).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const handleCashUpdate = async () => {
    try {
      await api.put('/cash/balance', { balance: Number(newCash) });
      toast('Cash balance updated', 'success');
      setCashEdit(false); load();
    } catch (err) { toast(err.response?.data?.error?.message || 'Failed', 'error'); }
  };

  const openBankAdd = () => { setBankForm({ bank_name: '', account_number: '', account_title: '', balance: '' }); setEditBankId(null); setShowBankForm(true); };
  const openBankEdit = (b) => { setBankForm({ bank_name: b.bank_name, account_number: b.account_number, account_title: b.account_title || '', balance: b.balance }); setEditBankId(b.id); setShowBankForm(true); };

  const handleBankSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editBankId) { await api.put(`/banks/${editBankId}`, bankForm); toast('Bank updated', 'success'); }
      else { await api.post('/banks', bankForm); toast('Bank added', 'success'); }
      setShowBankForm(false); load();
    } catch (err) { toast(err.response?.data?.error?.message || 'Failed', 'error'); }
    finally { setSaving(false); }
  };

  const handleBankDelete = async (id) => {
    if (!confirm('Delete this bank account? This will fail if the account has a non-zero balance or associated transactions.')) return;
    try {
      await api.delete(`/banks/${id}`);
      toast('Bank account deleted', 'success'); load();
    } catch (err) { toast(err.response?.data?.error?.message || 'Cannot delete', 'error'); }
  };

  if (loading) return <div className="loading-screen"><div className="spinner" /></div>;

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Finance</h1>
        {user?.role === 'ADMIN' && (
          <button className="btn btn-primary" onClick={openBankAdd}>+ Add Bank Account</button>
        )}
      </div>

      {/* Cash */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <span className="card-title">Cash Account</span>
          {!cashEdit && user?.role === 'ADMIN' && (
            <button className="btn btn-secondary btn-sm" onClick={() => { setNewCash(cash?.balance || 0); setCashEdit(true); }}>Set Balance</button>
          )}
        </div>
        <div className="card-body">
          {cashEdit ? (
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <input className="form-input" type="number" value={newCash} onChange={e => setNewCash(e.target.value)} style={{ maxWidth: 200 }} />
              <button className="btn btn-primary btn-sm" onClick={handleCashUpdate}>Save</button>
              <button className="btn btn-secondary btn-sm" onClick={() => setCashEdit(false)}>Cancel</button>
            </div>
          ) : (
            <div className="stat-value">Rs {fmt(cash?.balance)}</div>
          )}
        </div>
      </div>

      {/* Banks */}
      <div className="card">
        <div className="card-header"><span className="card-title">Bank Accounts</span></div>
        <div className="card-body" style={{ padding: 0 }}>
          <table className="table">
            <thead><tr><th>Bank</th><th>Account #</th><th>Title</th><th>Balance</th><th>Actions</th></tr></thead>
            <tbody>
              {banks.length === 0 && <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No bank accounts</td></tr>}
              {banks.map(b => (
                <tr key={b.id}>
                  <td>{b.bank_name}</td>
                  <td>{b.account_number}</td>
                  <td>{b.account_title || '—'}</td>
                  <td>Rs {fmt(b.balance)}</td>
                  <td style={{ display: 'flex', gap: 8 }}>
                    {user?.role === 'ADMIN' && (
                      <>
                        <button className="btn btn-secondary btn-sm" onClick={() => openBankEdit(b)}>Edit</button>
                        <button className="btn btn-danger btn-sm" onClick={() => handleBankDelete(b.id)}>Delete</button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showBankForm && (
        <div className="modal-overlay" onClick={() => setShowBankForm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">{editBankId ? 'Edit Bank Account' : 'Add Bank Account'}</h3>
              <button className="modal-close" onClick={() => setShowBankForm(false)}>✕</button>
            </div>
            <form onSubmit={handleBankSave}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Bank Name *</label>
                  <input className="form-input" value={bankForm.bank_name} onChange={e => setBankForm(f => ({ ...f, bank_name: e.target.value }))} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Account Number *</label>
                  <input className="form-input" value={bankForm.account_number} onChange={e => setBankForm(f => ({ ...f, account_number: e.target.value }))} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Account Title</label>
                  <input className="form-input" value={bankForm.account_title} onChange={e => setBankForm(f => ({ ...f, account_title: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Opening Balance</label>
                  <input className="form-input" type="number" min="0" value={bankForm.balance} onChange={e => setBankForm(f => ({ ...f, balance: e.target.value }))} />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowBankForm(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
