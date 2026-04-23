const express = require('express')
const router = express.Router()
const authenticate = require('../middleware/authMiddleware')
const authorize   = require('../middleware/roleMiddleware')

const {
  getAdminStats,
  getAdminMetrics,
  getAdminActivity,
  getUsers,
  getUserById,
  createUser,
  updateUser,
  deactivateUser,
} = require('../controllers/adminController')

const {
  getTemplate,
  getSectionById,
  createSection,
  updateSectionItems,
  reorderSections,
  updateSection,
  deleteSection
} = require('../controllers/checklistAdminController')

// All admin routes require authentication + admin role
router.use(authenticate, authorize('admin'))

// ── Dashboard ──────────────────────────────────────────
router.get('/stats',    getAdminStats)
router.get('/metrics',  getAdminMetrics)
router.get('/activity', getAdminActivity)

// ── User Management ────────────────────────────────────
router.get('/users',      getUsers)
router.get('/users/:id',  getUserById)
router.post('/users',     createUser)
router.put('/users/:id',  updateUser)
router.delete('/users/:id', deactivateUser)

// ── Checklist Templates ────────────────────────────────
router.get('/checklists/template',               getTemplate)
router.get('/checklists/sections/:id',           getSectionById)
router.post('/checklists/sections',              createSection)
router.put('/checklists/reorder',                reorderSections)
router.put('/checklists/sections/:id/items',     updateSectionItems)  
router.put('/checklists/sections/:id',           updateSection)
router.delete('/checklists/sections/:id', deleteSection)       

module.exports = router