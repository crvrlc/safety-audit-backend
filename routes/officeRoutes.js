const express = require('express');
const router = express.Router();
const authenticate = require('../middleware/authMiddleware');
const authorize = require('../middleware/roleMiddleware');
const {
  getOffices,
  getOfficeById,
  getOfficesByFacility,
  getOfficesByUnit,
  createOffice,
  updateOffice,
  deleteOffice
} = require('../controllers/officeController');

router.get('/',                       authenticate, getOffices);
router.get('/:id',                    authenticate, getOfficeById);
router.get('/facility/:facilityId',   authenticate, getOfficesByFacility);
router.get('/unit/:unitId',           authenticate, getOfficesByUnit);
router.post('/',                      authenticate, authorize('admin'), createOffice);
router.put('/:id',                    authenticate, authorize('admin'), updateOffice);
router.delete('/:id',                 authenticate, authorize('admin'), deleteOffice);

module.exports = router;