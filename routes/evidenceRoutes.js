const express = require('express');
const router = express.Router();
const authenticate = require('../middleware/authMiddleware');
const authorize   = require('../middleware/roleMiddleware');
const { upload }  = require('../config/cloudinary');
const {
  getEvidenceByFinding,
  getEvidenceByResponse,
  uploadResponseEvidence,
  uploadFindingEvidence,
  deleteEvidence
} = require('../controllers/evidenceController');

// Get evidence
router.get('/finding/:findingId',   authenticate, getEvidenceByFinding);
router.get('/response/:responseId', authenticate, getEvidenceByResponse);

// Upload evidence — single file upload
router.post(
  '/response/:responseId',
  authenticate,
  authorize('safety_officer', 'facility_manager', 'admin'),
  upload.single('file'),
  uploadResponseEvidence
);

router.post(
  '/finding/:findingId',
  authenticate,
  authorize('safety_officer', 'facility_manager', 'admin'),
  upload.single('file'),
  uploadFindingEvidence
);

// Delete evidence
router.delete('/:id', authenticate, authorize('safety_officer', 'admin'), deleteEvidence);

module.exports = router;