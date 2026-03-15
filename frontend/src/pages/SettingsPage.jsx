import { useEffect, useState } from 'react';
import api from '../services/api';
import { useToast } from '../context/ToastContext';

export default function SettingsPage() {
  const [settings, setSettings] = useState(null);
  const [users, setUsers] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ company_name: '', address: '', phone: '', email: '' });
  const [showUserForm, setShowUserForm] = useState(false);
  const [userForm, setUserForm] = useState({ username: '', password: '', role: 'ACCOUNTANT' });
  const [editUserId, setEditUserId] = useState(null);
  const [showProductForm, setShowProductForm] = useState(false);
  const [productForm, setProductForm] = useState({ name: '' });
  const [editProductId, setEditProductId] = useState(null);
  const toast = useToast();

  const load = () => {
    Promise.all([api.get('/settings'), api.get('/users'), api.get('/products')])
      .then(([s, u, p]) => {
        const d = s.data.settings || {};
        setSettings(d);
        setForm({ company_name: d.company_name || '', address: d.address || '', phone: d.phone || '', email: d.email || '' });
        setUsers(u.data.users || []);
        setProducts(p.data.products || []);
      }).catch(console.error).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const handleSettingsSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put('/settings', form);
      toast('Settings saved', 'success'); load();
    } catch (err) { toast(err.response?.data?.error?.message || 'Failed', 'error'); }
    finally { setSaving(false); }
  };

  const openUserAdd = () => { setUserForm({ username: '', password: '', role: 'ACCOUNTANT' }); setEditUserId(null); setShowUserForm(true); };
  const openUserEdit = (u) => { setUserForm({ username: u.username, password: '', role: u.role }); setEditUserId(u.id); setShowUserForm(true); };

  const handleUserSave = async (e) => {
    e.preventDefault();
    try {
      if (editUserId) { await api.put(`/users/${editUserId}`, userForm); toast('User updated', 'success'); }
      else { await api.post('/users', userForm); toast('User created', 'success'); }
      setShowUserForm(false); load();
    } catch (err) { toast(err.response?.data?.error?.message || 'Failed', 'error'); }
  };

  const handleUserDelete = async (id) => {
    if (!confirm('Delete this user?')) return;
    try { await api.delete(`/users/${id}`); toast('User deleted', 'success'); load(); }
    catch (err) { toast(err.response?.data?.error?.message || 'Failed', 'error'); }
  };

  const openProductAdd = () => { setProductForm({ name: '' }); setEditProductId(null); setShowProductForm(true); };
  const openProductEdit = (p) => { setProductForm({ name: p.name }); setEditProductId(p.id); setShowProductForm(true); };

  const handleProductSave = async (e) => {
    e.preventDefault();
    try {
      if (editProductId) { await api.put(`/products/${editProductId}`, productForm); toast('Product updated', 'success'); }
      else { await api.post('/products', productForm); toast('Product added', 'success'); }
      setShowProductForm(false); load();
    } catch (err) { toast(err.response?.data?.error?.message || 'Failed', 'error'); }
  };

  const toggleProduct = async (p) => {
    try {
      const newStatus = p.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
      await api.put(`/products/${p.id}/status`, { status: newStatus });
      toast(`Product ${newStatus === 'ACTIVE' ? 'activated' : 'deactivated'}`, 'success'); load();
    } catch (err) { toast('Failed', 'error'); }
  };

  if (loading) return <div className="loading-screen"><div className="spinner" /></div>;

  return (
    <div>
      <div className="page-header"><h1 className="page-title">Settings</h1></div>

      {/* Company Settings */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header"><span className="card-title">Company Information</span></div>
        <div className="card-body">
          <form onSubmit={handleSettingsSave}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
              <div className="form-group">
                <label className="form-label">Company Name</label>
                <input className="form-input" value={form.company_name} onChange={e => setForm(f => ({ ...f, company_name: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Phone</label>
                <input className="form-input" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Email</label>
                <input className="form-input" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Address</label>
                <input className="form-input" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
              </div>
            </div>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Save Settings'}</button>
          </form>
        </div>
      </div>

      {/* Products */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <span className="card-title">Products</span>
          <button className="btn btn-primary btn-sm" onClick={openProductAdd}>+ Add Product</button>
        </div>
        <div className="card-body" style={{ padding: 0 }}>
          <table className="table">
            <thead><tr><th>Name</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {products.map(p => (
                <tr key={p.id}>
                  <td>{p.name}</td>
                  <td><span className={`badge ${p.status === 'ACTIVE' ? 'badge-success' : 'badge-secondary'}`}>{p.status}</span></td>
                  <td style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-secondary btn-sm" onClick={() => openProductEdit(p)}>Edit</button>
                    <button className={`btn btn-sm ${p.status === 'ACTIVE' ? 'btn-warning' : 'btn-success'}`} onClick={() => toggleProduct(p)}>{p.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Users */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Users</span>
          <button className="btn btn-primary btn-sm" onClick={openUserAdd}>+ Add User</button>
        </div>
        <div className="card-body" style={{ padding: 0 }}>
          <table className="table">
            <thead><tr><th>Username</th><th>Role</th><th>Actions</th></tr></thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id}>
                  <td>{u.username}</td>
                  <td><span className={`badge ${u.role === 'ADMIN' ? 'badge-danger' : 'badge-info'}`}>{u.role}</span></td>
                  <td style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-secondary btn-sm" onClick={() => openUserEdit(u)}>Edit</button>
                    <button className="btn btn-danger btn-sm" onClick={() => handleUserDelete(u.id)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* User Modal */}
      {showUserForm && (
        <div className="modal-overlay" onClick={() => setShowUserForm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">{editUserId ? 'Edit User' : 'Add User'}</h3>
              <button className="modal-close" onClick={() => setShowUserForm(false)}>✕</button>
            </div>
            <form onSubmit={handleUserSave}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Username *</label>
                  <input className="form-input" value={userForm.username} onChange={e => setUserForm(f => ({ ...f, username: e.target.value }))} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Password {editUserId ? '(leave blank to keep)' : '*'}</label>
                  <input className="form-input" type="password" value={userForm.password} onChange={e => setUserForm(f => ({ ...f, password: e.target.value }))} required={!editUserId} />
                </div>
                <div className="form-group">
                  <label className="form-label">Role</label>
                  <select className="form-select" value={userForm.role} onChange={e => setUserForm(f => ({ ...f, role: e.target.value }))}>
                    <option value="ACCOUNTANT">ACCOUNTANT</option>
                    <option value="ADMIN">ADMIN</option>
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowUserForm(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Product Modal */}
      {showProductForm && (
        <div className="modal-overlay" onClick={() => setShowProductForm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">{editProductId ? 'Edit Product' : 'Add Product'}</h3>
              <button className="modal-close" onClick={() => setShowProductForm(false)}>✕</button>
            </div>
            <form onSubmit={handleProductSave}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Product Name *</label>
                  <input className="form-input" value={productForm.name} onChange={e => setProductForm(f => ({ ...f, name: e.target.value }))} required />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowProductForm(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
