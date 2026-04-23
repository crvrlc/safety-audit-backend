const express = require('express');
const router = express.Router({ mergeParams: true });
const authenticate = require('../middleware/authMiddleware');
const authorize   = require('../middleware/roleMiddleware');
const {
  getResponsesByAudit,
  saveResponse,
  saveResponsesBulk,
  getAuditProgress
} = require('../controllers/auditResponseController');

router.get('/',         authenticate, getResponsesByAudit);
router.get('/progress', authenticate, getAuditProgress);
router.post('/',        authenticate, authorize('safety_officer', 'admin'), saveResponse);
router.post('/bulk',    authenticate, authorize('safety_officer', 'admin'), saveResponsesBulk);

module.exports = router;