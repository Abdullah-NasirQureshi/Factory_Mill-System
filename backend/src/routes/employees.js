const router = require('express').Router();
const {
  getEmployees, getEmployee, createEmployee, updateEmployee, deleteEmployee,
  getKhata, createKhataEntry, deleteKhataEntry,
  getEmployeeSalary, createSalaryPayment, deleteSalaryPayment,
} = require('../controllers/employeeController');
const { authenticate, requireAdmin } = require('../middleware/auth');

// Employee CRUD
router.get('/',           authenticate, getEmployees);
router.post('/',          authenticate, requireAdmin, createEmployee);
router.get('/:id',        authenticate, getEmployee);
router.put('/:id',        authenticate, requireAdmin, updateEmployee);
router.delete('/:id',     authenticate, requireAdmin, deleteEmployee);

// Khata entries
router.get('/:id/khata',                    authenticate, getKhata);
router.post('/:id/khata',                   authenticate, createKhataEntry);
router.delete('/:id/khata/:entryId',        authenticate, requireAdmin, deleteKhataEntry);

// Salary payments per employee
router.get('/:id/salary',                   authenticate, getEmployeeSalary);
router.post('/:id/salary',                  authenticate, createSalaryPayment);
router.delete('/:id/salary/:paymentId',     authenticate, requireAdmin, deleteSalaryPayment);

module.exports = router;
