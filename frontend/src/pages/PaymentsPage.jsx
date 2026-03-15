import { useEffect, useState } from 'react';
import api from '../services/api';
import { useToast } from '../context/ToastContext';
import DocumentActionModal from '../components/DocumentActionModal';

function fmt(n) { return Number(n || 0).toLocaleString(); }

export default function PaymentsPage() {
  const [payments, setPayments] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [banks, setBanks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [partyType, setPartyType] = useState('customer');
  const [form, setForm] = useState({ party_id: '', amount: '', payment_method: 'CASH', bank_account_id: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const [docModal, setDocModal] = useState(null);
  const toast = useToast();

  const load = () => {
    Promise.all([api.get('/payments'), api.get('/customers'), api.get('/suppliers'), api.get('/banks')])
      .then(([p, c, s, b]) => {
        setPayments(p.data.payments || []); setCustomers(c.data.customers || []);
        setSuppliers(s.data.suppliers || []); setBanks(b.data.banks || []);
      }).catch(console.error).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const openForm = (type) => { setPartyType(type); setForm({ party_id: '', amount: '', payment_method: 'CASH', bank_account_id: '', notes: '' }); setShowForm(true); };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.party_id || !form.amount) { toast('Fill all required fields', 'error'); return; }
    setSaving(true);
    try {
      const endpoint = partyType === 'customer' ? '/payments/customer' : '/payments/supplier';
      const payload = {
        [`${partyType}_id`]: Number(form.party_id),
        amount: Number(form.amount),
        payment_method: form.payment_method,
        bank_id: form.bank_account_id ? Number(form.bank_account_id) : null,
        notes: form.notes,
      };
      const res = await api.post(endpoint, payload);
      const payment = res.data.payment;
      toast(`Payment ${payment.voucher_number} recorded`, 'success');
      setDocModal({ type: 'payment', id: payment.id, number: payment.voucher_number });
      setShowForm(false); load();
    } catch (err) {
      toast(err.response?.data?.error?.message || 'Failed to record payment', 'error');
    } finally { setSaving(false); }
  };

  const parties = partyType === 'customer' ? customers : suppliers;

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Payments</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-primary" onClick={() => openForm('customer')}>+ Customer Payment</button>
          <button className="btn btn-secondary" onClick={() => openForm('supplier')}>+ Supplier Payment</button>
        </div>
      </div>

      <div className="card">
        <div className="card-body" style={{ padding: 0 }}>
          {loading ? <div style={{ padding: 24, textAlign: 'center' }}>Loading...</div> : (
            <table className="table">
              <thead><tr><th>Voucher</th><th>Date</th><th>Type</th><th>Party</th><th>Amount</th><th>Method</th></tr></thead>
              <tbody>
                {payments.length === 0 && <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No payments yet</td></tr>}
                {payments.map(p => (
                  <tr key={p.id}>
                    <td><span className="badge badge-info">{p.voucher_number}</span></td>
                    <td>{new Date(p.created_at).toLocaleDateString()}</td>
                    <td><span className={`badge ${p.type === 'CUSTOMER_PAYMENT' ? 'badge-success' : 'badge-warning'}`}>{p.type === 'CUSTOMER_PAYMENT' ? 'RECEIVED' : 'PAID'}</span></td>
                    <td>—</td>
                    <td>Rs {fmt(p.amount)}</td>
                    <td><span className="badge badge-secondary">{p.payment_method}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">{partyType === 'customer' ? 'Customer Payment Received' : 'Supplier Payment Made'}</h3>
              <button className="modal-close" onClick={() => setShowForm(false)}>✕</button>
            </div>
            <form onSubmit={handleSave}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">{partyType === 'customer' ? 'Customer' : 'Supplier'} *</label>
                  <select className="form-select" value={form.party_id} onChange={e => setForm(f => ({ ...f, party_id: e.target.value }))} required>
                    <option value="">-- Select --</option>
                    {parties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Amount (Rs) *</label>
                  <input className="form-input" type="number" min="1" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Payment Method</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {['CASH', 'BANK'].map(m => (
                      <button key={m} type="button" className={`btn ${form.payment_method === m ? 'btn-primary' : 'btn-secondary'} btn-sm`} onClick={() => setForm(f => ({ ...f, payment_method: m }))}>{m}</button>
                    ))}
                  </div>
                </div>
                {form.payment_method === 'BANK' && (
                  <div className="form-group">
                    <label className="form-label">Bank Account</label>
                    <select className="form-select" value={form.bank_account_id} onChange={e => setForm(f => ({ ...f, bank_account_id: e.target.value }))}>
                      <option value="">-- Select Bank --</option>
                      {banks.map(b => <option key={b.id} value={b.id}>{b.bank_name} — {b.account_number}</option>)}
                    </select>
                  </div>
                )}
                <div className="form-group">
                  <label className="form-label">Notes</label>
                  <input className="form-input" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Record Payment'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {docModal && (
        <DocumentActionModal type={docModal.type} id={docModal.id} number={docModal.number} onClose={() => setDocModal(null)} />
      )}
    </div>
  );
}
