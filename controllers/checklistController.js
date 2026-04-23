const prisma = require('../config/db');

// ─── TEMPLATES ────────────────────────────────────────

// GET all templates
const getTemplates = async (req, res) => {
  try {
    const templates = await prisma.checklistTemplate.findMany({
      include: {
        createdByUser: { select: { id: true, name: true } },
        sections: {
          orderBy: { order: 'asc' },
          include: {
            items: { orderBy: { order: 'asc' } }
          }
        }
      }
    });
    res.json(templates);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching templates', error: err.message });
  }
};

// GET single template
const getTemplateById = async (req, res) => {
  try {
    const template = await prisma.checklistTemplate.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        createdByUser: { select: { id: true, name: true } },
        sections: {
          orderBy: { order: 'asc' },
          include: {
            items: { orderBy: { order: 'asc' } }
          }
        }
      }
    });
    if (!template) return res.status(404).json({ message: 'Template not found' });
    res.json(template);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching template', error: err.message });
  }
};

// POST create full template with sections and items
const createTemplate = async (req, res) => {
  try {
    const { name, sections } = req.body;
    // sections = [
    //   { name: "Fire Safety", order: 1, items: [
    //     { statement: "Are fire extinguishers accessible?", order: 1 },
    //     { statement: "Are exits clearly marked?", order: 2 }
    //   ]},
    //   ...
    // ]

    const template = await prisma.checklistTemplate.create({
      data: {
        name,
        createdBy: req.user.id,
        sections: {
          create: sections.map(section => ({
            name:  section.name,
            order: section.order,
            items: {
              create: section.items.map(item => ({
                statement:  item.statement,
                order:      item.order,
                isRequired: item.isRequired ?? true
              }))
            }
          }))
        }
      },
      include: {
        sections: {
          orderBy: { order: 'asc' },
          include: {
            items: { orderBy: { order: 'asc' } }
          }
        }
      }
    });
    res.status(201).json(template);
  } catch (err) {
    res.status(500).json({ message: 'Error creating template', error: err.message });
  }
};

// PUT update template name or active status
const updateTemplate = async (req, res) => {
  try {
    const { name, isActive } = req.body;
    const template = await prisma.checklistTemplate.update({
      where: { id: parseInt(req.params.id) },
      data: { name, isActive }
    });
    res.json(template);
  } catch (err) {
    res.status(500).json({ message: 'Error updating template', error: err.message });
  }
};

// DELETE template (only if not used in any audit)
const deleteTemplate = async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const inUse = await prisma.audit.findFirst({ where: { templateId: id } });
    if (inUse) {
      return res.status(400).json({ message: 'Template is in use by existing audits and cannot be deleted' });
    }
    await prisma.checklistTemplate.delete({ where: { id } });
    res.json({ message: 'Template deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Error deleting template', error: err.message });
  }
};

// ─── SECTIONS ─────────────────────────────────────────

// POST add section to existing template
const addSection = async (req, res) => {
  try {
    const { name, order } = req.body;
    const section = await prisma.checklistSection.create({
      data: {
        name,
        order,
        templateId: parseInt(req.params.templateId)
      }
    });
    res.status(201).json(section);
  } catch (err) {
    res.status(500).json({ message: 'Error adding section', error: err.message });
  }
};

// PUT update section
const updateSection = async (req, res) => {
  try {
    const { name, order, description } = req.body;
    const section = await prisma.checklistSection.update({
      where: { id: parseInt(req.params.sectionId) },
      data: { name, order, description }
    });
    res.json(section);
  } catch (err) {
    res.status(500).json({ message: 'Error updating section', error: err.message });
  }
};

// DELETE section
const deleteSection = async (req, res) => {
  try {
    await prisma.checklistSection.delete({
      where: { id: parseInt(req.params.sectionId) }
    });
    res.json({ message: 'Section deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Error deleting section', error: err.message });
  }
};

// ─── ITEMS ────────────────────────────────────────────

// POST add item to section
const addItem = async (req, res) => {
  try {
    const { statement, order, isRequired } = req.body;
    const item = await prisma.checklistItem.create({
      data: {
        statement,
        order,
        isRequired: isRequired ?? true,
        sectionId: parseInt(req.params.sectionId)
      }
    });
    res.status(201).json(item);
  } catch (err) {
    res.status(500).json({ message: 'Error adding item', error: err.message });
  }
};

// PUT update item
const updateItem = async (req, res) => {
  try {
    const { statement, order, isRequired } = req.body;
    const item = await prisma.checklistItem.update({
      where: { id: parseInt(req.params.itemId) },
      data: { statement, order, isRequired }
    });
    res.json(item);
  } catch (err) {
    res.status(500).json({ message: 'Error updating item', error: err.message });
  }
};

// DELETE item
const deleteItem = async (req, res) => {
  try {
    await prisma.checklistItem.delete({
      where: { id: parseInt(req.params.itemId) }
    });
    res.json({ message: 'Item deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Error deleting item', error: err.message });
  }
};

module.exports = {
  getTemplates,
  getTemplateById,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  addSection,
  updateSection,
  deleteSection,
  addItem,
  updateItem,
  deleteItem
};