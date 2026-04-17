require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Health check
app.get('/api/health', (req, res) => res.json({ success: true, status: 'ok' }));

// Routes
app.use('/api/auth',      require('./routes/auth'));
app.use('/api/settings',  require('./routes/factory'));
app.use('/api/products',  require('./routes/products'));
app.use('/api/weights',   require('./routes/weights'));
app.use('/api/users',     require('./routes/users'));
app.use('/api/inventory', require('./routes/inventory'));
app.use('/api/customers', require('./routes/customers'));
app.use('/api/suppliers', require('./routes/suppliers'));
app.use('/api/cash',         require('./routes/cash'));
app.use('/api/banks',        require('./routes/banks'));
app.use('/api/sales',        require('./routes/sales'));
app.use('/api/purchases',    require('./routes/purchases'));
app.use('/api/payments',     require('./routes/payments'));
app.use('/api/transactions', require('./routes/transactions'));
app.use('/api/reports',      require('./routes/reports'));
app.use('/api/seasons',      require('./routes/seasons'));
app.use('/api/expenses',     require('./routes/expenses'));
app.use('/api/employees',    require('./routes/employees'));
app.use('/api/salary',       require('./routes/salary'));
app.use('/api/gate-passes',  require('./routes/gatePasses'));

// Global error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({
    success: false,
    error: { code: err.code || 'SERVER_ERROR', message: err.message || 'Internal server error' },
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Backend running on http://localhost:${PORT}`));

module.exports = app;
