const router = require('express').Router();
const { getSuppliers, getSupplier, createSupplier, updateSupplier, deleteSupplier } = require('../controllers/supplierController');
const { authenticate, requireAdmin } = require('../middleware/auth');

router.get('/',     authenticate, getSuppliers);
router.get('/:id',  authenticate, getSupplier);
router.post('/',    authenticate, createSupplier);
router.put('/:id',  authenticate, updateSupplier);
router.delete('/:id', authenticate, requireAdmin, deleteSupplier);

module.exports = router;
