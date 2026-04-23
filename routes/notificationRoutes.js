// routes/notificationRoutes.js

const express = require('express')
const router  = express.Router()
const authenticate = require('../middleware/authMiddleware')
const { getPreferences, updatePreferences } = require('../controllers/notificationController')

router.get('/preferences',   authenticate, getPreferences)
router.patch('/preferences', authenticate, updatePreferences)

module.exports = router