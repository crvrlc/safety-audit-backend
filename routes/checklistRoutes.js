// Read-only for all roles 

const express = require('express');
const router = express.Router();
const authenticate = require('../middleware/authMiddleware');
const authorize   = require('../middleware/roleMiddleware');
const { PrismaClient } = require('@prisma/client')
const {
  getTemplates,
  getTemplateById,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  addSection,
  // updateSection,
  deleteSection,
  addItem,
  updateItem,
  deleteItem
} = require('../controllers/checklistController');

const prisma = new PrismaClient()


router.get('/template', authenticate, async (req, res) => {
  try {
    const template = await prisma.checklistTemplate.findFirst({
      where: { isActive: true },
      include: {
        sections: {
          orderBy: { order: 'asc' },
          include: {
            items: true
          }
        }
      }
    })

    res.json(template)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to fetch template' })
  }
})



module.exports = router;