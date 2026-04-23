const express = require('express');
const router = express.Router({ mergeParams: true });
const authenticate = require('../middleware/authMiddleware');
const authorize   = require('../middleware/roleMiddleware');
const {
  getAllFindings,
  getFindingsByAudit,
  getFindingById,
  getMyFindings,
  assignFinding,
  resolveFinding,
  resolveAllFindings
} = require('../controllers/findingController');

// Nested under audits
// router.get('/',     authenticate, getFindingsByAudit);
// router.post('/',    authenticate, authorize('safety_officer', 'admin'), createFinding);

// // 🔹 GLOBAL ROUTES (not tied to audit)
// router.get('/', authenticate, getAllFindings);        
// router.get('/my', authenticate, getMyFindings);

// // 🔹 ACTIONS
// router.patch('/:id/resolve', authenticate, resolveFinding);

// // 🔹 NESTED (keep this if used under audits)
// router.get('/audit/:auditId', authenticate, getFindingsByAudit);

// findings routes
router.get('/',              getAllFindings)
router.get('/my',            getMyFindings)
router.get('/:id',           getFindingById)
router.patch('/:id/assign',  assignFinding)
router.patch('/:id/resolve', resolveFinding)

// audit-scoped
router.get('/audits/:auditId/findings',         getFindingsByAudit)
router.patch('/audits/:auditId/resolve-all',    resolveAllFindings)

module.exports = router;