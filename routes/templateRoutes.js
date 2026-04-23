const express = require('express');
const authenticate = require('../middleware/authMiddleware');
const authorize = require('../middleware/roleMiddleware');
const {
  getAllTemplates,
  createTemplate,
  updateTemplate
} = require('../controllers/templateController');

const router = express.Router();

router.get('/', authenticate, getAllTemplates);
router.post('/', authenticate, authorize('admin'), createTemplate);
router.put('/:id', authenticate, authorize('admin'), updateTemplate);

module.exports = router;