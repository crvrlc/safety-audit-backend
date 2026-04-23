const express = require('express');
const router = express.Router();
const authenticate = require('../middleware/authMiddleware');
const authorize   = require('../middleware/roleMiddleware');
const {
  getTasksByFinding,
  getMyTasks,
  getAllTasks,
  createTask,
  updateTaskStatus,
  updateTask,
  deleteTask
} = require('../controllers/maintenanceController');

router.get('/',     authenticate, authorize('admin', 'facility_manager'), getAllTasks);
router.get('/my',   authenticate, getMyTasks);
router.get('/finding/:findingId', authenticate, getTasksByFinding);

router.post('/finding/:findingId',  authenticate, authorize('facility_manager', 'admin'), createTask);
router.patch('/:id/status',         authenticate, authorize('facility_manager', 'admin'), updateTaskStatus);
router.put('/:id',                  authenticate, authorize('facility_manager', 'admin'), updateTask);
router.delete('/:id',               authenticate, authorize('facility_manager', 'admin'), deleteTask);

module.exports = router;