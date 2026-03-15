const router = require('express').Router();
const { getWeights, getWeightsByProduct } = require('../controllers/weightController');
const { authenticate } = require('../middleware/auth');

router.get('/', authenticate, getWeights);
router.get('/by-product/:productId', authenticate, getWeightsByProduct);

module.exports = router;
