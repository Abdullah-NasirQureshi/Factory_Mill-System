import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';

function fmt(n) { return Number(n || 0).toLocaleString(); }

export default function CustomerDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useAuth();
  const [customer, setCustomer] = useState(null);
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    api.get(`/customers/${id}`)
      .then(r => {
        setCustomer({ ...r.data.customer, outstanding_balance: r.data.outstanding_balance });
        setSales(r.data.sales || []);
      }).catch(console.error).finally(() => setLoading(false));
  }, [id]);

  const handleDelete = async () => {
    if (!confirm('Delete this customer? This will fail if they have active sales or an outstanding balance.')) return;
    setDeleting(true);
    try {
      await api.delete(`/customers/${id}`);
      toast('Customer deleted', 'success');
      navigate('/customers');
    } catch (err) {
      toast(err.response?.data?.error?.message || 'Cannot delete customer', 'error');
    } finally {
      setDeleting(false);
    }
  };

  if (loading) return <div className="loading-screen"><div className="spinner" /></div>;
  if (!customer) return <div className="page-header"><h1 className="page-title">Customer not found</h1></div>;

  return (
    <div>
      <div className="page-header">
        <div>
          <button className="btn btn-secondary btn-sm" onClick={() => navigate('/customers')} style={{ marginBottom: 8 }}>← Back</button>
          <h1 className="page-title">{customer.name}</h1>
        </div>
        {user?.role === 'ADMIN' && (
          <button className="btn btn-danger" onClick={handleDelete} disabled={deleting}>{deleting ? 'Deleting...' : 'Delete'}</button>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, marginBottom: 24 }}>
        <div className="stat-card">
          <div className="stat-label">Outstanding Balance</div>
          <div className="stat-value" style={{ color: customer.outstanding_balance > 0 ? 'var(--danger)' : 'var(--success)' }}>
            Rs {fmt(customer.outstanding_balance)}
          </div>
        </div>
        <div className="card">
          <div className="card-header"><span className="card-title">Contact Info</span></div>
          <div className="card-body">
            <p><strong>Phone:</strong> {customer.phone || '—'}</p>
            <p><strong>Address:</strong> {customer.address || '—'}</p>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header"><span className="card-title">Purchase History</span></div>
        <div className="card-body" style={{ padding: 0 }}>
          <table className="table">
            <thead><tr><th>Invoice</th><th>Date</th><th>Total</th><th>Paid</th><th>Remaining</th><th>Status</th></tr></thead>
            <tbody>
              {sales.length === 0 && <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No sales yet</td></tr>}
              {sales.map(s => (
                <tr key={s.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/sales/${s.id}`)}>
                  <td><span className="badge badge-info">{s.invoice_number}</span></td>
                  <td>{new Date(s.created_at).toLocaleDateString()}</td>
                  <td>Rs {fmt(s.total_amount)}</td>
                  <td>Rs {fmt(s.paid_amount)}</td>
                  <td>Rs {fmt(s.remaining_amount)}</td>
                  <td><span className={`badge ${s.remaining_amount == 0 ? 'badge-success' : s.paid_amount > 0 ? 'badge-warning' : 'badge-danger'}`}>{s.remaining_amount == 0 ? 'PAID' : s.paid_amount > 0 ? 'PARTIAL' : 'UNPAID'}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
