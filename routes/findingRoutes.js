const express = require('express');
const router = express.Router({ mergeParams: true });
const authenticate = require('../middleware/authMiddleware');
const authorize   = require('../middleware/roleMiddleware');
const {
  getAllFindings,
  getMyOfficerFindings,
  getFindingsByAudit,
  getFindingById,
  getManagerFindings,
  assignFinding,
  resolveFinding,
  resolveAllFindings
} = require('../controllers/findingController');

// findings routes
router.get('/',              getAllFindings)
router.get('/my',            getManagerFindings)
router.get('/officer-findings',       getMyOfficerFindings)
router.get('/:id',           getFindingById)
router.patch('/:id/assign',  assignFinding)
router.patch('/:id/resolve', resolveFinding)

// audit-scoped
router.get('/audits/:auditId/findings',         getFindingsByAudit)
router.patch('/audits/:auditId/resolve-all',    resolveAllFindings)

module.exports = router;