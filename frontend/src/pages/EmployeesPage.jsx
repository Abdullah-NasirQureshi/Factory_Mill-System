import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';

function fmt(n) { return Number(n || 0).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

const EMPTY_FORM = { name: '', phone: '', address: '', monthly_salary: '' };

export default function EmployeesPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const isAdmin = user?.role === 'ADMIN';

  const [employees, setEmployees] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const load = async (q = search) => {
    try {
      setLoading(true);
      const params = { active: 'true' };
      if (q) params.search = q;
      const res = await api.get('/employees', { params });
      setEmployees(res.data.employees || []);
    } catch { showToast('Failed to load employees', 'error'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const totalOutstanding = employees.reduce((s, e) => s + parseFloat(e.outstanding_balance || 0), 0);

  const openAdd = () => { setEditing(null); setForm(EMPTY_FORM); setShowModal(true); };
  const openEdit = (emp) => {
    setEditing(emp);
    setForm({ name: emp.name, phone: emp.phone || '', address: emp.address || '', monthly_salary: emp.monthly_salary });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) return showToast('Name is required', 'error');
    setSaving(true);
    try {
      if (editing) {
        await api.put(`/employees/${editing.id}`, form);
        showToast('Employee updated');
      } else {
        await api.post('/employees', form);
        showToast('Employee added');
      }
      setShowModal(false);
      load();
    } catch (e) {
      showToast(e.response?.data?.error?.message || 'Save failed', 'error');
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    try {
      await api.delete(`/employees/${deleteTarget.id}`);
      showToast('Employee deleted');
      setDeleteTarget(null);
      load();
    } catch (e) {
      showToast(e.response?.data?.error?.message || 'Delete failed', 'error');
      setDeleteTarget(null);
    }
  };

  const handleSearch = (e) => {
    setSearch(e.target.value);
    load(e.target.value);
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Employees</h1>
          <p className="page-subtitle">Manage employee records and outstanding balances</p>
        </div>
        {isAdmin && (
          <button className="btn btn-primary" onClick={openAdd}>+ Add Employee</button>
        )}
      </div>

      {/* Summary card */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', marginBottom: 24 }}>
        <div className="stat-card">
          <div className="stat-label">Total Employees</div>
          <div className="stat-value">{employees.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Total Outstanding</div>
          <div className="stat-value" style={{ color: totalOutstanding > 0 ? '#ef4444' : '#22c55e' }}>
            Rs {fmt(totalOutstanding)}
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="card" style={{ marginBottom: 20 }}>
        <input
          className="form-input"
          placeholder="Search by name or phone..."
          value={search}
          onChange={handleSearch}
          style={{ maxWidth: 360 }}
        />
      </div>

      {/* Table */}
      <div className="card">
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Phone</th>
                <th>Monthly Salary</th>
                <th>Outstanding</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>Loading...</td></tr>
              ) : employees.length === 0 ? (
                <tr><td colSpan={5} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>No employees found</td></tr>
              ) : employees.map(emp => (
                <tr key={emp.id}>
                  <td><strong>{emp.name}</strong></td>
                  <td>{emp.phone || '—'}</td>
                  <td>Rs {fmt(emp.monthly_salary)}</td>
                  <td>
                    <span style={{ color: parseFloat(emp.outstanding_balance) > 0 ? '#ef4444' : '#64748b', fontWeight: 600 }}>
                      Rs {fmt(emp.outstanding_balance)}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="btn btn-secondary btn-sm" onClick={() => navigate(`/employees/${emp.id}`)}>View</button>
                      {isAdmin && <button className="btn btn-secondary btn-sm" onClick={() => openEdit(emp)}>Edit</button>}
                      {isAdmin && <button className="btn btn-sm" style={{ background: '#fee2e2', color: '#dc2626', border: 'none' }} onClick={() => setDeleteTarget(emp)}>Delete</button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <div className="modal-header">
              <h3>{editing ? 'Edit Employee' : 'Add Employee'}</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Name *</label>
                <input className="form-input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Full name" />
              </div>
              <div className="form-group">
                <label className="form-label">Phone</label>
                <input className="form-input" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="Phone number" />
              </div>
              <div className="form-group">
                <label className="form-label">Address</label>
                <input className="form-input" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder="Address" />
              </div>
              <div className="form-group">
                <label className="form-label">Monthly Salary (Rs)</label>
                <input className="form-input" type="number" min="0" value={form.monthly_salary} onChange={e => setForm(f => ({ ...f, monthly_salary: e.target.value }))} placeholder="0" />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {deleteTarget && (
        <div className="modal-overlay" onClick={() => setDeleteTarget(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 400 }}>
            <div className="modal-header">
              <h3>Delete Employee</h3>
              <button className="modal-close" onClick={() => setDeleteTarget(null)}>✕</button>
            </div>
            <div className="modal-body">
              <p>Delete <strong>{deleteTarget.name}</strong>? If they have transactions, they will be deactivated instead.</p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setDeleteTarget(null)}>Cancel</button>
              <button className="btn" style={{ background: '#dc2626', color: '#fff' }} onClick={handleDelete}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
