const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

// ─── GET /api/admin/checklists/template ───────────────
// Returns the active checklist template with all sections and items
const getTemplate = async (req, res) => {
  try {
    const template = await prisma.checklistTemplate.findFirst({
      where: { isActive: true },
      include: {
        sections: {
          where: { isActive: true },  
          orderBy: { order: 'asc' },
          include: {
            items: {
              orderBy: { order: 'asc' },
            },
          },
        },
      },
    })
    if (!template) return res.status(404).json({ message: 'No active template found' })
    res.json(template)
  } catch (err) {
    console.error('getTemplate error:', err)
    res.status(500).json({ message: 'Failed to fetch template' })
  }
}

// ─── GET /api/admin/checklists/sections/:id ───────────
// Returns a single section with its items
const getSectionById = async (req, res) => {
  try {
    const section = await prisma.checklistSection.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        items: { orderBy: { order: 'asc' } },
      },
    })
    if (!section) return res.status(404).json({ message: 'Section not found' })
    res.json(section)
  } catch (err) {
    console.error('getSectionById error:', err)
    res.status(500).json({ message: 'Failed to fetch section' })
  }
}

// ─── POST /api/admin/checklists/sections ──────────────
// Creates a new section (and its items) on the active template
const createSection = async (req, res) => {
  const { name, description, items = [] } = req.body
  if (!name) return res.status(400).json({ message: 'Section name is required' })

  try {
    const template = await prisma.checklistTemplate.findFirst({ where: { isActive: true } })
    if (!template) return res.status(404).json({ message: 'No active template found' })

    // Get current max order
    const maxOrder = await prisma.checklistSection.aggregate({
      where: { templateId: template.id },
      _max: { order: true },
    })
    const nextOrder = (maxOrder._max.order ?? 0) + 1

    const section = await prisma.checklistSection.create({
      data: {
        name,
        description: description ?? null,
        order: nextOrder,
        templateId: template.id,
        items: {
          create: items.map((item, idx) => ({
            statement: item.statement,
            order: item.order ?? idx + 1,
            isRequired: item.isRequired ?? true,
          })),
        },
      },
      include: { items: { orderBy: { order: 'asc' } } },
    })

    res.status(201).json(section)
  } catch (err) {
    console.error('createSection error:', err)
    res.status(500).json({ message: 'Failed to create section' })
  }
}

// ─── PUT /api/admin/checklists/sections/:id/items ─────
// Replaces all items in a section with the submitted list.
// Items with id=null are created; existing ones are updated; missing ones are deleted.
const updateSectionItems = async (req, res) => {
  try {
    const sectionId = parseInt(req.params.id)
    const { items } = req.body

    const section = await prisma.checklistSection.findUnique({
      where: { id: sectionId },
      include: { items: true }
    })
    if (!section) return res.status(404).json({ message: 'Section not found' })

    const existingIds = section.items.map(i => i.id)
    const incomingIds = items.filter(i => i.id).map(i => i.id)

    // Only delete items that have NO audit responses
    const toDelete = existingIds.filter(id => !incomingIds.includes(id))
    
    for (const id of toDelete) {
      const inUse = await prisma.auditResponse.findFirst({
        where: { checklistItemId: id }
      })
      if (!inUse) {
        await prisma.checklistItem.delete({ where: { id } })
      }
      // if in use, silently skip — can't delete it
    }

    // Update existing items
    for (const item of items.filter(i => i.id)) {
      await prisma.checklistItem.update({
        where: { id: item.id },
        data: { statement: item.statement, order: item.order, isRequired: item.isRequired }
      })
    }

    // Create new items
    for (const item of items.filter(i => !i.id)) {
      await prisma.checklistItem.create({
        data: {
          statement: item.statement,
          order: item.order,
          isRequired: item.isRequired ?? true,
          sectionId
        }
      })
    }

    const updated = await prisma.checklistSection.findUnique({
      where: { id: sectionId },
      include: { items: { orderBy: { order: 'asc' } } }
    })

    res.json(updated)
  } catch (err) {
    console.error('updateSectionItems error:', err)
    res.status(500).json({ message: 'Failed to update items', error: err.message })
  }
}

const updateSection = async (req, res) => {
  try {
    const { name, description } = req.body
    const section = await prisma.checklistSection.update({
      where: { id: parseInt(req.params.id) },
      data: { name, description }
    })
    res.json(section)
  } catch (err) {
    res.status(500).json({ error: 'Failed to update section' })
  }
}

const reorderSections = async (req, res) => {
  try {
    const { sections } = req.body
    await Promise.all(
      sections.map(sec =>
        prisma.checklistSection.update({
          where: { id: Number(sec.id) },
          data: { order: sec.order }
        })
      )
    )
    res.json({ message: 'Sections reordered successfully' })
  } catch (err) {
    res.status(500).json({ error: 'Failed to reorder sections' })
  }
}
const deleteSection = async (req, res) => {
  try {
    const sectionId = parseInt(req.params.id)

    const itemsInUse = await prisma.checklistItem.findMany({
      where: { sectionId, auditResponses: { some: {} } }
    })

    console.log('Items in use:', itemsInUse.length) // ← add this

    if (itemsInUse.length > 0) {
      return res.status(400).json({ 
        message: 'Cannot delete section — some items have been used in audits.' 
      })
    }

    // Delete items first, then section
    const deleted = await prisma.checklistItem.deleteMany({ where: { sectionId } })
    console.log('Items deleted:', deleted.count) // ← add this
    
    await prisma.checklistSection.delete({ where: { id: sectionId } })
    console.log('Section deleted:', sectionId) // ← add this

    res.json({ message: 'Section deleted successfully' })
  } catch (err) {
    console.error('deleteSection error:', err) // ← is this firing?
    res.status(500).json({ message: 'Failed to delete section', error: err.message })
  }
}
module.exports = {
  getTemplate,
  getSectionById,
  createSection,
  updateSectionItems,
  reorderSections,
  updateSection,
  deleteSection  
}



