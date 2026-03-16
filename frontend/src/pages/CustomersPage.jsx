import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useToast } from '../context/ToastContext';

function fmt(n) { return Number(n || 0).toLocaleString(); }

export default function CustomersPage() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', address: '' });
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);
  const toast = useToast();
  const navigate = useNavigate();

  const load = () => {
    api.get('/customers').then(r => setCustomers(r.data.customers || [])).catch(console.error).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const openAdd = () => { setForm({ name: '', phone: '', address: '' }); setEditId(null); setShowForm(true); };
  const openEdit = (c) => { setForm({ name: c.name, phone: c.phone || '', address: c.address || '' }); setEditId(c.id); setShowForm(true); };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { toast('Name is required', 'error'); return; }
    setSaving(true);
    try {
      if (editId) {
        await api.put(`/customers/${editId}`, form);
        toast('Customer updated', 'success');
      } else {
        await api.post('/customers', form);
        toast('Customer added', 'success');
      }
      setShowForm(false); load();
    } catch (err) {
      toast(err.response?.data?.error?.message || 'Failed to save', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Delete this customer? This will fail if they have active sales or outstanding balance.`)) return;
    try {
      await api.delete(`/customers/${editId}`);
      toast('Customer deleted', 'success');
      setShowForm(false); load();
    } catch (err) {
      toast(err.response?.data?.error?.message || 'Cannot delete', 'error');
    }
  };

  const filtered = customers.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.phone || '').includes(search)
  );

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Customers</h1>
        <button className="btn btn-primary" onClick={openAdd}>+ Add Customer</button>
      </div>

      <div className="card">
        <div className="card-header">
          <input className="form-input" style={{ maxWidth: 300 }} placeholder="Search name or phone..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="card-body" style={{ padding: 0 }}>
          {loading ? <div style={{ padding: 24, textAlign: 'center' }}>Loading...</div> : (
            <table className="table">
              <thead><tr><th>Name</th><th>Phone</th><th>Address</th><th>Outstanding</th><th>Actions</th></tr></thead>
              <tbody>
                {filtered.length === 0 && <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No customers found</td></tr>}
                {filtered.map(c => (
                  <tr key={c.id}>
                    <td style={{ cursor: 'pointer', color: 'var(--primary)' }} onClick={() => navigate(`/customers/${c.id}`)}>{c.name}</td>
                    <td>{c.phone || '—'}</td>
                    <td>{c.address || '—'}</td>
                    <td style={{ color: c.outstanding_balance > 0 ? 'var(--danger)' : 'inherit' }}>Rs {fmt(c.outstanding_balance)}</td>
                    <td><button className="btn btn-secondary btn-sm" onClick={() => openEdit(c)}>Edit</button></td>
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
              <h3 className="modal-title">{editId ? 'Edit Customer' : 'Add Customer'}</h3>
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
                {editId && <button type="button" className="btn btn-danger" onClick={handleDelete}>Delete</button>}
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
