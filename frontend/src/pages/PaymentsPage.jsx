import { useEffect, useState } from 'react';
import api from '../services/api';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import DocumentActionModal from '../components/DocumentActionModal';
import InvoiceView from '../components/InvoiceView';

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
  const [detailPayment, setDetailPayment] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [reverting, setReverting] = useState(false);
  const [showVoucher, setShowVoucher] = useState(false);
  const toast = useToast();
  const { user } = useAuth();

  const load = () => {
    Promise.all([api.get('/payments'), api.get('/customers'), api.get('/suppliers'), api.get('/banks')])
      .then(([p, c, s, b]) => {
        setPayments(p.data.payments || []);
        setCustomers(c.data.customers || []);
        setSuppliers(s.data.suppliers || []);
        setBanks(b.data.banks || []);
      }).catch(console.error).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const openForm = (type) => {
    setPartyType(type);
    setForm({ party_id: '', amount: '', payment_method: 'CASH', bank_account_id: '', notes: '' });
    setShowForm(true);
  };

  const openDetail = async (id) => {
    setDetailLoading(true);
    setShowVoucher(false);
    setDetailPayment(null);
    try {
      const res = await api.get(`/payments/${id}/voucher`);
      setDetailPayment(res.data.voucher);
    } catch (err) {
      toast('Failed to load payment details', 'error');
    } finally {
      setDetailLoading(false);
    }
  };

  const handleRevert = async () => {
    if (!detailPayment) return;
    if (!confirm('Revert this payment? This will reverse the cash/bank balance change and remove payment allocations.')) return;
    setReverting(true);
    try {
      await api.post(`/payments/${detailPayment.payment.id}/revert`);
      toast('Payment reverted successfully', 'success');
      setDetailPayment(null);
      load();
    } catch (err) {
      toast(err.response?.data?.error?.message || 'Revert failed', 'error');
    } finally {
      setReverting(false);
    }
  };

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
      setShowForm(false);
      load();
    } catch (err) {
      toast(err.response?.data?.error?.message || 'Failed to record payment', 'error');
    } finally { setSaving(false); }
  };

  const parties = partyType === 'customer' ? customers : suppliers;

  if (showVoucher && detailPayment) {
    return <InvoiceView type="payment" data={detailPayment} onClose={() => setShowVoucher(false)} />;
  }

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
              <thead>
                <tr><th>Voucher</th><th>Date</th><th>Type</th><th>Party</th><th>Amount</th><th>Method</th><th>Status</th></tr>
              </thead>
              <tbody>
                {payments.length === 0 && (
                  <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No payments yet</td></tr>
                )}
                {payments.map(p => (
                  <tr key={p.id} style={{ cursor: 'pointer' }} onClick={() => openDetail(p.id)}>
                    <td><span className="badge badge-info">{p.voucher_number}</span></td>
                    <td>{new Date(p.created_at).toLocaleDateString()}</td>
                    <td>
                      <span className={`badge ${p.type === 'CUSTOMER_PAYMENT' ? 'badge-success' : 'badge-warning'}`}>
                        {p.type === 'CUSTOMER_PAYMENT' ? 'RECEIVED' : 'PAID'}
                      </span>
                    </td>
                    <td>{p.party_name || '—'}</td>
                    <td>Rs {fmt(p.amount)}</td>
                    <td>
                      <span className="badge badge-secondary">
                        {p.payment_method}{p.bank_name ? ` · ${p.bank_name}` : ''}
                      </span>
                    </td>
                    <td>
                      {p.status === 'REVERTED'
                        ? <span className="badge badge-danger">REVERTED</span>
                        : <span className="badge badge-success">ACTIVE</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Payment Detail Modal */}
      {(detailPayment || detailLoading) && (
        <div className="modal-overlay" onClick={() => { setDetailPayment(null); setDetailLoading(false); }}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 520 }}>
            {detailLoading ? (
              <div style={{ padding: 32, textAlign: 'center' }}><div className="spinner" /></div>
            ) : detailPayment && (
              <>
                <div className="modal-header">
                  <h3 className="modal-title">{detailPayment.payment.voucher_number}</h3>
                  <button className="modal-close" onClick={() => setDetailPayment(null)}>✕</button>
                </div>
                <div className="modal-body">
                  {detailPayment.payment.status === 'REVERTED' && (
                    <div className="alert alert-danger" style={{ marginBottom: 16 }}>
                      This payment has been reverted.
                    </div>
                  )}
                  <table className="table">
                    <tbody>
                      <tr><td>Party</td><td><strong>{detailPayment.payment.party_name || '—'}</strong></td></tr>
                      <tr><td>Type</td><td>
                        <span className={`badge ${detailPayment.payment.type === 'CUSTOMER_PAYMENT' ? 'badge-success' : 'badge-warning'}`}>
                          {detailPayment.payment.type === 'CUSTOMER_PAYMENT' ? 'Customer Payment' : 'Supplier Payment'}
                        </span>
                      </td></tr>
                      <tr><td>Amount</td><td><strong>Rs {fmt(detailPayment.payment.amount)}</strong></td></tr>
                      <tr><td>Method</td><td>
                        {detailPayment.payment.payment_method}
                        {detailPayment.payment.bank_name ? ` — ${detailPayment.payment.bank_name}` : ''}
                      </td></tr>
                      <tr><td>Date</td><td>{new Date(detailPayment.payment.created_at).toLocaleString()}</td></tr>
                      {detailPayment.payment.notes && (
                        <tr><td>Notes</td><td>{detailPayment.payment.notes}</td></tr>
                      )}
                    </tbody>
                  </table>
                  {detailPayment.allocations?.length > 0 && (
                    <div style={{ marginTop: 12 }}>
                      <div style={{ fontWeight: 600, marginBottom: 6, fontSize: 13 }}>Allocations</div>
                      <table className="table">
                        <thead><tr><th>Reference</th><th>Allocated</th></tr></thead>
                        <tbody>
                          {detailPayment.allocations.map((a, i) => (
                            <tr key={i}>
                              <td>{a.reference_type} #{a.reference_id}</td>
                              <td>Rs {fmt(a.allocated_amount)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
                <div className="modal-footer">
                  <button className="btn btn-secondary" onClick={() => setShowVoucher(true)}>View Voucher</button>
                  <div style={{ flex: 1 }} />
                  {detailPayment.payment.status !== 'REVERTED' && (
                    <button className="btn btn-danger" onClick={handleRevert} disabled={reverting}>
                      {reverting ? 'Reverting...' : 'Revert Payment'}
                    </button>
                  )}
                  <button className="btn btn-secondary" onClick={() => setDetailPayment(null)}>Close</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* New Payment Form */}
      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">
                {partyType === 'customer' ? 'Customer Payment Received' : 'Supplier Payment Made'}
              </h3>
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
                      <button key={m} type="button"
                        className={`btn ${form.payment_method === m ? 'btn-primary' : 'btn-secondary'} btn-sm`}
                        onClick={() => setForm(f => ({ ...f, payment_method: m }))}>
                        {m}
                      </button>
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
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Saving...' : 'Record Payment'}
                </button>
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
