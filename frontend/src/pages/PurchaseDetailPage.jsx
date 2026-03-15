import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useToast } from '../context/ToastContext';
import InvoiceView from '../components/InvoiceView';

function fmt(n) { return Number(n || 0).toLocaleString(); }

export default function PurchaseDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [purchase, setPurchase] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showInvoice, setShowInvoice] = useState(false);

  useEffect(() => {
    api.get(`/purchases/${id}`).then(r => setPurchase({ ...r.data.purchase, items: r.data.items })).catch(console.error).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="loading-screen"><div className="spinner" /></div>;
  if (!purchase) return <div className="page-header"><h1 className="page-title">Purchase not found</h1></div>;
  if (showInvoice) return <InvoiceView type="purchase" data={purchase} onClose={() => setShowInvoice(false)} />;

  return (
    <div>
      <div className="page-header">
        <div>
          <button className="btn btn-secondary btn-sm" onClick={() => navigate('/purchases')} style={{ marginBottom: 8 }}>← Back</button>
          <h1 className="page-title">{purchase.invoice_number}</h1>
        </div>
        <button className="btn btn-secondary" onClick={() => setShowInvoice(true)}>View Invoice</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
        <div className="card">
          <div className="card-header"><span className="card-title">Purchase Info</span></div>
          <div className="card-body">
            <table className="table">
              <tbody>
                <tr><td>Supplier</td><td><strong>{purchase.supplier_name}</strong></td></tr>
                <tr><td>Date</td><td>{new Date(purchase.created_at).toLocaleDateString()}</td></tr>
                <tr><td>Total</td><td>Rs {fmt(purchase.total_amount)}</td></tr>
                <tr><td>Paid</td><td>Rs {fmt(purchase.paid_amount)}</td></tr>
                <tr><td>Remaining</td><td style={{ color: purchase.remaining_amount > 0 ? 'var(--warning)' : 'inherit' }}>Rs {fmt(purchase.remaining_amount)}</td></tr>
                <tr><td>Status</td><td><span className={`badge ${purchase.remaining_amount == 0 ? 'badge-success' : purchase.paid_amount > 0 ? 'badge-warning' : 'badge-danger'}`}>{purchase.remaining_amount == 0 ? 'PAID' : purchase.paid_amount > 0 ? 'PARTIAL' : 'UNPAID'}</span></td></tr>
                {purchase.notes && <tr><td>Notes</td><td>{purchase.notes}</td></tr>}
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
                {(purchase.items || []).map((item, i) => (
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
