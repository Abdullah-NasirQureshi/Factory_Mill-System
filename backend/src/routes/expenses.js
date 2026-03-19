const router = require('express').Router();
const {
  getGroups, createGroup, updateGroup,
  createKhata, updateKhata,
  getExpenses, createExpense, deleteExpense,
  deleteGroup, deleteKhata,
} = require('../controllers/expenseController');
const { authenticate, requireAdmin } = require('../middleware/auth');

// Groups
router.get('/groups',         authenticate, getGroups);
router.post('/groups',        authenticate, requireAdmin, createGroup);
router.put('/groups/:id',     authenticate, requireAdmin, updateGroup);
router.delete('/groups/:id',  authenticate, requireAdmin, deleteGroup);

// Khatas
router.post('/khatas',        authenticate, requireAdmin, createKhata);
router.put('/khatas/:id',     authenticate, requireAdmin, updateKhata);
router.delete('/khatas/:id',  authenticate, requireAdmin, deleteKhata);

// Expenses
router.get('/',               authenticate, getExpenses);
router.post('/',              authenticate, createExpense);
router.delete('/:id',         authenticate, requireAdmin, deleteExpense);

module.exports = router;
