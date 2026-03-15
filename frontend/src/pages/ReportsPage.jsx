import { useEffect, useState } from 'react';
import api from '../services/api';

function fmt(n) { return Number(n || 0).toLocaleString(); }

const TABS = ['Sales Daily', 'Sales Monthly', 'By Product', 'Inventory', 'Customer Dues', 'Supplier Payables', 'Cash Flow'];

export default function ReportsPage() {
  const [tab, setTab] = useState(0);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const endpoints = [
    '/reports/sales/daily', '/reports/sales/monthly', '/reports/sales/by-product',
    '/reports/inventory', '/reports/customer-dues', '/reports/supplier-payables', '/reports/cash-flow',
  ];

  const load = () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (dateFrom) params.set('from', dateFrom);
    if (dateTo) params.set('to', dateTo);
    api.get(`${endpoints[tab]}?${params}`).then(r => {
      // Each report returns different keys; normalize to array
      const d = r.data;
      const arr = d.sales || d.daily || d.products || d.inventory || d.customers || d.suppliers || d.flow || d.transactions || [];
      setData(Array.isArray(arr) ? arr : [arr]);
    }).catch(console.error).finally(() => setLoading(false));
  };

  useEffect(() => { setData(null); load(); }, [tab]);

  const renderTable = () => {
    if (!data || data.length === 0) return <p style={{ padding: 16, color: 'var(--text-muted)' }}>No data for this period.</p>;
    const keys = Object.keys(data[0]);
    return (
      <table className="table">
        <thead><tr>{keys.map(k => <th key={k}>{k.replace(/_/g, ' ').toUpperCase()}</th>)}</tr></thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={i}>{keys.map(k => <td key={k}>{typeof row[k] === 'number' ? fmt(row[k]) : (row[k] ?? '—')}</td>)}</tr>
          ))}
        </tbody>
      </table>
    );
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Reports</h1>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        {TABS.map((t, i) => (
          <button key={i} className={`btn ${tab === i ? 'btn-primary' : 'btn-secondary'} btn-sm`} onClick={() => setTab(i)}>{t}</button>
        ))}
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-body">
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">From</label>
              <input className="form-input" type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">To</label>
              <input className="form-input" type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
            </div>
            <button className="btn btn-primary" onClick={load}>Apply</button>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header"><span className="card-title">{TABS[tab]}</span></div>
        <div className="card-body" style={{ padding: 0 }}>
          {loading ? <div style={{ padding: 24, textAlign: 'center' }}>Loading...</div> : renderTable()}
        </div>
      </div>
    </div>
  );
}
