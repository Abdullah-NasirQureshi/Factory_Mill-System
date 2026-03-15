const router = require('express').Router();
const { createSale, getSales, getSale, getInvoice, revertSale } = require('../controllers/salesController');
const { authenticate } = require('../middleware/auth');

router.post('/',            authenticate, createSale);
router.get('/',             authenticate, getSales);
router.get('/:id',          authenticate, getSale);
router.get('/:id/invoice',  authenticate, getInvoice);
router.post('/:id/revert',  authenticate, revertSale);

module.exports = router;
