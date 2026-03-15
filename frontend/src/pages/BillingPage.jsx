import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useToast } from '../context/ToastContext';
import DocumentActionModal from '../components/DocumentActionModal';

function fmt(n) { return Number(n || 0).toLocaleString(); }

export default function BillingPage() {
  const toast = useToast();
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [weights, setWeights] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [banks, setBanks] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [selectedWeight, setSelectedWeight] = useState(null);
  const [cart, setCart] = useState([]);
  const [customerId, setCustomerId] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
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
      api.get('/products'),
      api.get('/weights'),
      api.get('/inventory'),
      api.get('/customers'),
      api.get('/banks'),
    ]).then(([p, w, inv, c, b]) => {
      setProducts(p.data.products || []);
      setWeights(w.data.weights || []);
      setInventory(inv.data.inventory || []);
      setCustomers(c.data.customers || []);
      setBanks(b.data.banks || []);
    }).catch(console.error);
  }, []);

  const availableWeights = selectedProduct
    ? weights.filter(w => {
        const inv = inventory.find(i => i.product_id === selectedProduct.id && i.weight_id === w.id);
        return inv && inv.quantity > 0;
      })
    : [];

  const getStock = (productId, weightId) => {
    const inv = inventory.find(i => i.product_id === productId && i.weight_id === weightId);
    return inv ? inv.quantity : 0;
  };

  const getWeightLabel = (w) => `${w.weight_value}${w.unit}`;

  const addToCart = () => {
    if (!selectedProduct || !selectedWeight || !price || qty < 1) {
      toast('Select product, weight, price and quantity', 'error'); return;
    }
    const stock = getStock(selectedProduct.id, selectedWeight.id);
    const existing = cart.find(c => c.product_id === selectedProduct.id && c.weight_id === selectedWeight.id);
    const usedQty = existing ? existing.quantity : 0;
    if (qty + usedQty > stock) { toast(`Only ${stock - usedQty} bags available`, 'error'); return; }

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

  const filteredCustomers = customers.filter(c =>
    c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
    (c.phone || '').includes(customerSearch)
  );

  const handleSave = async () => {
    if (!customerId) { toast('Select a customer', 'error'); return; }
    if (cart.length === 0) { toast('Add items to cart', 'error'); return; }
    if (paymentMethod !== 'NONE' && !amountPaid) { toast('Enter amount paid', 'error'); return; }
    if (paymentMethod === 'BANK' && !bankId) { toast('Select a bank account', 'error'); return; }
    setSaving(true);
    try {
      const res = await api.post('/sales', {
        customer_id: Number(customerId),
        items: cart.map(i => ({ product_id: i.product_id, weight_id: i.weight_id, quantity: i.quantity, price: i.price_per_unit })),
        payment_method: paymentMethod,
        payment_amount: paid,
        bank_id: bankId ? Number(bankId) : null,
        notes,
      });
      const sale = res.data.sale;
      toast(`Bill ${sale.invoice_number} created`, 'success');
      setDocModal({ type: 'sale', id: sale.id, number: sale.invoice_number });
      setCart([]); setCustomerId(''); setCustomerSearch(''); setAmountPaid(''); setNotes(''); setPaymentMethod('NONE');
    } catch (err) {
      toast(err.response?.data?.error?.message || 'Failed to save bill', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">New Bill</h1>
      </div>

      <div className="billing-layout">
        {/* Left: Product/Weight selection */}
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
                {availableWeights.length === 0
                  ? <p style={{ color: 'var(--text-muted)' }}>No stock available for this product</p>
                  : <div className="weight-grid">
                      {availableWeights.map(w => (
                        <button
                          key={w.id}
                          className={`weight-card ${selectedWeight?.id === w.id ? 'selected' : ''}`}
                          onClick={() => setSelectedWeight(w)}
                        >
                          <div className="weight-label">{w.weight_value}{w.unit}</div>
                          <div className="weight-stock">Stock: {getStock(selectedProduct.id, w.id)}</div>
                        </button>
                      ))}
                    </div>
                }
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

        {/* Right: Cart + Customer + Payment */}
        <div className="billing-cart">
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-header"><span className="card-title">Customer</span></div>
            <div className="card-body">
              <input
                className="form-input"
                placeholder="Search customer..."
                value={customerSearch}
                onChange={e => setCustomerSearch(e.target.value)}
                style={{ marginBottom: 8 }}
              />
              <select className="form-select" value={customerId} onChange={e => setCustomerId(e.target.value)}>
                <option value="">-- Select Customer --</option>
                {filteredCustomers.map(c => (
                  <option key={c.id} value={c.id}>{c.name} {c.phone ? `(${c.phone})` : ''}</option>
                ))}
              </select>
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
                  {remaining > 0 ? `Remaining: Rs ${fmt(remaining)}` : `Change: Rs ${fmt(Math.abs(remaining))}`}
                </div>
              )}
              <div className="form-group">
                <label className="form-label">Notes</label>
                <input className="form-input" placeholder="Optional notes..." value={notes} onChange={e => setNotes(e.target.value)} />
              </div>
            </div>
          </div>

          <button className="btn btn-primary btn-full" onClick={handleSave} disabled={saving || cart.length === 0}>
            {saving ? 'Saving...' : `Save Bill — Rs ${fmt(total)}`}
          </button>
        </div>
      </div>

      {docModal && (
        <DocumentActionModal
          type={docModal.type}
          id={docModal.id}
          number={docModal.number}
          onClose={() => { setDocModal(null); navigate('/sales'); }}
        />
      )}
    </div>
  );
}
