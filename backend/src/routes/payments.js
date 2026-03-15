const router = require('express').Router();
const { recordCustomerPayment, recordSupplierPayment, getPayments, getVoucher, revertPayment } = require('../controllers/paymentController');
const { authenticate } = require('../middleware/auth');

router.post('/customer',      authenticate, recordCustomerPayment);
router.post('/supplier',      authenticate, recordSupplierPayment);
router.get('/',               authenticate, getPayments);
router.get('/:id/voucher',    authenticate, getVoucher);
router.post('/:id/revert',    authenticate, revertPayment);

module.exports = router;
