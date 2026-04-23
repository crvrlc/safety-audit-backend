const prisma = require('../config/db');

// Link a unit to a facility
const linkUnitToFacility = async (req, res) => {
  try {
    const { facilityId, unitId } = req.body;
    const link = await prisma.facilityUnit.create({
      data: {
        facilityId: parseInt(facilityId),
        unitId: parseInt(unitId)
      }
    });
    res.status(201).json(link);
  } catch (err) {
    res.status(500).json({ message: 'Error linking unit to facility', error: err.message });
  }
};

// Unlink a unit from a facility
const unlinkUnitFromFacility = async (req, res) => {
  try {
    const { facilityId, unitId } = req.body;
    await prisma.facilityUnit.delete({
      where: {
        facilityId_unitId: {
          facilityId: parseInt(facilityId),
          unitId: parseInt(unitId)
        }
      }
    });
    res.json({ message: 'Unit unlinked from facility' });
  } catch (err) {
    res.status(500).json({ message: 'Error unlinking unit', error: err.message });
  }
};

module.exports = { linkUnitToFacility, unlinkUnitFromFacility };