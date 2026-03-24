import { useEffect, useRef, useState } from "react";
import api from "../services/api";

function fmt(n) { return Number(n || 0).toLocaleString("en-PK", { minimumFractionDigits: 0 }); }
function fmtDate(d) { return d ? new Date(d).toLocaleDateString("en-PK") : "-"; }
function today() { return new Date().toISOString().slice(0, 10); }
function thisMonth() { const n = new Date(); return { year: n.getFullYear(), month: n.getMonth() + 1 }; }

function printReport(title, company) {
  const name = (company && (company.factory_name || company.company_name)) || "Factory Mill";
  const address = (company && (company.factory_address || company.address)) || "";
  const phone = (company && (company.factory_phone || company.phone)) || "";

  // Inject header into the card-body so it prints at the top of content, not after a blank page
  const cardBody = document.querySelector(".card-body");
  if (!cardBody) { window.print(); return; }

  const header = document.createElement("div");
  header.id = "__print_header__";
  header.style.cssText = "text-align:center;margin-bottom:16px;border-bottom:2px solid #333;padding-bottom:12px";
  header.innerHTML =
    "<h2 style='margin:0;font-size:20px'>" + name + "</h2>" +
    (address ? "<p style='margin:2px 0;font-size:12px'>" + address + "</p>" : "") +
    (phone ? "<p style='margin:2px 0;font-size:12px'>Phone: " + phone + "</p>" : "") +
    "<h3 style='margin:8px 0 0;font-size:14px;text-transform:uppercase'>" + title + "</h3>" +
    "<p style='margin:2px 0;font-size:11px;color:#555'>Printed: " + new Date().toLocaleString("en-PK") + "</p>";

  cardBody.prepend(header);
  window.print();
  const el = document.getElementById("__print_header__");
  if (el) el.remove();
}

function SummaryCard({ label, value, color }) {
  return (
    <div style={{ background: color || "var(--bg-secondary)", borderRadius: 8, padding: "12px 18px", minWidth: 140, flex: 1 }}>
      <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700 }}>Rs {fmt(value)}</div>
    </div>
  );
}

// Searchable combobox component
function Combobox({ options, value, onChange, placeholder }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [inputVal, setInputVal] = useState("");
  const ref = useRef(null);

  // Sync display value when value prop changes externally or options load
  useEffect(() => {
    const selected = options.find(o => String(o.id) === String(value));
    if (selected) setInputVal(selected.label);
    else if (!value) setInputVal("");
  }, [value, options]);

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
        // If nothing selected, restore label or clear
        const selected = options.find(o => String(o.id) === String(value));
        setInputVal(selected ? selected.label : "");
        setQuery("");
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [value, options]);

  const filtered = query
    ? options.filter(o => o.label.toLowerCase().includes(query.toLowerCase()))
    : options;

  function select(opt) {
    onChange(opt.id);
    setInputVal(opt.label);
    setQuery("");
    setOpen(false);
  }

  function handleInput(e) {
    const v = e.target.value;
    setInputVal(v);
    setQuery(v);
    setOpen(true);
    // Only clear selection if user erased the whole field
    if (v === "") onChange(null);
  }

  function handleFocus() {
    setQuery("");
    setOpen(true);
  }

  return (
    <div className="combobox-wrapper" ref={ref}>
      <input
        className="combobox-input"
        type="text"
        placeholder={placeholder || "Search..."}
        value={inputVal}
        onChange={handleInput}
        onFocus={handleFocus}
        autoComplete="off"
      />
      {open && (
        <div className="combobox-dropdown">
          {filtered.length === 0
            ? <div className="combobox-empty">No results</div>
            : filtered.map(o => (
              <div key={o.id} className="combobox-option" onMouseDown={() => select(o)}>{o.label}</div>
            ))}
        </div>
      )}
    </div>
  );
}

function DailySalesReport({ company }) {
  const [date, setDate] = useState(today());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const load = () => { setLoading(true); api.get("/reports/sales/daily?date=" + date).then(r => setData(r.data)).catch(console.error).finally(() => setLoading(false)); };
  useEffect(() => { load(); }, []);
  const s = (data && data.summary) || {};
  return (
    <div>
      <div className="report-controls" style={{ display: "flex", gap: 12, alignItems: "flex-end", marginBottom: 16, flexWrap: "wrap" }}>
        <div className="form-group" style={{ margin: 0 }}><label className="form-label">Date</label><input className="form-input" type="date" value={date} onChange={e => setDate(e.target.value)} /></div>
        <button className="btn btn-primary" onClick={load}>Load</button>
        <button className="btn btn-secondary no-print" onClick={() => printReport("Daily Sales Report - " + date, company)}>Print</button>
      </div>
      {loading && <div style={{ padding: 24, textAlign: "center" }}>Loading...</div>}
      {!loading && data && (<>
        <div className="report-summary" style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
          <SummaryCard label="Total Bills" value={s.total_bills} />
          <SummaryCard label="Total Sales" value={s.total_sales} color="#e8f5e9" />
          <SummaryCard label="Collected" value={s.total_collected} color="#e3f2fd" />
          <SummaryCard label="Outstanding" value={s.total_outstanding} color="#fff3e0" />
        </div>
        <table className="table"><thead><tr><th>#</th><th>Invoice</th><th>Customer</th><th>Total</th><th>Paid</th><th>Remaining</th><th>Time</th></tr></thead>
          <tbody>{(!data.sales || data.sales.length === 0) ? <tr><td colSpan={7} style={{ textAlign: "center", color: "var(--text-muted)" }}>No sales on this date</td></tr>
            : data.sales.map((r, i) => (<tr key={r.id}><td>{i+1}</td><td>{r.invoice_number}</td><td>{r.customer_name}</td><td>Rs {fmt(r.total_amount)}</td><td>Rs {fmt(r.paid_amount)}</td><td style={{ color: r.remaining_amount > 0 ? "#e53935" : "inherit" }}>Rs {fmt(r.remaining_amount)}</td><td>{new Date(r.created_at).toLocaleTimeString("en-PK", { hour: "2-digit", minute: "2-digit" })}</td></tr>))}</tbody>
        </table>
      </>)}
    </div>
  );
}

