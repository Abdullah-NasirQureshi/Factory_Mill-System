const router = require('express').Router();
const { authenticate, requireAdmin } = require('../middleware/auth');
const {
  listSeasons,
  getActiveSeason,
  getOpeningBalances,
  getOpeningBalanceEntities,
  upsertOpeningBalances,
  closeSeason,
} = require('../controllers/seasonController');

router.use(authenticate);

router.get('/',                                  listSeasons);
router.get('/active',                            getActiveSeason);
router.get('/active/opening-balances/entities',  requireAdmin, getOpeningBalanceEntities);
router.put('/active/opening-balances',           requireAdmin, upsertOpeningBalances);
router.get('/:id/opening-balances',              getOpeningBalances);
router.post('/close',                            requireAdmin, closeSeason);

module.exports = router;
