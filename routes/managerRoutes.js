const express = require('express');
const router = express.Router();
const authenticate = require('../middleware/authMiddleware');
const authorize    = require('../middleware/roleMiddleware');
const managerScope = require('../middleware/managerScope');

// console.log('authenticate:', authenticate);  // ← add
// console.log('authorize:', authorize);        // ← add
// console.log('managerScope:', managerScope); 

const {
  getStats,
  getTrend,
  getActivity,
  getFindings,
  updateFinding,
  getAudits,
  acknowledgeAudit,
  completeAudit,
  getMaintenance,
  createMaintenance,
  updateMaintenance,
  getAssignableUsers,
  getCompliance,
  updateProfile,
  updateNotifications,
} = require('../controllers/managerController');

// All manager routes require authentication + facility_manager role + facility scoping
router.use(authenticate, authorize('facility_manager'), managerScope);

// Dashboard
router.get('/stats',                    getStats);
router.get('/trend',                    getTrend);
router.get('/activity',                 getActivity);

// Findings
router.get('/findings',                 getFindings);
router.patch('/findings/:id',           updateFinding);

// Audits
router.get('/audits',                   getAudits);
router.patch('/audits/:id/acknowledge', acknowledgeAudit);
router.patch('/audits/:id/complete', completeAudit);

// Maintenance
router.get('/maintenance',              getMaintenance);
router.post('/maintenance',             createMaintenance);
router.patch('/maintenance/:id',        updateMaintenance);

// Users
router.get('/assignable-users',         getAssignableUsers);

// Compliance
router.get('/compliance',               getCompliance);

// Profile & settings
router.patch('/profile',                updateProfile);
router.patch('/notifications',          updateNotifications);

module.exports = router;