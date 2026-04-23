const prisma = require('../config/db');

// GET all facilities
const getFacilities = async (req, res) => {
  try {
    const facilities = await prisma.facility.findMany({
      include: {
        offices: true,
        _count: { select: { offices: true } },
      },
      orderBy: { name: 'asc' },
    })
    res.json(facilities)
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Failed to fetch facilities.' })
  }
};

// GET single facility
const getFacilityById = async (req, res) => {
  try {
    const facility = await prisma.facility.findUnique({
      where: { id: parseInt(req.params.id) },
      include: { offices: true },
    })
    if (!facility) return res.status(404).json({ message: 'Facility not found.' })
    res.json(facility)
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Failed to fetch facility.' })
  }
};

// CREATE new facility
const createFacility = async (req, res) => {
   const { name, unitInCharge, facilityManagerName, facilityManagerEmail, offices = [] } = req.body
 
  if (!name?.trim())         return res.status(400).json({ message: 'Building name is required.' })
  if (!unitInCharge?.trim()) return res.status(400).json({ message: 'Unit in charge is required.' })
 
  try {
    const facility = await prisma.facility.create({
      data: {
        name:                 name.trim(),
        unitInCharge:         unitInCharge.trim(),
        facilityManagerName:  facilityManagerName?.trim() || null,
        facilityManagerEmail: facilityManagerEmail?.trim() || null,
        offices: {
          create: offices
            .filter(o => o.trim())
            .map(o => ({ name: o.trim() })),
        },
      },
      include: { offices: true },
    })
    res.status(201).json(facility)
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Failed to create facility.' })
  }
};

// PUT update facility
const updateFacility = async (req, res) => {
 const id = parseInt(req.params.id)
  const { name, unitInCharge, facilityManagerName, facilityManagerEmail, offices = [] } = req.body
 
  if (!name?.trim())         return res.status(400).json({ message: 'Building name is required.' })
  if (!unitInCharge?.trim()) return res.status(400).json({ message: 'Unit in charge is required.' })
 
  try {
    // Delete old offices then recreate
    // NOTE: only safe if no Audits reference these offices.
    // If audits exist, we do a smarter diff below.
    const existingOffices = await prisma.office.findMany({ where: { facilityId: id }, include: { _count: { select: { audits: true } } } })
 
    const officeNamesNew = offices.filter(o => o.trim()).map(o => o.trim())
 
    // Keep offices that have audits (can't delete those), remove the rest
    const toDelete = existingOffices.filter(o => !officeNamesNew.includes(o.name) && o._count.audits === 0)
    const toAdd    = officeNamesNew.filter(n => !existingOffices.some(o => o.name === n))
 
    await prisma.$transaction([
      prisma.office.deleteMany({ where: { id: { in: toDelete.map(o => o.id) } } }),
      ...toAdd.map(name => prisma.office.create({ data: { name, facilityId: id } })),
      prisma.facility.update({
        where: { id },
        data: {
          name:                 name.trim(),
          unitInCharge:         unitInCharge.trim(),
          facilityManagerName:  facilityManagerName?.trim() || null,
          facilityManagerEmail: facilityManagerEmail?.trim() || null,
        },
      }),
    ])
 
    const updated = await prisma.facility.findUnique({
      where: { id },
      include: { offices: true },
    })
    res.json(updated)
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Failed to update facility.' })
  }
};

// DELETE facility
const deleteFacility = async (req, res) => {
const id = parseInt(req.params.id)
  try {
    // Check if any office in this facility has audits
    const officesWithAudits = await prisma.office.findMany({
      where: { facilityId: id },
      include: { _count: { select: { audits: true } } },
    })
    const hasLinkedAudits = officesWithAudits.some(o => o._count.audits > 0)
    if (hasLinkedAudits) {
      return res.status(409).json({
        message: 'This facility has offices with existing inspection records and cannot be deleted. Archive it instead.',
      })
    }
 
    await prisma.$transaction([
      prisma.office.deleteMany({ where: { facilityId: id } }),
      prisma.facility.delete({ where: { id } }),
    ])
    res.json({ message: 'Facility deleted successfully.' })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Failed to delete facility.' })
  }
};

module.exports = { getFacilities, getFacilityById, createFacility, updateFacility, deleteFacility };