function MonthlySalesReport({ company }) {
  const { year: cy, month: cm } = thisMonth();
  const [year, setYear] = useState(cy); const [month, setMonth] = useState(cm);
  const [data, setData] = useState(null); const [loading, setLoading] = useState(false);
  const load = () => { setLoading(true); api.get("/reports/sales/monthly?year=" + year + "&month=" + month).then(r => setData(r.data)).catch(console.error).finally(() => setLoading(false)); };
  useEffect(() => { load(); }, []);
  const s = (data && data.summary) || {};
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return (
    <div>
      <div className="report-controls" style={{ display: "flex", gap: 12, alignItems: "flex-end", marginBottom: 16, flexWrap: "wrap" }}>
        <div className="form-group" style={{ margin: 0 }}><label className="form-label">Year</label><input className="form-input" type="number" value={year} onChange={e => setYear(e.target.value)} style={{ width: 90 }} /></div>
        <div className="form-group" style={{ margin: 0 }}><label className="form-label">Month</label><select className="form-input" value={month} onChange={e => setMonth(e.target.value)}>{months.map((m, i) => <option key={i} value={i+1}>{m}</option>)}</select></div>
        <button className="btn btn-primary" onClick={load}>Load</button>
        <button className="btn btn-secondary no-print" onClick={() => printReport("Monthly Sales - " + months[month-1] + " " + year, company)}>Print</button>
      </div>
      {loading && <div style={{ padding: 24, textAlign: "center" }}>Loading...</div>}
      {!loading && data && (<>
        <div className="report-summary" style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
          <SummaryCard label="Total Bills" value={s.total_bills} /><SummaryCard label="Total Sales" value={s.total_sales} color="#e8f5e9" /><SummaryCard label="Collected" value={s.total_collected} color="#e3f2fd" /><SummaryCard label="Outstanding" value={s.total_outstanding} color="#fff3e0" />
        </div>
        <table className="table"><thead><tr><th>Date</th><th>Bills</th><th>Sales</th><th>Collected</th></tr></thead>
          <tbody>{(!data.daily || data.daily.length === 0) ? <tr><td colSpan={4} style={{ textAlign: "center", color: "var(--text-muted)" }}>No data</td></tr> : data.daily.map((r, i) => (<tr key={i}><td>{fmtDate(r.day)}</td><td>{r.bills}</td><td>Rs {fmt(r.sales)}</td><td>Rs {fmt(r.collected)}</td></tr>))}</tbody>
        </table>
      </>)}
    </div>
  );
}

function SalesByProductReport({ company }) {
  const [from, setFrom] = useState(""); const [to, setTo] = useState("");
  const [data, setData] = useState(null); const [loading, setLoading] = useState(false);
  const load = () => { setLoading(true); const p = new URLSearchParams(); if (from) p.set("from", from); if (to) p.set("to", to); api.get("/reports/sales/by-product?" + p).then(r => setData(r.data)).catch(console.error).finally(() => setLoading(false)); };
  useEffect(() => { load(); }, []);
  const rows = (data && data.products) || [];
  const totalRevenue = rows.reduce((s, r) => s + Number(r.total_revenue || 0), 0);
  const totalQty = rows.reduce((s, r) => s + Number(r.total_quantity || 0), 0);
  return (
    <div>
      <div className="report-controls" style={{ display: "flex", gap: 12, alignItems: "flex-end", marginBottom: 16, flexWrap: "wrap" }}>
        <div className="form-group" style={{ margin: 0 }}><label className="form-label">From</label><input className="form-input" type="date" value={from} onChange={e => setFrom(e.target.value)} /></div>
        <div className="form-group" style={{ margin: 0 }}><label className="form-label">To</label><input className="form-input" type="date" value={to} onChange={e => setTo(e.target.value)} /></div>
        <button className="btn btn-primary" onClick={load}>Load</button>
        <button className="btn btn-secondary no-print" onClick={() => printReport("Sales by Product", company)}>Print</button>
      </div>
      {loading && <div style={{ padding: 24, textAlign: "center" }}>Loading...</div>}
      {!loading && (<>
        <div className="report-summary" style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 }}><SummaryCard label="Total Bags Sold" value={totalQty} /><SummaryCard label="Total Revenue" value={totalRevenue} color="#e8f5e9" /></div>
        <table className="table"><thead><tr><th>#</th><th>Product</th><th>Weight</th><th>Invoices</th><th>Bags Sold</th><th>Revenue</th></tr></thead>
          <tbody>{rows.length === 0 ? <tr><td colSpan={6} style={{ textAlign: "center", color: "var(--text-muted)" }}>No data</td></tr> : rows.map((r, i) => (<tr key={i}><td>{i+1}</td><td>{r.product_name}</td><td>{r.weight_value} {r.unit}</td><td>{r.total_sales}</td><td>{fmt(r.total_quantity)}</td><td>Rs {fmt(r.total_revenue)}</td></tr>))}</tbody>
          {rows.length > 0 && <tfoot><tr style={{ fontWeight: 700 }}><td colSpan={4}>Total</td><td>{fmt(totalQty)}</td><td>Rs {fmt(totalRevenue)}</td></tr></tfoot>}
        </table>
      </>)}
    </div>
  );
}

function InventoryReport({ company }) {
  const [data, setData] = useState(null); const [loading, setLoading] = useState(false);
  const load = () => { setLoading(true); api.get("/reports/inventory").then(r => setData(r.data)).catch(console.error).finally(() => setLoading(false)); };
  useEffect(() => { load(); }, []);
  const summary = (data && data.summary) || []; const rows = (data && data.inventory) || [];
  const totalBags = summary.reduce((s, r) => s + Number(r.total_bags || 0), 0);
  const totalKg = summary.reduce((s, r) => s + Number(r.total_kg || 0), 0);
  return (
    <div>
      <div className="report-controls" style={{ display: "flex", gap: 12, marginBottom: 16 }}>
        <button className="btn btn-primary" onClick={load}>Refresh</button>
        <button className="btn btn-secondary no-print" onClick={() => printReport("Inventory Report", company)}>Print</button>
      </div>
      {loading && <div style={{ padding: 24, textAlign: "center" }}>Loading...</div>}
      {!loading && (<>
        <div className="report-summary" style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 }}><SummaryCard label="Total Bags in Stock" value={totalBags} /><SummaryCard label="Total Weight (kg)" value={totalKg} color="#e8f5e9" /></div>
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>Product Summary</div>
          <table className="table"><thead><tr><th>#</th><th>Product</th><th>Total Bags</th><th>Total Weight (kg)</th></tr></thead>
            <tbody>{summary.length === 0 ? <tr><td colSpan={4} style={{ textAlign: "center", color: "var(--text-muted)" }}>No stock</td></tr> : summary.map((r, i) => (<tr key={i}><td>{i+1}</td><td>{r.product_name}</td><td>{fmt(r.total_bags)}</td><td>{fmt(r.total_kg)} kg</td></tr>))}</tbody>
            {summary.length > 0 && <tfoot><tr style={{ fontWeight: 700 }}><td colSpan={2}>Total</td><td>{fmt(totalBags)}</td><td>{fmt(totalKg)} kg</td></tr></tfoot>}
          </table>
        </div>
        <div>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>Detail by Weight</div>
          <table className="table"><thead><tr><th>#</th><th>Product</th><th>Bag Weight</th><th>Bags</th><th>Total Weight</th></tr></thead>
            <tbody>{rows.length === 0 ? <tr><td colSpan={5} style={{ textAlign: "center", color: "var(--text-muted)" }}>No stock</td></tr> : rows.map((r, i) => (<tr key={i}><td>{i+1}</td><td>{r.product_name}</td><td>{r.weight_value} {r.unit}</td><td>{fmt(r.quantity)}</td><td>{fmt(r.total_kg)} kg</td></tr>))}</tbody>
          </table>
        </div>
      </>)}
    </div>
  );
}

