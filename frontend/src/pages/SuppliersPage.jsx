import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useToast } from '../context/ToastContext';

function fmt(n) { return Number(n || 0).toLocaleString(); }

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', address: '' });
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);
  const toast = useToast();
  const navigate = useNavigate();

  const load = () => {
    api.get('/suppliers').then(r => setSuppliers(r.data.suppliers || [])).catch(console.error).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const openAdd = () => { setForm({ name: '', phone: '', address: '' }); setEditId(null); setShowForm(true); };
  const openEdit = (s) => { setForm({ name: s.name, phone: s.phone || '', address: s.address || '' }); setEditId(s.id); setShowForm(true); };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { toast('Name is required', 'error'); return; }
    setSaving(true);
    try {
      if (editId) { await api.put(`/suppliers/${editId}`, form); toast('Supplier updated', 'success'); }
      else { await api.post('/suppliers', form); toast('Supplier added', 'success'); }
      setShowForm(false); load();
    } catch (err) {
      toast(err.response?.data?.error?.message || 'Failed to save', 'error');
    } finally { setSaving(false); }
  };

  const filtered = suppliers.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) || (s.phone || '').includes(search)
  );

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Suppliers</h1>
        <button className="btn btn-primary" onClick={openAdd}>+ Add Supplier</button>
      </div>
      <div className="card">
        <div className="card-header">
          <input className="form-input" style={{ maxWidth: 300 }} placeholder="Search name or phone..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="card-body" style={{ padding: 0 }}>
          {loading ? <div style={{ padding: 24, textAlign: 'center' }}>Loading...</div> : (
            <table className="table">
              <thead><tr><th>Name</th><th>Phone</th><th>Address</th><th>Payable</th><th>Actions</th></tr></thead>
              <tbody>
                {filtered.length === 0 && <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No suppliers found</td></tr>}
                {filtered.map(s => (
                  <tr key={s.id}>
                    <td style={{ cursor: 'pointer', color: 'var(--primary)' }} onClick={() => navigate(`/suppliers/${s.id}`)}>{s.name}</td>
                    <td>{s.phone || '—'}</td>
                    <td>{s.address || '—'}</td>
                    <td style={{ color: s.outstanding_payable > 0 ? 'var(--warning)' : 'inherit' }}>Rs {fmt(s.outstanding_payable)}</td>
                    <td><button className="btn btn-secondary btn-sm" onClick={() => openEdit(s)}>Edit</button></td>
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
              <h3 className="modal-title">{editId ? 'Edit Supplier' : 'Add Supplier'}</h3>
              <button className="modal-close" onClick={() => setShowForm(false)}>✕</button>
            </div>
            <form onSubmit={handleSave}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Name *</label>
                  <input className="form-input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Phone</label>
                  <input className="form-input" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Address</label>
                  <input className="form-input" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
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
