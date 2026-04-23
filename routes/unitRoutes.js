const express = require('express');
const router = express.Router();
const authenticate = require('../middleware/authMiddleware');
const authorize = require('../middleware/roleMiddleware');
const {
  getUnits,
  getUnitById,
  getUnitsByFacility,
  createUnit,
  updateUnit,
  deleteUnit
} = require('../controllers/unitController');

router.get('/',                        authenticate, getUnits);
router.get('/:id',                     authenticate, getUnitById);
router.get('/facility/:facilityId',    authenticate, getUnitsByFacility);
router.post('/',                       authenticate, authorize('admin'), createUnit);
router.put('/:id',                     authenticate, authorize('admin'), updateUnit);
router.delete('/:id',                  authenticate, authorize('admin'), deleteUnit);

module.exports = router;