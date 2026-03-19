const router = require('express').Router();
const { getSalaryPayments } = require('../controllers/employeeController');
const { authenticate } = require('../middleware/auth');

// GET /api/salary  — factory-wide salary list with optional ?employee_id= ?month=
router.get('/', authenticate, getSalaryPayments);

module.exports = router;