function CustomerDuesReport({ company }) {
  const [data, setData] = useState(null); const [loading, setLoading] = useState(false);
  const load = () => { setLoading(true); api.get("/reports/customer-dues").then(r => setData(r.data)).catch(console.error).finally(() => setLoading(false)); };
  useEffect(() => { load(); }, []);
  const rows = (data && data.customers) || [];
  return (
    <div>
      <div className="report-controls" style={{ display: "flex", gap: 12, marginBottom: 16 }}>
        <button className="btn btn-primary" onClick={load}>Refresh</button>
        <button className="btn btn-secondary no-print" onClick={() => printReport("Customer Dues Report", company)}>Print</button>
      </div>
      {loading && <div style={{ padding: 24, textAlign: "center" }}>Loading...</div>}
      {!loading && data && (<>
        <div className="report-summary" style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 }}><SummaryCard label="Customers with Dues" value={rows.length} /><SummaryCard label="Total Outstanding" value={data.total_dues} color="#fff3e0" /></div>
        <table className="table"><thead><tr><th>#</th><th>Customer</th><th>Phone</th><th>Unpaid Invoices</th><th>Outstanding</th></tr></thead>
          <tbody>{rows.length === 0 ? <tr><td colSpan={5} style={{ textAlign: "center", color: "var(--text-muted)" }}>No outstanding dues</td></tr> : rows.map((r, i) => (<tr key={r.id}><td>{i+1}</td><td>{r.name}</td><td>{r.phone || "-"}</td><td>{r.unpaid_invoices}</td><td style={{ color: "#e53935", fontWeight: 600 }}>Rs {fmt(r.outstanding_balance)}</td></tr>))}</tbody>
          {rows.length > 0 && <tfoot><tr style={{ fontWeight: 700 }}><td colSpan={4}>Total</td><td style={{ color: "#e53935" }}>Rs {fmt(data.total_dues)}</td></tr></tfoot>}
        </table>
      </>)}
    </div>
  );
}

function SupplierPayablesReport({ company }) {
  const [data, setData] = useState(null); const [loading, setLoading] = useState(false);
  const load = () => { setLoading(true); api.get("/reports/supplier-payables").then(r => setData(r.data)).catch(console.error).finally(() => setLoading(false)); };
  useEffect(() => { load(); }, []);
  const rows = (data && data.suppliers) || [];
  return (
    <div>
      <div className="report-controls" style={{ display: "flex", gap: 12, marginBottom: 16 }}>
        <button className="btn btn-primary" onClick={load}>Refresh</button>
        <button className="btn btn-secondary no-print" onClick={() => printReport("Supplier Payables Report", company)}>Print</button>
      </div>
      {loading && <div style={{ padding: 24, textAlign: "center" }}>Loading...</div>}
      {!loading && data && (<>
        <div className="report-summary" style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 }}><SummaryCard label="Suppliers with Payables" value={rows.length} /><SummaryCard label="Total Payable" value={data.total_payables} color="#fce4ec" /></div>
        <table className="table"><thead><tr><th>#</th><th>Supplier</th><th>Phone</th><th>Unpaid Invoices</th><th>Payable</th></tr></thead>
          <tbody>{rows.length === 0 ? <tr><td colSpan={5} style={{ textAlign: "center", color: "var(--text-muted)" }}>No outstanding payables</td></tr> : rows.map((r, i) => (<tr key={r.id}><td>{i+1}</td><td>{r.name}</td><td>{r.phone || "-"}</td><td>{r.unpaid_invoices}</td><td style={{ color: "#e53935", fontWeight: 600 }}>Rs {fmt(r.outstanding_payable)}</td></tr>))}</tbody>
          {rows.length > 0 && <tfoot><tr style={{ fontWeight: 700 }}><td colSpan={4}>Total</td><td style={{ color: "#e53935" }}>Rs {fmt(data.total_payables)}</td></tr></tfoot>}
        </table>
      </>)}
    </div>
  );
}

