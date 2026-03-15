const router = require('express').Router();
const { getBanks, createBank, updateBank, setBankBalance, deleteBank } = require('../controllers/bankController');
const { authenticate, requireAdmin } = require('../middleware/auth');

router.get('/',            authenticate, getBanks);
router.post('/',           authenticate, requireAdmin, createBank);
router.put('/:id',         authenticate, requireAdmin, updateBank);
router.put('/:id/balance', authenticate, requireAdmin, setBankBalance);
router.delete('/:id',      authenticate, requireAdmin, deleteBank);

module.exports = router;
