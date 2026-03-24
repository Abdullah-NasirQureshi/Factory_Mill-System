const express = require('express');
const router = express.Router();
const { authenticate, requireAdmin } = require('../middleware/auth');
const { getGatePasses, getGatePass, createGatePass, deleteGatePass } = require('../controllers/gatePassController');

router.get('/',     authenticate, getGatePasses);
router.get('/:id',  authenticate, getGatePass);
router.post('/',    authenticate, createGatePass);
router.delete('/:id', authenticate, requireAdmin, deleteGatePass);

module.exports = router;