function CashFlowReport({ company }) {
  const [from, setFrom] = useState(""); const [to, setTo] = useState("");
  const [data, setData] = useState(null); const [loading, setLoading] = useState(false);
  const load = () => { setLoading(true); const p = new URLSearchParams(); if (from) p.set("from", from); if (to) p.set("to", to); api.get("/reports/cash-flow?" + p).then(r => setData(r.data)).catch(console.error).finally(() => setLoading(false)); };
  useEffect(() => { load(); }, []);
  const flow = (data && data.flow) || [];
  const totalIn = flow.filter(r => r.transaction_type === "IN").reduce((s, r) => s + Number(r.total || 0), 0);
  const totalOut = flow.filter(r => r.transaction_type === "OUT").reduce((s, r) => s + Number(r.total || 0), 0);
  return (
    <div>
      <div className="report-controls" style={{ display: "flex", gap: 12, alignItems: "flex-end", marginBottom: 16, flexWrap: "wrap" }}>
        <div className="form-group" style={{ margin: 0 }}><label className="form-label">From</label><input className="form-input" type="date" value={from} onChange={e => setFrom(e.target.value)} /></div>
        <div className="form-group" style={{ margin: 0 }}><label className="form-label">To</label><input className="form-input" type="date" value={to} onChange={e => setTo(e.target.value)} /></div>
        <button className="btn btn-primary" onClick={load}>Load</button>
        <button className="btn btn-secondary no-print" onClick={() => printReport("Cash Flow Report", company)}>Print</button>
      </div>
      {loading && <div style={{ padding: 24, textAlign: "center" }}>Loading...</div>}
      {!loading && data && (<>
        <div className="report-summary" style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
          <SummaryCard label="Cash in Hand" value={data.cash_balance} color="#e8f5e9" />
          {(data.bank_balances || []).map(b => (<SummaryCard key={b.bank_name} label={b.bank_name} value={b.balance} color="#e3f2fd" />))}
        </div>
        <div className="report-summary" style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
          <SummaryCard label="Total Money In" value={totalIn} color="#e8f5e9" /><SummaryCard label="Total Money Out" value={totalOut} color="#fce4ec" /><SummaryCard label="Net Flow" value={totalIn - totalOut} color={(totalIn - totalOut) >= 0 ? "#e8f5e9" : "#fce4ec"} />
        </div>
        <table className="table"><thead><tr><th>Type</th><th>Method</th><th>Total Amount</th></tr></thead>
          <tbody>{flow.length === 0 ? <tr><td colSpan={3} style={{ textAlign: "center", color: "var(--text-muted)" }}>No transactions</td></tr> : flow.map((r, i) => (<tr key={i}><td><span style={{ padding: "2px 8px", borderRadius: 4, fontSize: 12, fontWeight: 600, background: r.transaction_type === "IN" ? "#e8f5e9" : "#fce4ec", color: r.transaction_type === "IN" ? "#2e7d32" : "#c62828" }}>{r.transaction_type}</span></td><td>{r.payment_method}</td><td>Rs {fmt(r.total)}</td></tr>))}</tbody>
        </table>
      </>)}
    </div>
  );
}

// ── Individual Report: Product ──────────────────────────────────────────────
function ProductReport({ company }) {
  const [products, setProducts] = useState([]);
  const [productId, setProductId] = useState(null);
  const [from, setFrom] = useState(""); const [to, setTo] = useState("");
  const [data, setData] = useState(null); const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.get("/products").then(r => {
      const list = (r.data && (r.data.products || r.data)) || [];
      setProducts(Array.isArray(list) ? list : []);
    }).catch(console.error);
  }, []);

  const productOptions = products.map(p => ({ id: p.id, label: p.name }));

  const load = () => {
    if (productId == null) return;
    setLoading(true); setError(null); setData(null);
    const p = new URLSearchParams({ product_id: productId });
    if (from) p.set("from", from);
    if (to) p.set("to", to);
    api.get("/reports/individual/product?" + p)
      .then(r => setData(r.data))
      .catch(e => setError(e?.response?.data?.error?.message || "Failed to load report"))
      .finally(() => setLoading(false));
  };

  const salesRows = (data && data.sales) || [];
  const summary = (data && data.summary) || {};
  const purchRows = (data && data.purchases) || [];
  const purchSummary = (data && data.purchase_summary) || {};
  const productName = (products.find(p => String(p.id) === String(productId)) || {}).name || "";

  return (
    <div>
      <div className="report-controls" style={{ display: "flex", gap: 12, alignItems: "flex-end", marginBottom: 16, flexWrap: "wrap" }}>
        <div className="form-group" style={{ margin: 0, minWidth: 220 }}>
          <label className="form-label">Product</label>
          <Combobox options={productOptions} value={productId} onChange={setProductId} placeholder="Search product..." />
        </div>
        <div className="form-group" style={{ margin: 0 }}><label className="form-label">From</label><input className="form-input" type="date" value={from} onChange={e => setFrom(e.target.value)} /></div>
        <div className="form-group" style={{ margin: 0 }}><label className="form-label">To</label><input className="form-input" type="date" value={to} onChange={e => setTo(e.target.value)} /></div>
        <button className="btn btn-primary" onClick={load} disabled={productId == null || loading}>
          {loading ? "Loading..." : "Load"}
        </button>
        {data && !loading && <button className="btn btn-secondary no-print" onClick={() => printReport("Product Report - " + productName, company)}>Print</button>}
      </div>
      {productId == null && !data && <div style={{ color: "var(--text-muted)", padding: "12px 0" }}>Select a product to generate the report.</div>}
      {error && <div className="alert alert-danger">{error}</div>}
      {loading && <div style={{ padding: 24, textAlign: "center" }}>Loading...</div>}
      {!loading && data && (<>

        {/* ── Combined summary cards ── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 20 }}>
          <div style={{ background: "#fce4ec", borderRadius: 8, padding: "12px 16px" }}>
            <div style={{ fontSize: 12, color: "#555", marginBottom: 4 }}>Purchase Invoices</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: "#c62828" }}>{fmt(purchSummary.total_invoices)}</div>
          </div>
          <div style={{ background: "#fce4ec", borderRadius: 8, padding: "12px 16px" }}>
            <div style={{ fontSize: 12, color: "#555", marginBottom: 4 }}>Total Bags Purchased</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: "#c62828" }}>{fmt(purchSummary.total_quantity)}</div>
          </div>
          <div style={{ background: "#fce4ec", borderRadius: 8, padding: "12px 16px" }}>
            <div style={{ fontSize: 12, color: "#555", marginBottom: 4 }}>Total Purchase Cost</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: "#c62828" }}>Rs {fmt(purchSummary.total_cost)}</div>
          </div>
          <div style={{ background: "#e8f5e9", borderRadius: 8, padding: "12px 16px" }}>
            <div style={{ fontSize: 12, color: "#555", marginBottom: 4 }}>Sale Invoices</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: "#2e7d32" }}>{fmt(summary.total_invoices)}</div>
          </div>
          <div style={{ background: "#e8f5e9", borderRadius: 8, padding: "12px 16px" }}>
            <div style={{ fontSize: 12, color: "#555", marginBottom: 4 }}>Total Bags Sold</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: "#2e7d32" }}>{fmt(summary.total_quantity)}</div>
          </div>
          <div style={{ background: "#e8f5e9", borderRadius: 8, padding: "12px 16px" }}>
            <div style={{ fontSize: 12, color: "#555", marginBottom: 4 }}>Total Revenue</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: "#2e7d32" }}>Rs {fmt(summary.total_revenue)}</div>
          </div>
        </div>

        {/* ── Purchases table ── */}
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8, color: "#c62828" }}>Purchases</div>
        <table className="table" style={{ marginBottom: 24 }}>
          <thead><tr><th>#</th><th>Invoice</th><th>Supplier</th><th>Qty</th><th>Unit Price</th><th>Total</th><th>Date</th></tr></thead>
          <tbody>
            {purchRows.length === 0
              ? <tr><td colSpan={7} style={{ textAlign: "center", color: "var(--text-muted)" }}>No purchases found</td></tr>
              : purchRows.map((r, i) => (
                <tr key={i}><td>{i+1}</td><td>{r.invoice_number}</td><td>{r.supplier_name}</td>
                  <td>{fmt(r.quantity)}</td><td>Rs {fmt(r.unit_price)}</td>
                  <td>Rs {fmt(r.total)}</td><td>{fmtDate(r.purchase_date || r.created_at)}</td>
                </tr>
              ))}
          </tbody>
          {purchRows.length > 0 && <tfoot><tr style={{ fontWeight: 700 }}><td colSpan={3}>Total</td><td>{fmt(purchSummary.total_quantity)}</td><td></td><td>Rs {fmt(purchSummary.total_cost)}</td><td></td></tr></tfoot>}
        </table>

        {/* ── Sales table ── */}
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8, color: "#2e7d32" }}>Sales</div>
        <table className="table">
          <thead><tr><th>#</th><th>Invoice</th><th>Customer</th><th>Weight</th><th>Qty</th><th>Price</th><th>Total</th><th>Date</th></tr></thead>
          <tbody>
            {salesRows.length === 0
              ? <tr><td colSpan={8} style={{ textAlign: "center", color: "var(--text-muted)" }}>No sales found</td></tr>
              : salesRows.map((r, i) => (
                <tr key={i}><td>{i+1}</td><td>{r.invoice_number}</td><td>{r.customer_name}</td>
                  <td>{r.weight_value} {r.unit}</td><td>{fmt(r.quantity)}</td>
                  <td>Rs {fmt(r.price)}</td><td>Rs {fmt(r.total)}</td><td>{fmtDate(r.created_at)}</td>
                </tr>
              ))}
          </tbody>
          {salesRows.length > 0 && <tfoot><tr style={{ fontWeight: 700 }}><td colSpan={4}>Total</td><td>{fmt(summary.total_quantity)}</td><td></td><td>Rs {fmt(summary.total_revenue)}</td><td></td></tr></tfoot>}
        </table>
      </>)}
    </div>
  );
}

