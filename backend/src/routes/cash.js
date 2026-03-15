const router = require('express').Router();
const { getCash, setCashBalance } = require('../controllers/cashController');
const { authenticate, requireAdmin } = require('../middleware/auth');

router.get('/',        authenticate, getCash);
router.put('/balance', authenticate, requireAdmin, setCashBalance);

module.exports = router;
