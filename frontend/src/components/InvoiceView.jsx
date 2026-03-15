import { useEffect, useState, useRef } from 'react';
import api from '../services/api';

function fmt(n) { return Number(n || 0).toLocaleString(); }

export default function InvoiceView({ type, data, onClose }) {
  const [settings, setSettings] = useState({});
  const printRef = useRef();

  useEffect(() => {
    api.get('/settings').then(r => setSettings(r.data.settings || {})).catch(() => {});
  }, []);

  const handlePrint = () => {
    const content = printRef.current.innerHTML;
    const win = window.open('', '_blank');
    win.document.write(`<html><head><title>Invoice</title><style>
      body { font-family: Arial, sans-serif; padding: 20px; color: #000; }
      table { width: 100%; border-collapse: collapse; margin: 12px 0; }
      th, td { border: 1px solid #ccc; padding: 8px; text-align: left; font-size: 13px; }
      th { background: #f5f5f5; }
      .header { text-align: center; margin-bottom: 20px; }
      .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px; }
      .totals { text-align: right; margin-top: 12px; }
      .badge { padding: 2px 8px; border-radius: 4px; font-size: 12px; }
    </style></head><body>${content}</body></html>`);
    win.document.close();
    win.print();
  };

  const isSale = type === 'sale';
  const items = data.items || [];
  const docNumber = isSale ? data.invoice_number : data.invoice_number;
  const partyLabel = isSale ? 'Customer' : 'Supplier';
  const partyName = isSale ? data.customer_name : data.supplier_name;
  const dateField = isSale ? data.created_at : data.purchase_date;

  return (
    <div>
      <div className="page-header">
        <div>
          <button className="btn btn-secondary btn-sm" onClick={onClose} style={{ marginBottom: 8 }}>← Back</button>
          <h1 className="page-title">{docNumber}</h1>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-primary" onClick={handlePrint}>Print</button>
        </div>
      </div>

      <div className="card">
        <div className="card-body" ref={printRef}>
          <div className="header" style={{ textAlign: 'center', marginBottom: 24 }}>
            <h2 style={{ margin: 0 }}>{settings.company_name || 'MillFlow ERP'}</h2>
            {settings.address && <p style={{ margin: '4px 0', color: '#666' }}>{settings.address}</p>}
            {settings.phone && <p style={{ margin: '4px 0', color: '#666' }}>Tel: {settings.phone}</p>}
            <h3 style={{ marginTop: 16 }}>{isSale ? 'SALES INVOICE' : 'PURCHASE INVOICE'}</h3>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
            <div>
              <p><strong>{partyLabel}:</strong> {partyName}</p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <p><strong>Invoice #:</strong> {docNumber}</p>
              <p><strong>Date:</strong> {new Date(dateField).toLocaleDateString()}</p>
            </div>
          </div>

          <table className="table">
            <thead>
              <tr><th>#</th><th>Product</th><th>Weight</th><th>Qty</th><th>Price/Unit</th><th>Total</th></tr>
            </thead>
            <tbody>
              {items.map((item, i) => (
                <tr key={i}>
                  <td>{i + 1}</td>
                  <td>{item.product_name}</td>
                  <td>{item.weight_value}{item.unit}</td>
                  <td>{item.quantity}</td>
                  <td>Rs {fmt(item.price)}</td>
                  <td>Rs {fmt(item.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ textAlign: 'right', marginTop: 16 }}>
            <p><strong>Total Amount: Rs {fmt(data.total_amount)}</strong></p>
            <p>Amount Paid: Rs {fmt(data.paid_amount)}</p>
            <p style={{ color: data.remaining_amount > 0 ? 'red' : 'green' }}>
              Remaining: Rs {fmt(data.remaining_amount)}
            </p>
            <p>Status: {data.remaining_amount == 0 ? 'PAID' : data.paid_amount > 0 ? 'PARTIAL' : 'UNPAID'}</p>
          </div>

          {data.notes && <p style={{ marginTop: 16, color: '#666' }}>Notes: {data.notes}</p>}
        </div>
      </div>
    </div>
  );
}
