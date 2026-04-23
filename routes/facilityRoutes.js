const express = require('express');
const router = express.Router();
const authenticate = require('../middleware/authMiddleware');
const authorize = require('../middleware/roleMiddleware');
const {
  getFacilities,
  getFacilityById,
  createFacility,
  updateFacility,
  deleteFacility
} = require('../controllers/facilityController');

router.get('/',    authenticate, getFacilities);
router.get('/:id', authenticate, getFacilityById);
router.post('/',   authenticate, authorize('admin'), createFacility);
router.put('/:id', authenticate, authorize('admin'), updateFacility);
router.delete('/:id', authenticate, authorize('admin'), deleteFacility);

module.exports = router;