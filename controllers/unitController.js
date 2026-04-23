const prisma = require('../config/db');

// GET all units
const getUnits = async (req, res) => {
  try {
    const units = await prisma.unit.findMany({
      include: {
        manager: {
          select: { id: true, name: true, email: true }
        },
        facilityUnits: {
          include: { facility: true }
        },
        offices: true
      }
    });
    res.json(units);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching units', error: err.message });
  }
};

// GET single unit
const getUnitById = async (req, res) => {
  try {
    const unit = await prisma.unit.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        manager: {
          select: { id: true, name: true, email: true }
        },
        facilityUnits: {
          include: { facility: true }
        },
        offices: true
      }
    });
    if (!unit) return res.status(404).json({ message: 'Unit not found' });
    res.json(unit);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching unit', error: err.message });
  }
};

// GET units by facility (via junction table)
const getUnitsByFacility = async (req, res) => {
  try {
    const facilityUnits = await prisma.facilityUnit.findMany({
      where: { facilityId: parseInt(req.params.facilityId) },
      include: {
        unit: {
          include: {
            manager: {
              select: { id: true, name: true, email: true }
            },
            offices: true
          }
        }
      }
    });
    const units = facilityUnits.map(fu => fu.unit);
    res.json(units);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching units', error: err.message });
  }
};

// POST create unit
const createUnit = async (req, res) => {
  try {
    const { name, managerId, facilityIds } = req.body;

    // Create unit first
    const unit = await prisma.unit.create({
      data: {
        name,
        managerId: managerId ? parseInt(managerId) : null
      }
    });

    // Then create facility links separately
    if (facilityIds && facilityIds.length > 0) {
      await prisma.facilityUnit.createMany({
        data: facilityIds.map(id => ({
          unitId: unit.id,
          facilityId: parseInt(id)
        }))
      });
    }

    // Return unit with facilities included
    const unitWithFacilities = await prisma.unit.findUnique({
      where: { id: unit.id },
      include: {
        facilityUnits: { include: { facility: true } },
        manager: { select: { id: true, name: true, email: true } }
      }
    });

    res.status(201).json(unitWithFacilities);
  } catch (err) {
    res.status(500).json({ message: 'Error creating unit', error: err.message });
  }
};

// PUT update unit
const updateUnit = async (req, res) => {
  try {
    const { name, managerId, facilityIds } = req.body;
    const unitId = parseInt(req.params.id);

    // Update unit basic info
    const unit = await prisma.unit.update({
      where: { id: unitId },
      data: {
        name,
        managerId: managerId ? parseInt(managerId) : null
      }
    });

    // If facilityIds provided, replace all facility links
    if (facilityIds) {
      await prisma.facilityUnit.deleteMany({ where: { unitId } });
      await prisma.facilityUnit.createMany({
        data: facilityIds.map(id => ({
          unitId,
          facilityId: parseInt(id)
        }))
      });
    }

    res.json(unit);
  } catch (err) {
    res.status(500).json({ message: 'Error updating unit', error: err.message });
  }
};

// DELETE unit
const deleteUnit = async (req, res) => {
  try {
    const unitId = parseInt(req.params.id);
    // Delete junction records first
    await prisma.facilityUnit.deleteMany({ where: { unitId } });
    await prisma.unit.delete({ where: { id: unitId } });
    res.json({ message: 'Unit deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Error deleting unit', error: err.message });
  }
};

module.exports = {
  getUnits,
  getUnitById,
  getUnitsByFacility,
  createUnit,
  updateUnit,
  deleteUnit
};