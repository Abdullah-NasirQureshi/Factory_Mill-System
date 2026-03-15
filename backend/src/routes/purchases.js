const router = require('express').Router();
const { createPurchase, getPurchases, getPurchase, getPurchaseInvoice } = require('../controllers/purchaseController');
const { authenticate } = require('../middleware/auth');

router.post('/',             authenticate, createPurchase);
router.get('/',              authenticate, getPurchases);
router.get('/:id',           authenticate, getPurchase);
router.get('/:id/invoice',   authenticate, getPurchaseInvoice);

module.exports = router;
