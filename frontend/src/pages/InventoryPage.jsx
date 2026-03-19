import { useEffect, useState } from 'react';
import api from '../services/api';
import { useToast } from '../context/ToastContext';

function fmt(n) { return Number(n || 0).toLocaleString(); }

// Weight input: pick preset or type custom
function WeightInput({ weights, value, onChange }) {
  const [mode, setMode] = useState('preset'); // 'preset' | 'custom'
  const [custom, setCustom] = useState('');

  function handleModeToggle() {
    const next = mode === 'preset' ? 'custom' : 'preset';
    setMode(next);
    onChange({ weight_id: '', custom_value: '' });
    setCustom('');
  }

  function handlePreset(e) {
    onChange({ weight_id: e.target.value, custom_value: '' });
  }

  function handleCustom(e) {
    setCustom(e.target.value);
    onChange({ weight_id: '', custom_value: e.target.value });
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        <button type="button" className={'btn btn-sm ' + (mode === 'preset' ? 'btn-primary' : 'btn-secondary')} onClick={() => { setMode('preset'); onChange({ weight_id: '', custom_value: '' }); setCustom(''); }}>
          Preset
        </button>
        <button type="button" className={'btn btn-sm ' + (mode === 'custom' ? 'btn-primary' : 'btn-secondary')} onClick={handleModeToggle}>
          Custom
        </button>
      </div>
      {mode === 'preset'
        ? <select className="form-select" value={value.weight_id} onChange={handlePreset} required>
            <option value="">-- Select Weight --</option>
            {weights.map(w => <option key={w.id} value={w.id}>{w.weight_value}{w.unit}</option>)}
          </select>
        : <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input className="form-input" type="number" min="0.1" step="0.01" placeholder="e.g. 25" value={custom} onChange={handleCustom} required style={{ flex: 1 }} />
            <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>kg</span>
          </div>
      }
    </div>
  );
}

