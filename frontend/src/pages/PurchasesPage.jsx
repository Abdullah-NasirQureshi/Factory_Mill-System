import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useToast } from '../context/ToastContext';
import DocumentActionModal from '../components/DocumentActionModal';

function fmt(n) { return Number(n || 0).toLocaleString(); }

export default function PurchasesPage() {
  const [purchases, setPurchases] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [weights, setWeights] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [docModal, setDocModal] = useState(null);
  const toast = useToast();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    supplier_id: '', purchase_date: new Date().toISOString().slice(0, 10),
    items: [{ product_name: '', quantity: 1, unit_price: '' }],
    payment_method: 'NONE', amount_paid: '', bank_account_id: '', notes: '',
  });
  const [banks, setBanks] = useState([]);

  const load = () => {
    Promise.all([
      api.get('/purchases'), api.get('/suppliers'), api.get('/products'),
      api.get('/weights'), api.get('/banks'),
    ]).then(([p, s, pr, w, b]) => {
      setPurchases(p.data.purchases || []); setSuppliers(s.data.suppliers || []);
      setProducts(pr.data.products || []); setWeights(w.data.weights || []);
      setBanks(b.data.banks || []);
    }).catch(console.error).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const addItem = () => setForm(f => ({ ...f, items: [...f.items, { product_name: '', quantity: 1, unit_price: '' }] }));
  const removeItem = (i) => setForm(f => ({ ...f, items: f.items.filter((_, idx) => idx !== i) }));
  const updateItem = (i, field, val) => setForm(f => ({ ...f, items: f.items.map((item, idx) => idx === i ? { ...item, [field]: val } : item) }));

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.supplier_id) { toast('Select a supplier', 'error'); return; }
    setSaving(true);
    try {
      const res = await api.post('/purchases', {
        supplier_id: Number(form.supplier_id),
        purchase_date: form.purchase_date,
        items: form.items.map(i => ({ product_name: i.product_name, quantity: Number(i.quantity), unit_price: Number(i.unit_price) })),
        payment_method: form.payment_method,
        payment_amount: Number(form.amount_paid) || 0,
        bank_id: form.bank_account_id ? Number(form.bank_account_id) : null,
        notes: form.notes,
      });
      const purchase = res.data.purchase;
      toast(`Purchase ${purchase.invoice_number} recorded`, 'success');
      setDocModal({ type: 'purchase', id: purchase.id, number: purchase.invoice_number });
      setShowForm(false);
      setForm({ supplier_id: '', purchase_date: new Date().toISOString().slice(0, 10), items: [{ product_name: '', quantity: 1, unit_price: '' }], payment_method: 'NONE', amount_paid: '', bank_account_id: '', notes: '' });
      load();
    } catch (err) {
      toast(err.response?.data?.error?.message || 'Failed to save', 'error');
    } finally { setSaving(false); }
  };

  const filtered = purchases.filter(p =>
    p.invoice_number?.toLowerCase().includes(search.toLowerCase()) ||
    p.supplier_name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Purchases</h1>
        <button className="btn btn-primary" onClick={() => setShowForm(true)}>+ New Purchase</button>
      </div>
      <div className="card">
        <div className="card-header">
          <input className="form-input" style={{ maxWidth: 300 }} placeholder="Search invoice or supplier..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="card-body" style={{ padding: 0 }}>
          {loading ? <div style={{ padding: 24, textAlign: 'center' }}>Loading...</div> : (
            <table className="table">
              <thead><tr><th>Invoice</th><th>Date</th><th>Supplier</th><th>Total</th><th>Paid</th><th>Remaining</th><th>Status</th></tr></thead>
              <tbody>
                {filtered.length === 0 && <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No purchases found</td></tr>}
                {filtered.map(p => (
                  <tr key={p.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/purchases/${p.id}`)}>
                    <td><span className="badge badge-info">{p.invoice_number}</span></td>
                    <td>{new Date(p.created_at).toLocaleDateString()}</td>
                    <td>{p.supplier_name}</td>
                    <td>Rs {fmt(p.total_amount)}</td>
                    <td>Rs {fmt(p.paid_amount)}</td>
                    <td>Rs {fmt(p.remaining_amount)}</td>
                    <td><span className={`badge ${p.remaining_amount == 0 ? 'badge-success' : p.paid_amount > 0 ? 'badge-warning' : 'badge-danger'}`}>{p.remaining_amount == 0 ? 'PAID' : p.paid_amount > 0 ? 'PARTIAL' : 'UNPAID'}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">New Purchase</h3>
              <button className="modal-close" onClick={() => setShowForm(false)}>✕</button>
            </div>
            <form onSubmit={handleSave}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Supplier *</label>
                  <select className="form-select" value={form.supplier_id} onChange={e => setForm(f => ({ ...f, supplier_id: e.target.value }))} required>
                    <option value="">-- Select Supplier --</option>
                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Purchase Date *</label>
                  <input className="form-input" type="date" value={form.purchase_date} onChange={e => setForm(f => ({ ...f, purchase_date: e.target.value }))} required />
                </div>
                <div style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <label className="form-label" style={{ margin: 0 }}>Items</label>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={addItem}>+ Add Item</button>
                  </div>
                  {form.items.map((item, i) => (
                    <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 80px 100px auto', gap: 8, marginBottom: 8, alignItems: 'end' }}>
                      <input className="form-input" placeholder="Product name" value={item.product_name} onChange={e => updateItem(i, 'product_name', e.target.value)} required />
                      <input className="form-input" type="number" min="1" placeholder="Qty" value={item.quantity} onChange={e => updateItem(i, 'quantity', e.target.value)} required />
                      <input className="form-input" type="number" min="0" placeholder="Unit Price" value={item.unit_price} onChange={e => updateItem(i, 'unit_price', e.target.value)} required />
                      {form.items.length > 1 && <button type="button" className="btn btn-danger btn-sm" onClick={() => removeItem(i)}>✕</button>}
                    </div>
                  ))}
                </div>
                <div className="form-group">
                  <label className="form-label">Payment Method</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {['NONE', 'CASH', 'BANK'].map(m => (
                      <button key={m} type="button" className={`btn ${form.payment_method === m ? 'btn-primary' : 'btn-secondary'} btn-sm`} onClick={() => setForm(f => ({ ...f, payment_method: m }))}>{m}</button>
                    ))}
                  </div>
                </div>
                {form.payment_method !== 'NONE' && (
                  <div className="form-group">
                    <label className="form-label">Amount Paid</label>
                    <input className="form-input" type="number" min="0" value={form.amount_paid} onChange={e => setForm(f => ({ ...f, amount_paid: e.target.value }))} />
                  </div>
                )}
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
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Save Purchase'}</button>
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