// ── Individual Report: Customer ─────────────────────────────────────────────
function CustomerReport({ company }) {
  const [customers, setCustomers] = useState([]);
  const [customerId, setCustomerId] = useState(null);
  const [from, setFrom] = useState(""); const [to, setTo] = useState("");
  const [data, setData] = useState(null); const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.get("/customers").then(r => {
      const list = (r.data && (r.data.customers || r.data)) || [];
      setCustomers(Array.isArray(list) ? list : []);
    }).catch(console.error);
  }, []);

  const customerOptions = customers.map(c => ({ id: c.id, label: c.name + (c.phone ? " – " + c.phone : "") }));

  const load = () => {
    if (customerId == null) return;
    setLoading(true); setError(null); setData(null);
    const p = new URLSearchParams({ customer_id: customerId });
    if (from) p.set("from", from);
    if (to) p.set("to", to);
    api.get("/reports/individual/customer?" + p)
      .then(r => setData(r.data))
      .catch(e => setError(e?.response?.data?.error?.message || "Failed to load report"))
      .finally(() => setLoading(false));
  };

  const rows = (data && data.sales) || [];
  const summary = (data && data.summary) || {};
  const customerName = (customers.find(c => String(c.id) === String(customerId)) || {}).name || "";

  return (
    <div>
      <div className="report-controls" style={{ display: "flex", gap: 12, alignItems: "flex-end", marginBottom: 16, flexWrap: "wrap" }}>
        <div className="form-group" style={{ margin: 0, minWidth: 240 }}>
          <label className="form-label">Customer</label>
          <Combobox options={customerOptions} value={customerId} onChange={setCustomerId} placeholder="Search customer..." />
        </div>
        <div className="form-group" style={{ margin: 0 }}><label className="form-label">From</label><input className="form-input" type="date" value={from} onChange={e => setFrom(e.target.value)} /></div>
        <div className="form-group" style={{ margin: 0 }}><label className="form-label">To</label><input className="form-input" type="date" value={to} onChange={e => setTo(e.target.value)} /></div>
        <button className="btn btn-primary" onClick={load} disabled={customerId == null || loading}>
          {loading ? "Loading..." : "Load"}
        </button>
        {data && !loading && <button className="btn btn-secondary no-print" onClick={() => printReport("Customer Report - " + customerName, company)}>Print</button>}
      </div>
      {customerId == null && !data && <div style={{ color: "var(--text-muted)", padding: "12px 0" }}>Select a customer to generate the report.</div>}
      {error && <div className="alert alert-danger">{error}</div>}
      {loading && <div style={{ padding: 24, textAlign: "center" }}>Loading...</div>}
      {!loading && data && (<>
        <div className="report-summary" style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
          <SummaryCard label="Total Invoices" value={summary.total_invoices} />
          <SummaryCard label="Total Billed" value={summary.total_billed} color="#e8f5e9" />
          <SummaryCard label="Total Paid" value={summary.total_paid} color="#e3f2fd" />
          <SummaryCard label="Outstanding" value={summary.total_outstanding} color="#fff3e0" />
        </div>
        <table className="table"><thead><tr><th>#</th><th>Invoice</th><th>Total</th><th>Paid</th><th>Remaining</th><th>Date</th></tr></thead>
          <tbody>{rows.length === 0 ? <tr><td colSpan={6} style={{ textAlign: "center", color: "var(--text-muted)" }}>No sales found</td></tr>
            : rows.map((r, i) => (<tr key={r.id}><td>{i+1}</td><td>{r.invoice_number}</td><td>Rs {fmt(r.total_amount)}</td><td>Rs {fmt(r.paid_amount)}</td><td style={{ color: r.remaining_amount > 0 ? "#e53935" : "inherit" }}>Rs {fmt(r.remaining_amount)}</td><td>{fmtDate(r.created_at)}</td></tr>))}
          </tbody>
          {rows.length > 0 && <tfoot><tr style={{ fontWeight: 700 }}><td colSpan={2}>Total</td><td>Rs {fmt(summary.total_billed)}</td><td>Rs {fmt(summary.total_paid)}</td><td style={{ color: "#e53935" }}>Rs {fmt(summary.total_outstanding)}</td><td></td></tr></tfoot>}
        </table>
      </>)}
    </div>
  );
}