export default function InventoryPage() {
  const [inventory, setInventory] = useState([]);
  const [products, setProducts] = useState([]);
  const [weights, setWeights] = useState([]);
  const [loading, setLoading] = useState(true);

  // Add / Adjust modal
  const [showForm, setShowForm] = useState(false);
  const [formType, setFormType] = useState('add');
  const [form, setForm] = useState({ product_id: '', weight: { weight_id: '', custom_value: '' }, quantity: '', notes: '' });
  const [saving, setSaving] = useState(false);

  // Edit modal
  const [editItem, setEditItem] = useState(null); // inventory row being edited
  const [editForm, setEditForm] = useState({ product_id: '', weight: { weight_id: '', custom_value: '' }, quantity: '' });
  const [editSaving, setEditSaving] = useState(false);

  // Delete confirm
  const [deleteItem, setDeleteItem] = useState(null);
  const [deleting, setDeleting] = useState(false);

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

  // Resolve weight_id from form weight field (create custom if needed)
  const resolveWeightId = async (weightField) => {
    if (weightField.weight_id) return Number(weightField.weight_id);
    if (weightField.custom_value) {
      const r = await api.post('/inventory/weight', { weight_value: Number(weightField.custom_value), unit: 'kg' });
      return r.data.weight.id;
    }
    throw new Error('Please select or enter a weight');
  };

  const openForm = (type) => {
    setFormType(type);
    setForm({ product_id: '', weight: { weight_id: '', custom_value: '' }, quantity: '', notes: '' });
    setShowForm(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const weight_id = await resolveWeightId(form.weight);
      const endpoint = formType === 'add' ? '/inventory/add' : '/inventory/adjust';
      await api.post(endpoint, {
        product_id: Number(form.product_id),
        weight_id,
        quantity: Number(form.quantity),
        note: form.notes,
      });
      toast(`Stock ${formType === 'add' ? 'added' : 'adjusted'} successfully`, 'success');
      setShowForm(false);
      load();
    } catch (err) {
      toast(err.response?.data?.error?.message || err.message || 'Failed', 'error');
    } finally { setSaving(false); }
  };

  const openEdit = (row) => {
    setEditItem(row);
    setEditForm({
      product_id: String(row.product_id),
      weight: { weight_id: String(row.weight_id), custom_value: '' },
      quantity: String(row.quantity),
    });
  };

  const handleEditSave = async (e) => {
    e.preventDefault();
    setEditSaving(true);
    try {
      const weight_id = await resolveWeightId(editForm.weight);
      await api.put(`/inventory/${editItem.id}`, {
        product_id: Number(editForm.product_id),
        weight_id,
        quantity: Number(editForm.quantity),
      });
      toast('Inventory updated', 'success');
      setEditItem(null);
      load();
    } catch (err) {
      toast(err.response?.data?.error?.message || err.message || 'Failed', 'error');
    } finally { setEditSaving(false); }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await api.delete(`/inventory/${deleteItem.id}`);
      toast('Stock entry deleted', 'success');
      setDeleteItem(null);
      load();
    } catch (err) {
      toast(err.response?.data?.error?.message || 'Failed to delete', 'error');
    } finally { setDeleting(false); }
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
            : <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16 }}>
                {summary.map(p => (
                  <div key={p.id} className="card" style={{ padding: 0 }}>
                    <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--bg-tertiary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>{p.name}</span>
                      <span style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--primary)' }}>{fmt(p.totalBags)} bags</span>
                    </div>
                    <div style={{ padding: '8px 16px 12px' }}>
                      {p.rows.map(r => (
                        <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem', padding: '4px 0', color: 'var(--text-secondary)', borderBottom: '1px solid var(--bg-tertiary)' }}>
                          <span>{r.weight_value}{r.unit}</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontWeight: 600 }}>{fmt(r.quantity)}</span>
                            <button
                              className="btn btn-sm btn-secondary"
                              style={{ padding: '2px 8px', minHeight: 'unset', fontSize: '0.75rem' }}
                              onClick={() => openEdit(r)}
                              title="Edit"
                            >✏️</button>
                            <button
                              className="btn btn-sm btn-danger"
                              style={{ padding: '2px 8px', minHeight: 'unset', fontSize: '0.75rem' }}
                              onClick={() => setDeleteItem(r)}
                              title="Delete"
                            >🗑️</button>
                          </div>
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
                          : <span className="badge badge-success">In Stock</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </>)}

      {/* ── Add / Adjust Modal ── */}
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
                  <WeightInput weights={weights} value={form.weight} onChange={w => setForm(f => ({ ...f, weight: w }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">{formType === 'add' ? 'Quantity to Add' : 'Adjustment (+/-)'} *</label>
                  <input className="form-input" type="number" min={formType === 'add' ? 1 : undefined} value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Notes{formType === 'adjust' ? ' *' : ''}</label>
                  <input className="form-input" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} required={formType === 'adjust'} />
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

      {/* ── Edit Modal ── */}
      {editItem && (
        <div className="modal-overlay" onClick={() => setEditItem(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Edit Stock Entry</h3>
              <button className="modal-close" onClick={() => setEditItem(null)}>✕</button>
            </div>
            <form onSubmit={handleEditSave}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Product *</label>
                  <select className="form-select" value={editForm.product_id} onChange={e => setEditForm(f => ({ ...f, product_id: e.target.value }))} required>
                    <option value="">-- Select Product --</option>
                    {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Weight *</label>
                  <WeightInput weights={weights} value={editForm.weight} onChange={w => setEditForm(f => ({ ...f, weight: w }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Quantity *</label>
                  <input className="form-input" type="number" min={0} value={editForm.quantity} onChange={e => setEditForm(f => ({ ...f, quantity: e.target.value }))} required />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setEditItem(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={editSaving}>{editSaving ? 'Saving...' : 'Save Changes'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Delete Confirm ── */}
      {deleteItem && (
        <div className="modal-overlay" onClick={() => setDeleteItem(null)}>
          <div className="modal" style={{ maxWidth: 400 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Delete Stock Entry</h3>
              <button className="modal-close" onClick={() => setDeleteItem(null)}>✕</button>
            </div>
            <div className="modal-body">
              <p style={{ marginBottom: 8 }}>Are you sure you want to delete this stock entry?</p>
              <div style={{ background: 'var(--bg-secondary)', borderRadius: 8, padding: '10px 14px', fontSize: '0.9rem' }}>
                <strong>{deleteItem.product_name}</strong> — {deleteItem.weight_value}{deleteItem.unit} &nbsp;|&nbsp; {fmt(deleteItem.quantity)} bags
              </div>
              <p style={{ marginTop: 10, fontSize: '0.85rem', color: 'var(--danger)' }}>This action cannot be undone.</p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setDeleteItem(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={handleDelete} disabled={deleting}>{deleting ? 'Deleting...' : 'Delete'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
