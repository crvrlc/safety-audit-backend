const prisma = require('../config/db');

// GET all offices
const getOffices = async (req, res) => {
  try {
    const offices = await prisma.office.findMany({
      include: {
        facility: true,
        // unit: true
      }
    });
    res.json(offices);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching offices', error: err.message });
  }
};

// GET single office
const getOfficeById = async (req, res) => {
  try {
    const office = await prisma.office.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        facility: true,
        // unit: true
      }
    });
    if (!office) return res.status(404).json({ message: 'Office not found' });
    res.json(office);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching office', error: err.message });
  }
};

// GET offices by facility
const getOfficesByFacility = async (req, res) => {
  try {
    const facilityId = parseInt(req.params.facilityId)

    if (isNaN(facilityId)) {
      return res.status(400).json({ message: 'Invalid facility ID' })
    }

    const offices = await prisma.office.findMany({
      where: { facilityId },
      include: {
        facility: true,
        // unit: true
      }
    })

    res.json(offices)
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Error fetching offices', error: err.message })
  }
};

// GET offices by unit
const getOfficesByUnit = async (req, res) => {
  try {
    const offices = await prisma.office.findMany({
      where: { unitId: parseInt(req.params.unitId) },
      include: { facility: true }
    });
    res.json(offices);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching offices', error: err.message });
  }
};

// POST create office
const createOffice = async (req, res) => {
  try {
    const { name, facilityId, unitId } = req.body;
    const office = await prisma.office.create({
      data: {
        name,
        facilityId: parseInt(facilityId),
        unitId: parseInt(unitId)
      }
    });
    res.status(201).json(office);
  } catch (err) {
    res.status(500).json({ message: 'Error creating office', error: err.message });
  }
};

// PUT update office
const updateOffice = async (req, res) => {
  try {
    const { name, facilityId, unitId } = req.body;
    const office = await prisma.office.update({
      where: { id: parseInt(req.params.id) },
      data: {
        name,
        facilityId: facilityId ? parseInt(facilityId) : undefined,
        unitId: unitId ? parseInt(unitId) : undefined
      }
    });
    res.json(office);
  } catch (err) {
    res.status(500).json({ message: 'Error updating office', error: err.message });
  }
};

// DELETE office
const deleteOffice = async (req, res) => {
  try {
    await prisma.office.delete({
      where: { id: parseInt(req.params.id) }
    });
    res.json({ message: 'Office deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Error deleting office', error: err.message });
  }
};

module.exports = {
  getOffices,
  getOfficeById,
  getOfficesByFacility,
  getOfficesByUnit,
  createOffice,
  updateOffice,
  deleteOffice
};