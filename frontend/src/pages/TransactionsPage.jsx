import { useEffect, useState } from 'react';
import api from '../services/api';

function fmt(n) { return Number(n || 0).toLocaleString(); }

const TYPE_COLORS = {
  SALE: 'badge-success', PURCHASE: 'badge-warning', PAYMENT_IN: 'badge-info',
  PAYMENT_OUT: 'badge-danger', ADJUST: 'badge-secondary', REVERSAL: 'badge-danger',
};

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ from: '', to: '', type: '', method: '', source_type: '' });

  const load = () => {
    const params = new URLSearchParams();
    if (filters.from)        params.set('from', filters.from);
    if (filters.to)          params.set('to', filters.to);
    if (filters.type)        params.set('type', filters.type);
    if (filters.method)      params.set('method', filters.method);
    if (filters.source_type) params.set('source_type', filters.source_type);
    api.get(`/transactions?${params}`).then(r => setTransactions(r.data.data?.transactions || r.data.transactions || [])).catch(console.error).finally(() => setLoading(false));
  };

  useEffect(load, []);

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Transaction Ledger</h1>
        <button className="btn btn-secondary" onClick={load}>Refresh</button>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-body">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">From</label>
              <input className="form-input" type="date" value={filters.from} onChange={e => setFilters(f => ({ ...f, from: e.target.value }))} />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">To</label>
              <input className="form-input" type="date" value={filters.to} onChange={e => setFilters(f => ({ ...f, to: e.target.value }))} />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Type</label>
              <select className="form-select" value={filters.type} onChange={e => setFilters(f => ({ ...f, type: e.target.value }))}>
                <option value="">All Types</option>
                {['SALE', 'PURCHASE', 'PAYMENT_IN', 'PAYMENT_OUT', 'ADJUST', 'REVERSAL'].map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Method</label>
              <select className="form-select" value={filters.method} onChange={e => setFilters(f => ({ ...f, method: e.target.value }))}>
                <option value="">All Methods</option>
                {['CASH', 'BANK', 'NONE'].map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Source</label>
              <select className="form-select" value={filters.source_type} onChange={e => setFilters(f => ({ ...f, source_type: e.target.value }))}>
                <option value="">All Sources</option>
                {['CUSTOMER', 'SUPPLIER', 'EMPLOYEE', 'SYSTEM'].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end' }}>
              <button className="btn btn-primary btn-full" onClick={load}>Filter</button>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-body" style={{ padding: 0 }}>
          {loading ? <div style={{ padding: 24, textAlign: 'center' }}>Loading...</div> : (
            <table className="table">
              <thead><tr><th>Date</th><th>Type</th><th>Reference</th><th>Description</th><th>Method</th><th>Amount</th></tr></thead>
              <tbody>
                {transactions.length === 0 && <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No transactions found</td></tr>}
                {transactions.map(t => (
                  <tr key={t.id}>
                    <td>{new Date(t.created_at).toLocaleDateString()}</td>
                    <td><span className={`badge ${TYPE_COLORS[t.transaction_type] || 'badge-secondary'}`}>{t.transaction_type}</span></td>
                    <td>{t.voucher_number || '—'}</td>
                    <td>{t.source_name || '—'}</td>
                    <td>{t.payment_method || '—'}</td>
                    <td>Rs {fmt(t.amount)}</td>
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
