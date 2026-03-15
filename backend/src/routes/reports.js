const router = require('express').Router();
const {
  getDailySalesReport,
  getMonthlySalesReport,
  getSalesByProduct,
  getInventoryReport,
  getCustomerDuesReport,
  getSupplierPayablesReport,
  getCashFlowReport,
  getTransactionReport,
  getDashboard,
} = require('../controllers/reportController');
const { authenticate } = require('../middleware/auth');

router.get('/sales/daily',        authenticate, getDailySalesReport);
router.get('/sales/monthly',      authenticate, getMonthlySalesReport);
router.get('/sales/by-product',   authenticate, getSalesByProduct);
router.get('/inventory',          authenticate, getInventoryReport);
router.get('/customer-dues',      authenticate, getCustomerDuesReport);
router.get('/supplier-payables',  authenticate, getSupplierPayablesReport);
router.get('/cash-flow',          authenticate, getCashFlowReport);
router.get('/transactions',       authenticate, getTransactionReport);
router.get('/dashboard',          authenticate, getDashboard);

module.exports = router;
