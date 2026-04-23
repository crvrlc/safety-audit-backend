const express = require('express');
const router = express.Router();
const authenticate = require('../middleware/authMiddleware');
const authorize   = require('../middleware/roleMiddleware');
const {
  getAudits,
  getMyAudits,
  getAuditById,
  createAudit,
  startAudit,
  submitAudit,
  updateAudit,
  deleteAudit,
  signOffAudit
} = require('../controllers/auditController');

const resolveAllFindings = require('../controllers/findingController').resolveAllFindings;
const auditResponseRoutes = require('./auditResponseRoutes');
const findingRoutes = require('./findingRoutes');

// All roles can view
router.get('/',      authenticate, getAudits);
router.get('/my',    authenticate, getMyAudits);
router.get('/:id',   authenticate, getAuditById);

// Safety officer creates and manages audits
router.post('/',            authenticate, authorize('safety_officer', 'admin'), createAudit);
router.patch('/:id/start',  authenticate, authorize('safety_officer'), startAudit);
router.patch('/:id/submit', authenticate, authorize('safety_officer', 'admin'), submitAudit);
router.put('/:id',          authenticate, authorize('safety_officer', 'admin'), updateAudit);
router.delete('/:id',       authenticate, authorize('safety_officer', 'admin'), deleteAudit);
router.patch('/:id/signoff', authenticate, authorize('safety_officer', 'admin'), signOffAudit);
router.patch('/:auditId/resolve-all',
  authenticate,
  authorize('facility_manager', 'admin'),
  resolveAllFindings
)

// Nested routes for audit responses
router.use('/:auditId/responses', auditResponseRoutes);

// Nested routes for findings
router.use('/:auditId/findings', findingRoutes);

module.exports = router;