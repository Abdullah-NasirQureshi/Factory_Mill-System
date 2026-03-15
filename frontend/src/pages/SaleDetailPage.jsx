import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import InvoiceView from '../components/InvoiceView';

function fmt(n) { return Number(n || 0).toLocaleString(); }

export default function SaleDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useAuth();
  const [sale, setSale] = useState(null);
  const [loading, setLoading] = useState(true);
  const [reverting, setReverting] = useState(false);
  const [showInvoice, setShowInvoice] = useState(false);

  const load = () => {
    api.get(`/sales/${id}`).then(r => setSale({ ...r.data.sale, items: r.data.items, payments: r.data.payments })).catch(console.error).finally(() => setLoading(false));
  };
  useEffect(load, [id]);

  const handleRevert = async () => {
    if (!confirm('Revert this sale? This will restore inventory and reverse all payments.')) return;
    setReverting(true);
    try {
      await api.post(`/sales/${id}/revert`);
      toast('Sale reverted successfully', 'success');
      load();
    } catch (err) {
      toast(err.response?.data?.error?.message || 'Revert failed', 'error');
    } finally {
      setReverting(false);
    }
  };

  if (loading) return <div className="loading-screen"><div className="spinner" /></div>;
  if (!sale) return <div className="page-header"><h1 className="page-title">Sale not found</h1></div>;

  if (showInvoice) return <InvoiceView type="sale" data={sale} onClose={() => setShowInvoice(false)} />;

  return (
    <div>
      <div className="page-header">
        <div>
          <button className="btn btn-secondary btn-sm" onClick={() => navigate('/sales')} style={{ marginBottom: 8 }}>← Back</button>
          <h1 className="page-title">{sale.invoice_number}</h1>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary" onClick={() => setShowInvoice(true)}>View Invoice</button>
      {sale.status !== 'REVERTED' && (
            <button className="btn btn-danger" onClick={handleRevert} disabled={reverting}>
              {reverting ? 'Reverting...' : 'Revert Sale'}
            </button>
          )}
        </div>
      </div>

          {sale.status === 'REVERTED' && (
            <div className="alert alert-danger" style={{ marginBottom: 16 }}>This sale has been reverted.</div>
          )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
        <div className="card">
          <div className="card-header"><span className="card-title">Sale Info</span></div>
          <div className="card-body">
            <table className="table">
              <tbody>
                <tr><td>Customer</td><td><strong>{sale.customer_name}</strong></td></tr>
                <tr><td>Date</td><td>{new Date(sale.created_at).toLocaleDateString()}</td></tr>
                <tr><td>Total</td><td>Rs {fmt(sale.total_amount)}</td></tr>
                <tr><td>Paid</td><td>Rs {fmt(sale.paid_amount)}</td></tr>
                <tr><td>Remaining</td><td style={{ color: sale.remaining_amount > 0 ? 'var(--danger)' : 'inherit' }}>Rs {fmt(sale.remaining_amount)}</td></tr>
                <tr><td>Status</td><td><span className={`badge ${sale.remaining_amount == 0 ? 'badge-success' : sale.paid_amount > 0 ? 'badge-warning' : 'badge-danger'}`}>{sale.remaining_amount == 0 ? 'PAID' : sale.paid_amount > 0 ? 'PARTIAL' : 'UNPAID'}</span></td></tr>
                {sale.notes && <tr><td>Notes</td><td>{sale.notes}</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <div className="card-header"><span className="card-title">Items</span></div>
          <div className="card-body" style={{ padding: 0 }}>
            <table className="table">
              <thead><tr><th>Product</th><th>Weight</th><th>Qty</th><th>Price</th><th>Total</th></tr></thead>
              <tbody>
                {(sale.items || []).map((item, i) => (
                  <tr key={i}>
                    <td>{item.product_name}</td>
                    <td>{item.weight_value}{item.unit}</td>
                    <td>{item.quantity}</td>
                    <td>Rs {fmt(item.price)}</td>
                    <td>Rs {fmt(item.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
