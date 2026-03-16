import { useEffect, useState } from 'react';
import api from '../services/api';
import { useToast } from '../context/ToastContext';

function fmt(n) { return Number(n || 0).toLocaleString(); }

export default function InventoryPage() {
  const [inventory, setInventory] = useState([]);
  const [products, setProducts] = useState([]);
  const [weights, setWeights] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formType, setFormType] = useState('add'); // 'add' | 'adjust'
  const [form, setForm] = useState({ product_id: '', weight_id: '', quantity: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  const load = () => {
    Promise.all([api.get('/inventory'), api.get('/products'), api.get('/weights')])
      .then(([inv, p, w]) => {
        setInventory(inv.data.inventory || []);
        setProducts(p.data.products || []);
        setWeights(w.data.weights || []);
      }).catch(console.error).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const openForm = (type) => { setFormType(type); setForm({ product_id: '', weight_id: '', quantity: '', notes: '' }); setShowForm(true); };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const endpoint = formType === 'add' ? '/inventory/add' : '/inventory/adjust';
      await api.post(endpoint, {
        product_id: Number(form.product_id),
        weight_id: Number(form.weight_id),
        quantity: Number(form.quantity),
        note: form.notes,
      });
      toast(`Stock ${formType === 'add' ? 'added' : 'adjusted'} successfully`, 'success');
      setShowForm(false); load();
    } catch (err) {
      toast(err.response?.data?.error?.message || 'Failed', 'error');
    } finally { setSaving(false); }
  };

  // Group inventory by product for summary
  const summary = products
    .filter(p => inventory.some(i => i.product_id === p.id))
    .map(p => {
      const rows = inventory.filter(i => i.product_id === p.id);
      const totalBags = rows.reduce((s, i) => s + Number(i.quantity), 0);
      return { ...p, totalBags, rows };
    });

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Inventory</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-primary" onClick={() => openForm('add')}>+ Add Stock</button>
          <button className="btn btn-secondary" onClick={() => openForm('adjust')}>Adjust Stock</button>
        </div>
      </div>

      {loading ? <div style={{ padding: 24, textAlign: 'center' }}>Loading...</div> : (<>

        {/* ── Stock Summary ── */}
        <div style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>Stock Summary</h2>
          {summary.length === 0
            ? <div className="card"><div className="card-body" style={{ color: 'var(--text-muted)', textAlign: 'center' }}>No stock available</div></div>
            : <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
                {summary.map(p => (
                  <div key={p.id} className="card" style={{ padding: 0 }}>
                    <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--bg-tertiary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>{p.name}</span>
                      <span style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--primary)' }}>{fmt(p.totalBags)} bags</span>
                    </div>
                    <div style={{ padding: '8px 16px 12px' }}>
                      {p.rows.map(r => (
                        <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', padding: '3px 0', color: 'var(--text-secondary)' }}>
                          <span>{r.weight_value}{r.unit}</span>
                          <span style={{ fontWeight: 600 }}>{fmt(r.quantity)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
          }
        </div>

        {/* ── Detailed Table ── */}
        <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>Stock Details</h2>
        <div className="card">
          <div className="card-body" style={{ padding: 0 }}>
            <table className="table">
              <thead>
                <tr><th>Product</th><th>Weight</th><th>Quantity</th><th>Status</th></tr>
              </thead>
              <tbody>
                {inventory.length === 0 && <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No inventory records</td></tr>}
                {inventory.map(inv => (
                  <tr key={inv.id}>
                    <td>{inv.product_name}</td>
                    <td>{inv.weight_value}{inv.unit}</td>
                    <td>{fmt(inv.quantity)}</td>
                    <td>
                      {inv.quantity === 0
                        ? <span className="badge badge-danger">Out of Stock</span>
                        : inv.quantity <= 10
                          ? <span className="badge badge-warning">Low Stock</span>
                          : <span className="badge badge-success">In Stock</span>
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </>)}

      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">{formType === 'add' ? 'Add Stock' : 'Adjust Stock'}</h3>
              <button className="modal-close" onClick={() => setShowForm(false)}>✕</button>
            </div>
            <form onSubmit={handleSave}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Product *</label>
                  <select className="form-select" value={form.product_id} onChange={e => setForm(f => ({ ...f, product_id: e.target.value }))} required>
                    <option value="">-- Select Product --</option>
                    {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Weight *</label>
                  <select className="form-select" value={form.weight_id} onChange={e => setForm(f => ({ ...f, weight_id: e.target.value }))} required>
                    <option value="">-- Select Weight --</option>
                    {weights.map(w => <option key={w.id} value={w.id}>{w.weight_value}{w.unit}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">{formType === 'add' ? 'Quantity to Add' : 'New Quantity'} *</label>
                  <input className="form-input" type="number" min={formType === 'add' ? 1 : 0} value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Notes</label>
                  <input className="form-input" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
