const router = require('express').Router();
const { getProducts, getActiveProducts, createProduct, updateProduct, updateProductStatus } = require('../controllers/productController');
const { authenticate, requireAdmin } = require('../middleware/auth');

router.get('/', authenticate, getProducts);
router.get('/active', authenticate, getActiveProducts);
router.post('/', authenticate, requireAdmin, createProduct);
router.put('/:id', authenticate, requireAdmin, updateProduct);
router.put('/:id/status', authenticate, requireAdmin, updateProductStatus);

module.exports = router;
