const router = require('express').Router();
const { getInventory, getLowStock, addStock, adjustStock, getStockTransactions, updateInventory, deleteInventory, getOrCreateWeight } = require('../controllers/inventoryController');
const { authenticate, requireAdmin } = require('../middleware/auth');

router.get('/',                    authenticate, getInventory);
router.get('/low-stock',           authenticate, getLowStock);
router.get('/stock-transactions',  authenticate, getStockTransactions);
router.post('/add',                authenticate, requireAdmin, addStock);
router.post('/adjust',             authenticate, requireAdmin, adjustStock);
router.post('/weight',             authenticate, requireAdmin, getOrCreateWeight);
router.put('/:id',                 authenticate, requireAdmin, updateInventory);
router.delete('/:id',              authenticate, requireAdmin, deleteInventory);

module.exports = router;
