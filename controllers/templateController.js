const prisma = require('../config/db');

const getAllTemplates = async (req, res) => {
  try {
    const templates = await prisma.checklistTemplate.findMany({
      where: { isActive: true },
      include: { checklistItems: true }
    });
    res.json(templates);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching templates', error: err.message });
  }
};

const createTemplate = async (req, res) => {
  try {
    const { name, items } = req.body;
    const template = await prisma.checklistTemplate.create({
      data: {
        name,
        createdBy: req.user.id,
        checklistItems: {
          create: items.map(item => ({
            section:    item.section,
            question:   item.question,
            isRequired: item.isRequired ?? true
          }))
        }
      },
      include: { checklistItems: true }
    });
    res.status(201).json(template);
  } catch (err) {
    res.status(500).json({ message: 'Error creating template', error: err.message });
  }
};

const updateTemplate = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, isActive } = req.body;
    const template = await prisma.checklistTemplate.update({
      where: { id: parseInt(id) },
      data: { name, isActive }
    });
    res.json(template);
  } catch (err) {
    res.status(500).json({ message: 'Error updating template', error: err.message });
  }
};

module.exports = { getAllTemplates, createTemplate, updateTemplate };