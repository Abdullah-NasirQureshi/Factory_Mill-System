import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

function StatCard({ label, value, sub, color }) {
  return (
    <div className="stat-card">
      <div className="stat-label">{label}</div>
      <div className="stat-value" style={color ? { color } : {}}>{value}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  );
}

function fmt(n) {
  return Number(n || 0).toLocaleString('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

export default function DashboardPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/reports/dashboard')
      .then(r => setData(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading-screen"><div className="spinner" /></div>;
  if (!data) return <div className="page-header"><h1 className="page-title">Dashboard</h1><p>Failed to load data.</p></div>;

  const today = data.today || {};
  const banks = data.bank_balances || [];
  const lowStock = data.low_stock || [];
  const recentSales = data.recent_sales || [];

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Dashboard</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-primary" onClick={() => navigate('/billing')}>+ New Bill</button>
          <button className="btn btn-secondary" onClick={() => navigate('/purchases')}>+ Purchase</button>
        </div>
      </div>

      <div className="stats-grid">
        <StatCard label="Today's Sales" value={`Rs ${fmt(today.sales)}`} sub={`${today.bills || 0} bills`} />
        <StatCard label="Customer Dues" value={`Rs ${fmt(data.total_dues)}`} color="var(--danger)" />
        <StatCard label="Supplier Payables" value={`Rs ${fmt(data.total_payables)}`} color="var(--warning)" />
        <StatCard label="Employee Outstanding" value={`Rs ${fmt(data.employee_outstanding)}`} color={Number(data.employee_outstanding) > 0 ? '#ef4444' : undefined} />
        <StatCard label="Cash Balance" value={`Rs ${fmt(data.cash_balance)}`} />
        {banks.map(b => (
          <StatCard key={b.id} label={b.bank_name} value={`Rs ${fmt(b.balance)}`} />
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 20, marginTop: 24 }}>
        {/* Recent Sales */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Recent Sales</span>
            <button className="btn btn-secondary btn-sm" onClick={() => navigate('/sales')}>View All</button>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            <table className="table">
              <thead><tr><th>Invoice</th><th>Customer</th><th>Amount</th><th>Date</th></tr></thead>
              <tbody>
                {recentSales.length === 0 && <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No sales yet</td></tr>}
                {recentSales.map(s => (
                  <tr key={s.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/sales/${s.id}`)}>
                    <td><span className="badge badge-info">{s.invoice_number}</span></td>
                    <td>{s.customer_name}</td>
                    <td>Rs {fmt(s.total_amount)}</td>
                    <td>{new Date(s.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Low Stock */}
        {lowStock.length > 0 && (
          <div className="card">
            <div className="card-header">
              <span className="card-title" style={{ color: 'var(--danger)' }}>⚠ Low Stock Alerts</span>
              <button className="btn btn-secondary btn-sm" onClick={() => navigate('/inventory')}>Manage</button>
            </div>
            <div className="card-body" style={{ padding: 0 }}>
              <table className="table">
                <thead><tr><th>Product</th><th>Weight</th><th>Qty</th></tr></thead>
                <tbody>
                  {lowStock.map(s => (
                    <tr key={s.id || s.product_name}>
                      <td>{s.product_name}</td>
                      <td>{s.weight_value}{s.unit}</td>
                      <td><span className="badge badge-danger">{s.quantity}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
