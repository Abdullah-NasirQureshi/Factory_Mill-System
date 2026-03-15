import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

function fmt(n) { return Number(n || 0).toLocaleString(); }

export default function SalesPage() {
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/sales').then(r => setSales(r.data.sales || [])).catch(console.error).finally(() => setLoading(false));
  }, []);

  const filtered = sales.filter(s =>
    s.invoice_number?.toLowerCase().includes(search.toLowerCase()) ||
    s.customer_name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Sales</h1>
        <button className="btn btn-primary" onClick={() => navigate('/billing')}>+ New Bill</button>
      </div>
      <div className="card">
        <div className="card-header">
          <input className="form-input" style={{ maxWidth: 300 }} placeholder="Search invoice or customer..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="card-body" style={{ padding: 0 }}>
          {loading ? <div style={{ padding: 24, textAlign: 'center' }}>Loading...</div> : (
            <table className="table">
              <thead>
                <tr><th>Invoice</th><th>Date</th><th>Customer</th><th>Total</th><th>Paid</th><th>Remaining</th><th>Status</th></tr>
              </thead>
              <tbody>
                {filtered.length === 0 && <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No sales found</td></tr>}
                {filtered.map(s => (
                  <tr key={s.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/sales/${s.id}`)}>
                    <td><span className="badge badge-info">{s.invoice_number}</span></td>
                    <td>{new Date(s.created_at).toLocaleDateString()}</td>
                    <td>{s.customer_name}</td>
                    <td>Rs {fmt(s.total_amount)}</td>
                    <td>Rs {fmt(s.paid_amount)}</td>
                    <td>Rs {fmt(s.remaining_amount)}</td>
                    <td><span className={`badge ${s.remaining_amount == 0 ? 'badge-success' : s.paid_amount > 0 ? 'badge-warning' : 'badge-danger'}`}>{s.remaining_amount == 0 ? 'PAID' : s.paid_amount > 0 ? 'PARTIAL' : 'UNPAID'}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
