import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';

function fmt(n) { return Number(n || 0).toLocaleString(); }

export default function SupplierDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useAuth();
  const [supplier, setSupplier] = useState(null);
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    api.get(`/suppliers/${id}`)
      .then(r => {
        setSupplier({ ...r.data.supplier, outstanding_payable: r.data.outstanding_payable });
        setPurchases(r.data.purchases || []);
      }).catch(console.error).finally(() => setLoading(false));
  }, [id]);

  const handleDelete = async () => {
    if (!confirm('Delete this supplier? This will fail if they have active purchases or outstanding payables.')) return;
    setDeleting(true);
    try {
      await api.delete(`/suppliers/${id}`);
      toast('Supplier deleted', 'success');
      navigate('/suppliers');
    } catch (err) {
      toast(err.response?.data?.error?.message || 'Cannot delete supplier', 'error');
    } finally { setDeleting(false); }
  };

  if (loading) return <div className="loading-screen"><div className="spinner" /></div>;
  if (!supplier) return <div className="page-header"><h1 className="page-title">Supplier not found</h1></div>;

  return (
    <div>
      <div className="page-header">
        <div>
          <button className="btn btn-secondary btn-sm" onClick={() => navigate('/suppliers')} style={{ marginBottom: 8 }}>← Back</button>
          <h1 className="page-title">{supplier.name}</h1>
        </div>
        {user?.role === 'ADMIN' && (
          <button className="btn btn-danger" onClick={handleDelete} disabled={deleting}>{deleting ? 'Deleting...' : 'Delete'}</button>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, marginBottom: 24 }}>
        <div className="stat-card">
          <div className="stat-label">Outstanding Payable</div>
          <div className="stat-value" style={{ color: supplier.outstanding_payable > 0 ? 'var(--warning)' : 'var(--success)' }}>
            Rs {fmt(supplier.outstanding_payable)}
          </div>
        </div>
        <div className="card">
          <div className="card-header"><span className="card-title">Contact Info</span></div>
          <div className="card-body">
            <p><strong>Phone:</strong> {supplier.phone || '—'}</p>
            <p><strong>Address:</strong> {supplier.address || '—'}</p>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header"><span className="card-title">Purchase History</span></div>
        <div className="card-body" style={{ padding: 0 }}>
          <table className="table">
            <thead><tr><th>Invoice</th><th>Date</th><th>Total</th><th>Paid</th><th>Remaining</th><th>Status</th></tr></thead>
            <tbody>
              {purchases.length === 0 && <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No purchases yet</td></tr>}
              {purchases.map(p => (
                <tr key={p.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/purchases/${p.id}`)}>
                  <td><span className="badge badge-info">{p.invoice_number}</span></td>
                  <td>{new Date(p.created_at).toLocaleDateString()}</td>
                  <td>Rs {fmt(p.total_amount)}</td>
                  <td>Rs {fmt(p.paid_amount)}</td>
                  <td>Rs {fmt(p.remaining_amount)}</td>
                  <td><span className={`badge ${p.remaining_amount == 0 ? 'badge-success' : p.paid_amount > 0 ? 'badge-warning' : 'badge-danger'}`}>{p.remaining_amount == 0 ? 'PAID' : p.paid_amount > 0 ? 'PARTIAL' : 'UNPAID'}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