// ── Individual Report: Supplier ─────────────────────────────────────────────
function SupplierReport({ company }) {
  const [suppliers, setSuppliers] = useState([]);
  const [supplierId, setSupplierId] = useState(null);
  const [from, setFrom] = useState(""); const [to, setTo] = useState("");
  const [data, setData] = useState(null); const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.get("/suppliers").then(r => {
      const list = (r.data && (r.data.suppliers || r.data)) || [];
      setSuppliers(Array.isArray(list) ? list : []);
    }).catch(console.error);
  }, []);

  const supplierOptions = suppliers.map(s => ({ id: s.id, label: s.name + (s.phone ? " – " + s.phone : "") }));

  const load = () => {
    if (supplierId == null) return;
    setLoading(true); setError(null); setData(null);
    const p = new URLSearchParams({ supplier_id: supplierId });
    if (from) p.set("from", from);
    if (to) p.set("to", to);
    api.get("/reports/individual/supplier?" + p)
      .then(r => setData(r.data))
      .catch(e => setError(e?.response?.data?.error?.message || "Failed to load report"))
      .finally(() => setLoading(false));
  };

  const rows = (data && data.purchases) || [];
  const summary = (data && data.summary) || {};
  const supplierName = (suppliers.find(s => String(s.id) === String(supplierId)) || {}).name || "";

  return (
    <div>
      <div className="report-controls" style={{ display: "flex", gap: 12, alignItems: "flex-end", marginBottom: 16, flexWrap: "wrap" }}>
        <div className="form-group" style={{ margin: 0, minWidth: 240 }}>
          <label className="form-label">Supplier</label>
          <Combobox options={supplierOptions} value={supplierId} onChange={setSupplierId} placeholder="Search supplier..." />
        </div>
        <div className="form-group" style={{ margin: 0 }}><label className="form-label">From</label><input className="form-input" type="date" value={from} onChange={e => setFrom(e.target.value)} /></div>
        <div className="form-group" style={{ margin: 0 }}><label className="form-label">To</label><input className="form-input" type="date" value={to} onChange={e => setTo(e.target.value)} /></div>
        <button className="btn btn-primary" onClick={load} disabled={supplierId == null || loading}>
          {loading ? "Loading..." : "Load"}
        </button>
        {data && !loading && <button className="btn btn-secondary no-print" onClick={() => printReport("Supplier Report - " + supplierName, company)}>Print</button>}
      </div>
      {supplierId == null && !data && <div style={{ color: "var(--text-muted)", padding: "12px 0" }}>Select a supplier to generate the report.</div>}
      {error && <div className="alert alert-danger">{error}</div>}
      {loading && <div style={{ padding: 24, textAlign: "center" }}>Loading...</div>}
      {!loading && data && (<>
        <div className="report-summary" style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
          <SummaryCard label="Total Purchases" value={summary.total_purchases} />
          <SummaryCard label="Total Billed" value={summary.total_billed} color="#e8f5e9" />
          <SummaryCard label="Total Paid" value={summary.total_paid} color="#e3f2fd" />
          <SummaryCard label="Outstanding" value={summary.total_outstanding} color="#fce4ec" />
        </div>
        <table className="table"><thead><tr><th>#</th><th>Invoice</th><th>Total</th><th>Paid</th><th>Remaining</th><th>Date</th></tr></thead>
          <tbody>{rows.length === 0 ? <tr><td colSpan={6} style={{ textAlign: "center", color: "var(--text-muted)" }}>No purchases found</td></tr>
            : rows.map((r, i) => (<tr key={r.id}><td>{i+1}</td><td>{r.invoice_number}</td><td>Rs {fmt(r.total_amount)}</td><td>Rs {fmt(r.paid_amount)}</td><td style={{ color: r.remaining_amount > 0 ? "#e53935" : "inherit" }}>Rs {fmt(r.remaining_amount)}</td><td>{fmtDate(r.purchase_date || r.created_at)}</td></tr>))}
          </tbody>
          {rows.length > 0 && <tfoot><tr style={{ fontWeight: 700 }}><td colSpan={2}>Total</td><td>Rs {fmt(summary.total_billed)}</td><td>Rs {fmt(summary.total_paid)}</td><td style={{ color: "#e53935" }}>Rs {fmt(summary.total_outstanding)}</td><td></td></tr></tfoot>}
        </table>
      </>)}
    </div>
  );
}

