const express = require('express');
const router = express.Router();
const authenticate = require('../middleware/authMiddleware');
const authorize    = require('../middleware/roleMiddleware');
const {
  getFindingById,
  getMyFindings,
  getAllFindings,
  assignFinding,
  resolveFinding,
  resolveAllFindings
} = require('../controllers/findingController');

router.get('/',    authenticate, getAllFindings)
router.get('/my',  authenticate, getMyFindings)
router.get('/:id', authenticate, getFindingById)

router.patch('/:id/assign',
  authenticate,
  authorize('facility_manager', 'admin'),
  assignFinding
)

router.patch('/:id/resolve',
  authenticate,
  authorize('facility_manager', 'admin'),
  resolveFinding
)

module.exports = router;