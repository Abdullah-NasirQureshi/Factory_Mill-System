const router = require('express').Router();
const { getCustomers, getCustomer, createCustomer, updateCustomer, deleteCustomer } = require('../controllers/customerController');
const { authenticate, requireAdmin } = require('../middleware/auth');

router.get('/',     authenticate, getCustomers);
router.get('/:id',  authenticate, getCustomer);
router.post('/',    authenticate, createCustomer);
router.put('/:id',  authenticate, updateCustomer);
router.delete('/:id', authenticate, requireAdmin, deleteCustomer);

module.exports = router;