// ── Individual Report: Bank ──────────────────────────────────────────────────
function BankReport({ company }) {
  const [banks, setBanks] = useState([]);
  const [bankId, setBankId] = useState(null);
  const [from, setFrom] = useState(""); const [to, setTo] = useState("");
  const [data, setData] = useState(null); const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.get("/banks").then(r => {
      const list = (r.data && (r.data.banks || r.data)) || [];
      setBanks(Array.isArray(list) ? list : []);
    }).catch(console.error);
  }, []);

  const bankOptions = banks.map(b => ({ id: b.id, label: b.bank_name + (b.account_title ? " – " + b.account_title : "") }));

  const load = () => {
    if (bankId == null) return;
    setLoading(true); setError(null); setData(null);
    const p = new URLSearchParams({ bank_id: bankId });
    if (from) p.set("from", from);
    if (to) p.set("to", to);
    api.get("/reports/individual/bank?" + p)
      .then(r => setData(r.data))
      .catch(e => setError(e?.response?.data?.error?.message || "Failed to load report"))
      .finally(() => setLoading(false));
  };

  const rows = (data && data.transactions) || [];
  const summary = (data && data.summary) || {};
  const bankName = (banks.find(b => String(b.id) === String(bankId)) || {}).bank_name || "";

  return (
    <div>
      <div className="report-controls" style={{ display: "flex", gap: 12, alignItems: "flex-end", marginBottom: 16, flexWrap: "wrap" }}>
        <div className="form-group" style={{ margin: 0, minWidth: 240 }}>
          <label className="form-label">Bank Account</label>
          <Combobox options={bankOptions} value={bankId} onChange={setBankId} placeholder="Search bank..." />
        </div>
        <div className="form-group" style={{ margin: 0 }}><label className="form-label">From</label><input className="form-input" type="date" value={from} onChange={e => setFrom(e.target.value)} /></div>
        <div className="form-group" style={{ margin: 0 }}><label className="form-label">To</label><input className="form-input" type="date" value={to} onChange={e => setTo(e.target.value)} /></div>
        <button className="btn btn-primary" onClick={load} disabled={bankId == null || loading}>
          {loading ? "Loading..." : "Load"}
        </button>
        {data && !loading && <button className="btn btn-secondary no-print" onClick={() => printReport("Bank Report - " + bankName, company)}>Print</button>}
      </div>
      {bankId == null && !data && <div style={{ color: "var(--text-muted)", padding: "12px 0" }}>Select a bank account to generate the report.</div>}
      {error && <div className="alert alert-danger">{error}</div>}
      {loading && <div style={{ padding: 24, textAlign: "center" }}>Loading...</div>}
      {!loading && data && (<>
        <div className="report-summary" style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
          <SummaryCard label="Current Balance" value={summary.current_balance} color="#e3f2fd" />
          <SummaryCard label="Total In" value={summary.total_in} color="#e8f5e9" />
          <SummaryCard label="Total Out" value={summary.total_out} color="#fce4ec" />
        </div>
        <table className="table"><thead><tr><th>#</th><th>Type</th><th>Source</th><th>Amount</th><th>Notes</th><th>Date</th></tr></thead>
          <tbody>{rows.length === 0 ? <tr><td colSpan={6} style={{ textAlign: "center", color: "var(--text-muted)" }}>No transactions found</td></tr>
            : rows.map((r, i) => (<tr key={r.id}><td>{i+1}</td>
              <td><span style={{ padding: "2px 8px", borderRadius: 4, fontSize: 12, fontWeight: 600, background: r.transaction_type === "IN" ? "#e8f5e9" : "#fce4ec", color: r.transaction_type === "IN" ? "#2e7d32" : "#c62828" }}>{r.transaction_type}</span></td>
              <td>{r.source_name || r.source_type}</td><td>Rs {fmt(r.amount)}</td><td>{r.notes || "-"}</td><td>{fmtDate(r.created_at)}</td></tr>))}
          </tbody>
        </table>
      </>)}
    </div>
  );
}

