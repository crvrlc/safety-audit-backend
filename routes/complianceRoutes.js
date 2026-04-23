const express = require('express')
const router = express.Router()
const authenticate = require('../middleware/authMiddleware')
const { getOfficerComplianceSummary } = require('../controllers/complianceController')

router.get('/officer-summary', authenticate, getOfficerComplianceSummary)

module.exports = router