// controllers/notificationController.js

const prisma = require('../config/db')

// GET /notifications/preferences
const getPreferences = async (req, res) => {
  try {
    let prefs = await prisma.notificationPreference.findUnique({
      where: { userId: req.user.id }
    })

    // Auto-create defaults if not yet set
    if (!prefs) {
      prefs = await prisma.notificationPreference.create({
        data: { userId: req.user.id }
      })
    }

    res.json(prefs)
  } catch (err) {
    res.status(500).json({ message: 'Error fetching preferences', error: err.message })
  }
}

// PATCH /notifications/preferences
const updatePreferences = async (req, res) => {
  try {
    const {
      inspectionUpdates,
      statusChanges,
      correctiveActions,
      complianceAlerts,
      systemAnnouncements
    } = req.body

    const prefs = await prisma.notificationPreference.upsert({
      where:  { userId: req.user.id },
      update: { inspectionUpdates, statusChanges, correctiveActions, complianceAlerts, systemAnnouncements },
      create: { userId: req.user.id, inspectionUpdates, statusChanges, correctiveActions, complianceAlerts, systemAnnouncements }
    })

    res.json(prefs)
  } catch (err) {
    res.status(500).json({ message: 'Error updating preferences', error: err.message })
  }
}

module.exports = { getPreferences, updatePreferences }