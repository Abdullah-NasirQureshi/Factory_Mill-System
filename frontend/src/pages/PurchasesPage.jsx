import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useToast } from '../context/ToastContext';
import DocumentActionModal from '../components/DocumentActionModal';

function fmt(n) { return Number(n || 0).toLocaleString(); }

// ─── New Purchase Page (billing-style) ───────────────────────────────────────
function NewPurchasePage({ onDone }) {
  const toast = useToast();
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [weights, setWeights] = useState([]);
  const [banks, setBanks] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [selectedWeight, setSelectedWeight] = useState(null);
  const [cart, setCart] = useState([]);
  const [supplierId, setSupplierId] = useState('');
  const [supplierSearch, setSupplierSearch] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().slice(0, 10));
  const [paymentMethod, setPaymentMethod] = useState('NONE');
  const [bankId, setBankId] = useState('');
  const [amountPaid, setAmountPaid] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [docModal, setDocModal] = useState(null);
  const [qty, setQty] = useState(1);
  const [price, setPrice] = useState('');

  useEffect(() => {
    Promise.all([
      api.get('/suppliers'), api.get('/products'), api.get('/weights'), api.get('/banks'),
    ]).then(([s, p, w, b]) => {
      setSuppliers(s.data.suppliers || []);
      setProducts(p.data.products || []);
      setWeights(w.data.weights || []);
      setBanks(b.data.banks || []);
    }).catch(console.error);
  }, []);

  const getWeightLabel = (w) => `${w.weight_value}${w.unit}`;

  const addToCart = () => {
    if (!selectedProduct || !selectedWeight || !price || qty < 1) {
      toast('Select product, weight, price and quantity', 'error'); return;
    }
    const existing = cart.find(c => c.product_id === selectedProduct.id && c.weight_id === selectedWeight.id);
    if (existing) {
      setCart(c => c.map(item =>
        item.product_id === selectedProduct.id && item.weight_id === selectedWeight.id
          ? { ...item, quantity: item.quantity + Number(qty), total: (item.quantity + Number(qty)) * Number(price) }
          : item
      ));
    } else {
      setCart(c => [...c, {
        product_id: selectedProduct.id, weight_id: selectedWeight.id,
        product_name: selectedProduct.name, weight_label: getWeightLabel(selectedWeight),
        quantity: Number(qty), price_per_unit: Number(price),
        total: Number(qty) * Number(price),
      }]);
    }
    setQty(1); setPrice(''); setSelectedWeight(null);
  };

  const removeFromCart = (idx) => setCart(c => c.filter((_, i) => i !== idx));

  const total = cart.reduce((s, i) => s + i.total, 0);
  const paid = Number(amountPaid) || 0;
  const remaining = total - paid;

  const filteredSuppliers = suppliers.filter(s =>
    s.name.toLowerCase().includes(supplierSearch.toLowerCase()) ||
    (s.phone || '').includes(supplierSearch)
  );

  const handleSave = async () => {
    if (!supplierId) { toast('Select a supplier', 'error'); return; }
    if (cart.length === 0) { toast('Add items to cart', 'error'); return; }
    if (paymentMethod !== 'NONE' && !amountPaid) { toast('Enter amount paid', 'error'); return; }
    if (paymentMethod === 'BANK' && !bankId) { toast('Select a bank account', 'error'); return; }
    setSaving(true);
    try {
      const res = await api.post('/purchases', {
        supplier_id: Number(supplierId),
        purchase_date: purchaseDate,
        items: cart.map(i => ({
          product_name: `${i.product_name} (${i.weight_label})`,
          quantity: i.quantity,
          unit_price: i.price_per_unit,
        })),
        payment_method: paymentMethod,
        payment_amount: paid,
        bank_id: bankId ? Number(bankId) : null,
        notes,
      });
      const purchase = res.data.purchase;
      toast(`Purchase ${purchase.invoice_number} recorded`, 'success');
      setDocModal({ type: 'purchase', id: purchase.id, number: purchase.invoice_number });
      setCart([]); setSupplierId(''); setSupplierSearch(''); setAmountPaid(''); setNotes(''); setPaymentMethod('NONE');
    } catch (err) {
      toast(err.response?.data?.error?.message || 'Failed to save', 'error');
    } finally { setSaving(false); }
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">New Purchase</h1>
        <button className="btn btn-secondary" onClick={onDone}>← Back to Purchases</button>
      </div>

      <div className="billing-layout">
        {/* Left: Product / Weight selection */}
        <div className="billing-products">
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-header"><span className="card-title">Select Product</span></div>
            <div className="card-body">
              <div className="product-grid">
                {products.filter(p => p.status === 'ACTIVE').map(p => (
                  <button
                    key={p.id}
                    className={`product-card ${selectedProduct?.id === p.id ? 'selected' : ''}`}
                    onClick={() => { setSelectedProduct(p); setSelectedWeight(null); }}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {selectedProduct && (
            <div className="card" style={{ marginBottom: 16 }}>
              <div className="card-header"><span className="card-title">Select Weight — {selectedProduct.name}</span></div>
              <div className="card-body">
                <div className="weight-grid">
                  {weights.map(w => (
                    <button
                      key={w.id}
                      className={`weight-card ${selectedWeight?.id === w.id ? 'selected' : ''}`}
                      onClick={() => setSelectedWeight(w)}
                    >
                      <div className="weight-label">{w.weight_value}{w.unit}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {selectedProduct && selectedWeight && (
            <div className="card">
              <div className="card-header"><span className="card-title">Add to Cart</span></div>
              <div className="card-body">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 12, alignItems: 'end' }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Quantity (bags)</label>
                    <input className="form-input" type="number" min="1" value={qty} onChange={e => setQty(e.target.value)} />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Price / bag (Rs)</label>
                    <input className="form-input" type="number" min="0" placeholder="0" value={price} onChange={e => setPrice(e.target.value)} />
                  </div>
                  <button className="btn btn-primary" onClick={addToCart}>Add</button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right: Cart + Supplier + Payment */}
        <div className="billing-cart">
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-header"><span className="card-title">Supplier</span></div>
            <div className="card-body">
              <input
                className="form-input"
                placeholder="Search supplier..."
                value={supplierSearch}
                onChange={e => setSupplierSearch(e.target.value)}
                style={{ marginBottom: 8 }}
              />
              <select className="form-select" value={supplierId} onChange={e => setSupplierId(e.target.value)}>
                <option value="">-- Select Supplier --</option>
                {filteredSuppliers.map(s => (
                  <option key={s.id} value={s.id}>{s.name} {s.phone ? `(${s.phone})` : ''}</option>
                ))}
              </select>
              <div className="form-group" style={{ marginTop: 12, marginBottom: 0 }}>
                <label className="form-label">Purchase Date</label>
                <input className="form-input" type="date" value={purchaseDate} onChange={e => setPurchaseDate(e.target.value)} />
              </div>
            </div>
          </div>

          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-header"><span className="card-title">Cart</span></div>
            <div className="card-body" style={{ padding: 0 }}>
              {cart.length === 0
                ? <p style={{ padding: 16, color: 'var(--text-muted)', textAlign: 'center' }}>No items added</p>
                : <table className="table">
                    <thead><tr><th>Item</th><th>Qty</th><th>Price</th><th>Total</th><th></th></tr></thead>
                    <tbody>
                      {cart.map((item, i) => (
                        <tr key={i}>
                          <td>{item.product_name}<br /><small style={{ color: 'var(--text-muted)' }}>{item.weight_label}</small></td>
                          <td>{item.quantity}</td>
                          <td>Rs {fmt(item.price_per_unit)}</td>
                          <td>Rs {fmt(item.total)}</td>
                          <td><button className="btn btn-danger btn-sm" onClick={() => removeFromCart(i)}>✕</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
              }
            </div>
            {cart.length > 0 && (
              <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', fontWeight: 600, fontSize: 16 }}>
                Total: Rs {fmt(total)}
              </div>
            )}
          </div>

          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-header"><span className="card-title">Payment</span></div>
            <div className="card-body">
              <div className="form-group">
                <label className="form-label">Payment Method</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {['NONE', 'CASH', 'BANK'].map(m => (
                    <button key={m} className={`btn ${paymentMethod === m ? 'btn-primary' : 'btn-secondary'} btn-sm`} onClick={() => setPaymentMethod(m)}>{m}</button>
                  ))}
                </div>
              </div>
              {paymentMethod !== 'NONE' && (
                <div className="form-group">
                  <label className="form-label">Amount Paid (Rs)</label>
                  <input className="form-input" type="number" min="0" placeholder="0" value={amountPaid} onChange={e => setAmountPaid(e.target.value)} />
                </div>
              )}
              {paymentMethod === 'BANK' && (
                <div className="form-group">
                  <label className="form-label">Bank Account</label>
                  <select className="form-select" value={bankId} onChange={e => setBankId(e.target.value)}>
                    <option value="">-- Select Bank --</option>
                    {banks.map(b => <option key={b.id} value={b.id}>{b.bank_name} — {b.account_number}</option>)}
                  </select>
                </div>
              )}
              {paymentMethod !== 'NONE' && amountPaid && (
                <div style={{ padding: '8px 0', color: remaining > 0 ? 'var(--danger)' : 'var(--success)', fontWeight: 600 }}>
                  {remaining > 0 ? `Remaining: Rs ${fmt(remaining)}` : `Overpaid: Rs ${fmt(Math.abs(remaining))}`}
                </div>
              )}
              <div className="form-group">
                <label className="form-label">Notes</label>
                <input className="form-input" placeholder="Optional notes..." value={notes} onChange={e => setNotes(e.target.value)} />
              </div>
            </div>
          </div>

          <button className="btn btn-primary btn-full" onClick={handleSave} disabled={saving || cart.length === 0}>
            {saving ? 'Saving...' : `Save Purchase — Rs ${fmt(total)}`}
          </button>
        </div>
      </div>

      {docModal && (
        <DocumentActionModal
          type={docModal.type}
          id={docModal.id}
          number={docModal.number}
          onClose={() => { setDocModal(null); onDone(); }}
        />
      )}
    </div>
  );
}

// ─── Purchases List Page ──────────────────────────────────────────────────────
export default function PurchasesPage() {
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showNew, setShowNew] = useState(false);
  const navigate = useNavigate();

  const load = () => {
    api.get('/purchases').then(r => setPurchases(r.data.purchases || [])).catch(console.error).finally(() => setLoading(false));
  };
  useEffect(load, []);

  if (showNew) return <NewPurchasePage onDone={() => { setShowNew(false); load(); }} />;

  const filtered = purchases.filter(p =>
    p.invoice_number?.toLowerCase().includes(search.toLowerCase()) ||
    p.supplier_name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Purchases</h1>
        <button className="btn btn-primary" onClick={() => setShowNew(true)}>+ New Purchase</button>
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
                    <td>
                      <span className={`badge ${p.remaining_amount == 0 ? 'badge-success' : p.paid_amount > 0 ? 'badge-warning' : 'badge-danger'}`}>
                        {p.remaining_amount == 0 ? 'PAID' : p.paid_amount > 0 ? 'PARTIAL' : 'UNPAID'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
