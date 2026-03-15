const router = require('express').Router();
const { getTransactions, getTransaction, getAdjustmentVoucher } = require('../controllers/transactionController');
const { authenticate } = require('../middleware/auth');

router.get('/',              authenticate, getTransactions);
router.get('/:id',           authenticate, getTransaction);
router.get('/:id/voucher',   authenticate, getAdjustmentVoucher);

module.exports = router;
