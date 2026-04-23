const express = require('express');
const router = express.Router();
const authenticate = require('../middleware/authMiddleware');
const authorize = require('../middleware/roleMiddleware');
const {
  linkUnitToFacility,
  unlinkUnitFromFacility
} = require('../controllers/facilityUnitController');

router.post('/',    authenticate, authorize('admin'), linkUnitToFacility);
router.delete('/',  authenticate, authorize('admin'), unlinkUnitFromFacility);

module.exports = router;