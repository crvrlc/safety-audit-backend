const prisma = require('../config/db');

const managerScope = async (req, res, next) => {
  try {
    const facilities = await prisma.facility.findMany({
      where: { facilityManagerEmail: req.user.email },
      select: { id: true },
    });

    if (facilities.length === 0) {
      return res.status(403).json({ error: 'No facilities assigned to this manager.' });
    }

    req.managedFacilityIds = facilities.map((f) => f.id);
    next();
  } catch (err) {
    console.error('managerScope error:', err);
    res.status(500).json({ error: 'Failed to load manager scope.' });
  }
};

module.exports = managerScope;