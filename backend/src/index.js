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
app.use('/api/auth',     require('./routes/auth'));
app.use('/api/settings', require('./routes/factory'));
app.use('/api/products', require('./routes/products'));
app.use('/api/weights',  require('./routes/weights'));
app.use('/api/users',    require('./routes/users'));

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