// ── Mill Report ──────────────────────────────────────────────────────────────
function MillReport({ company }) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const load = () => {
    setLoading(true);
    const p = new URLSearchParams();
    if (from) p.set("from", from);
    if (to)   p.set("to", to);
    api.get("/reports/mill?" + p)
      .then(r => setData(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const s = (data && data.summary) || {};
  const sales = (data && data.sales) || {};
  const purchases = (data && data.purchases) || {};
  const expenses = (data && data.expenses) || {};
  const salaries = (data && data.salaries) || {};
  const byGroup = (data && data.expense_by_group) || [];
  const byKhata = (data && data.expense_by_khata) || [];

  const profitColor = Number(s.total_profit) >= 0 ? "#16a34a" : "#dc2626";

  return (
    <div>
      {/* Controls */}
      <div className="report-controls" style={{ display: "flex", gap: 12, alignItems: "flex-end", marginBottom: 20, flexWrap: "wrap" }}>
        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label">From</label>
          <input className="form-input" type="date" value={from} onChange={e => setFrom(e.target.value)} />
        </div>
        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label">To</label>
          <input className="form-input" type="date" value={to} onChange={e => setTo(e.target.value)} />
        </div>
        <button className="btn btn-primary" onClick={load}>Load</button>
        {data && !loading && (
          <button className="btn btn-secondary no-print" onClick={() => printReport("Mill Report", company)}>🖨 Print</button>
        )}
      </div>

      {loading && <div style={{ padding: 24, textAlign: "center" }}>Loading...</div>}

      {!loading && data && (<>

        {/* ── Top Summary Cards ── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 24 }}>
          <div style={{ background: "#e8f5e9", borderRadius: 10, padding: "14px 18px" }}>
            <div style={{ fontSize: 12, color: "#555", marginBottom: 4 }}>Total Revenue</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: "#2e7d32" }}>Rs {fmt(s.total_revenue)}</div>
          </div>
          <div style={{ background: "#fce4ec", borderRadius: 10, padding: "14px 18px" }}>
            <div style={{ fontSize: 12, color: "#555", marginBottom: 4 }}>Total Purchases</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: "#c62828" }}>Rs {fmt(s.total_purchases)}</div>
          </div>
          <div style={{ background: "#fff3e0", borderRadius: 10, padding: "14px 18px" }}>
            <div style={{ fontSize: 12, color: "#555", marginBottom: 4 }}>General Expenses</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: "#e65100" }}>Rs {fmt(s.total_expenses)}</div>
          </div>
          <div style={{ background: "#f3e5f5", borderRadius: 10, padding: "14px 18px" }}>
            <div style={{ fontSize: 12, color: "#555", marginBottom: 4 }}>Total Salaries</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: "#6a1b9a" }}>Rs {fmt(s.total_salaries)}</div>
          </div>
          <div style={{ background: Number(s.total_profit) >= 0 ? "#e8f5e9" : "#fce4ec", borderRadius: 10, padding: "14px 18px", border: "2px solid " + profitColor }}>
            <div style={{ fontSize: 12, color: "#555", marginBottom: 4 }}>Net Profit</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: profitColor }}>Rs {fmt(s.total_profit)}</div>
            <div style={{ fontSize: 11, color: "#888", marginTop: 2 }}>Revenue − Purchases − Expenses − Salaries</div>
          </div>
        </div>

        {/* ── Sales Section ── */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 10, borderBottom: "2px solid #e2e8f0", paddingBottom: 6 }}>
            Sales
          </div>
          <table className="table">
            <tbody>
              <tr><td style={{ width: "60%" }}>Total Invoices</td><td style={{ fontWeight: 600 }}>{fmt(sales.total_invoices)}</td></tr>
              <tr><td>Total Billed (Revenue)</td><td style={{ fontWeight: 600, color: "#2e7d32" }}>Rs {fmt(sales.total_sales)}</td></tr>
              <tr><td>Total Collected</td><td style={{ fontWeight: 600 }}>Rs {fmt(sales.total_collected)}</td></tr>
              <tr><td>Outstanding (Receivable)</td><td style={{ fontWeight: 600, color: "#e53935" }}>Rs {fmt(sales.total_outstanding)}</td></tr>
            </tbody>
          </table>
        </div>

        {/* ── Purchases Section ── */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 10, borderBottom: "2px solid #e2e8f0", paddingBottom: 6 }}>
            Purchases
          </div>
          <table className="table">
            <tbody>
              <tr><td style={{ width: "60%" }}>Total Purchase Invoices</td><td style={{ fontWeight: 600 }}>{fmt(purchases.total_invoices)}</td></tr>
              <tr><td>Total Purchase Amount</td><td style={{ fontWeight: 600, color: "#c62828" }}>Rs {fmt(purchases.total_purchases)}</td></tr>
              <tr><td>Total Paid to Suppliers</td><td style={{ fontWeight: 600 }}>Rs {fmt(purchases.total_paid)}</td></tr>
              <tr><td>Outstanding Payable</td><td style={{ fontWeight: 600, color: "#e53935" }}>Rs {fmt(purchases.total_payable)}</td></tr>
            </tbody>
          </table>
        </div>

        {/* ── General Expenses Section ── */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 10, borderBottom: "2px solid #e2e8f0", paddingBottom: 6 }}>
            General Expenses
          </div>
          <table className="table">
            <thead><tr><th>Group</th><th style={{ textAlign: "right" }}>Total</th></tr></thead>
            <tbody>
              {byGroup.length === 0
                ? <tr><td colSpan={2} style={{ textAlign: "center", color: "var(--text-muted)" }}>No expenses</td></tr>
                : byGroup.map((g, i) => (
                  <tr key={i}>
                    <td>{g.group_name}</td>
                    <td style={{ textAlign: "right", fontWeight: 600 }}>Rs {fmt(g.total)}</td>
                  </tr>
                ))}
            </tbody>
            {byGroup.length > 0 && (
              <tfoot>
                <tr style={{ fontWeight: 700 }}>
                  <td>Total</td>
                  <td style={{ textAlign: "right", color: "#e65100" }}>Rs {fmt(expenses.total_expenses)}</td>
                </tr>
              </tfoot>
            )}
          </table>

          {/* Khata breakdown */}
          {byKhata.length > 0 && (
            <details style={{ marginTop: 10 }}>
              <summary style={{ cursor: "pointer", fontSize: 13, color: "var(--text-muted)", marginBottom: 8 }}>
                Show breakdown by khata
              </summary>
              <table className="table" style={{ fontSize: 13 }}>
                <thead><tr><th>Group</th><th>Khata</th><th style={{ textAlign: "right" }}>Total</th></tr></thead>
                <tbody>
                  {byKhata.map((k, i) => (
                    <tr key={i}>
                      <td style={{ color: "var(--text-muted)" }}>{k.group_name}</td>
                      <td>{k.khata_name}</td>
                      <td style={{ textAlign: "right" }}>Rs {fmt(k.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          )}
        </div>

        {/* ── Salaries Section ── */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 10, borderBottom: "2px solid #e2e8f0", paddingBottom: 6 }}>
            Salaries
          </div>
          <table className="table">
            <tbody>
              <tr><td style={{ width: "60%" }}>Total Salary Payments</td><td style={{ fontWeight: 600 }}>{fmt(salaries.total_payments)}</td></tr>
              <tr><td>Total Salaries Paid</td><td style={{ fontWeight: 600, color: "#6a1b9a" }}>Rs {fmt(salaries.total_salaries)}</td></tr>
            </tbody>
          </table>
        </div>

        {/* ── Profit Summary ── */}
        <div style={{ background: Number(s.total_profit) >= 0 ? "#f0fdf4" : "#fff1f2", border: "2px solid " + profitColor, borderRadius: 10, padding: "16px 20px" }}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12 }}>Profit & Loss Summary</div>
          <table className="table">
            <tbody>
              <tr><td style={{ width: "60%" }}>Total Revenue</td><td style={{ fontWeight: 600, color: "#2e7d32" }}>+ Rs {fmt(s.total_revenue)}</td></tr>
              <tr><td>Total Purchases</td><td style={{ fontWeight: 600, color: "#c62828" }}>− Rs {fmt(s.total_purchases)}</td></tr>
              <tr><td>General Expenses</td><td style={{ fontWeight: 600, color: "#e65100" }}>− Rs {fmt(s.total_expenses)}</td></tr>
              <tr><td>Salaries Paid</td><td style={{ fontWeight: 600, color: "#6a1b9a" }}>− Rs {fmt(s.total_salaries)}</td></tr>
              <tr style={{ borderTop: "2px solid " + profitColor }}>
                <td style={{ fontWeight: 800, fontSize: 15 }}>Net Profit</td>
                <td style={{ fontWeight: 800, fontSize: 18, color: profitColor }}>Rs {fmt(s.total_profit)}</td>
              </tr>
            </tbody>
          </table>
        </div>

      </>)}
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────
const TABS = [
  "Mill Report",
  "Daily Sales", "Monthly Sales", "By Product", "Inventory",
  "Customer Dues", "Supplier Payables", "Cash Flow",
  "By Product (Individual)", "By Customer", "By Supplier", "By Bank",
];

export default function ReportsPage() {
  const [tab, setTab] = useState(0);
  const [company, setCompany] = useState(null);
  useEffect(() => { api.get("/settings").then(r => { const d = r.data; setCompany((d && d.settings) || d || null); }).catch(() => {}); }, []);

  const components = [
    <MillReport key="mill" company={company} />,
    <DailySalesReport key="daily" company={company} />,
    <MonthlySalesReport key="monthly" company={company} />,
    <SalesByProductReport key="byproduct" company={company} />,
    <InventoryReport key="inventory" company={company} />,
    <CustomerDuesReport key="custdues" company={company} />,
    <SupplierPayablesReport key="suppay" company={company} />,
    <CashFlowReport key="cashflow" company={company} />,
    <ProductReport key="indproduct" company={company} />,
    <CustomerReport key="indcustomer" company={company} />,
    <SupplierReport key="indsupplier" company={company} />,
    <BankReport key="indbank" company={company} />,
  ];

  return (
    <div>
      <div className="page-header"><h1 className="page-title">Reports</h1></div>
      <div className="report-tabs" style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
        {TABS.map((t, i) => (
          <button key={i} className={"btn btn-sm " + (tab === i ? "btn-primary" : "btn-secondary")} onClick={() => setTab(i)}>{t}</button>
        ))}
      </div>
      <div className="card">
        <div className="card-header"><span className="card-title">{TABS[tab]}</span></div>
        <div className="card-body">{components[tab]}</div>
      </div>
    </div>
  );
}
