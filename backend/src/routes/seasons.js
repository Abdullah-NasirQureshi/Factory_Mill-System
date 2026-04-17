const router = require('express').Router();
const { authenticate, requireAdmin } = require('../middleware/auth');
const { listSeasons, getActiveSeason, getOpeningBalances, closeSeason } = require('../controllers/seasonController');

router.use(authenticate);

router.get('/',           listSeasons);
router.get('/active',     getActiveSeason);
router.get('/:id/opening-balances', getOpeningBalances);
router.post('/close',     requireAdmin, closeSeason);

module.exports = router;
