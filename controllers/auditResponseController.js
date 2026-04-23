//this is where the safety officer fills in the checklist answers during an inspection
const prisma = require('../config/db');

// GET all responses for an audit
const getResponsesByAudit = async (req, res) => {
  try {
    const responses = await prisma.auditResponse.findMany({
      where: { auditId: parseInt(req.params.auditId) },
      include: {
        checklistItem: {
          include: { section: true }
        },
        evidence: true
      },
      orderBy: { id: 'asc' }
    });
    res.json(responses);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching responses', error: err.message });
  }
};

// POST save a single response
const saveResponse = async (req, res) => {
  try {
    const { checklistItemId, answer, remarks, isNASection } = req.body;
    const auditId = parseInt(req.params.auditId);

    // Check if response already exists for this item in this audit
    const existing = await prisma.auditResponse.findFirst({
      where: { auditId, checklistItemId: parseInt(checklistItemId) }
    });

    let response;

    if (existing) {
      // Update existing response
      response = await prisma.auditResponse.update({
        where: { id: existing.id },
        data: { answer, remarks, isNASection: isNASection ?? false }
      });
    } else {
      // Create new response
      response = await prisma.auditResponse.create({
        data: {
          auditId,
          checklistItemId: parseInt(checklistItemId),
          answer,
          remarks,
          finding:          r.finding          || '',   
          correctiveAction: r.correctiveAction || '',   
          isNASection: isNASection ?? false
        }
      });
    }

    res.status(201).json(response);
  } catch (err) {
    res.status(500).json({ message: 'Error saving response', error: err.message });
  }
};

// POST save multiple responses at once (bulk save)
const saveResponsesBulk = async (req, res) => {
  try {
    const auditId = parseInt(req.params.auditId);
    const { responses } = req.body;
    // responses = [
    //   { checklistItemId: 1, answer: "yes", remarks: "" },
    //   { checklistItemId: 2, answer: "no", remarks: "needs repair" },
    //   { checklistItemId: 3, answer: "na", isNASection: true },
    // ]

    const saved = await Promise.all(
      responses.map(async (r) => {
        const existing = await prisma.auditResponse.findFirst({
          where: {
            auditId,
            checklistItemId: parseInt(r.checklistItemId)
          }
        });

        if (existing) {
          return prisma.auditResponse.update({
            where: { id: existing.id },
            data: {
              answer:      r.answer,
              remarks:     r.remarks,
              finding:          r.finding          || '',  // ← missing
              correctiveAction: r.correctiveAction || '',  // ← missing
              severity:         r.severity         || 'medium',  // ← missing
              isNASection: r.isNASection ?? false
            }
          });
        } else {
          return prisma.auditResponse.create({
            data: {
              auditId,
              checklistItemId: parseInt(r.checklistItemId),
              answer:          r.answer,
              remarks:         r.remarks,
              finding:          r.finding          || '',   
              correctiveAction: r.correctiveAction || '',   
              severity:         r.severity         || 'medium', 
              isNASection:     r.isNASection ?? false
            }
          });
        }
      })
    );

    // Auto update audit status to ongoing if still draft
    await prisma.audit.updateMany({
      where: { id: auditId, status: 'draft' },
      data:  { status: 'ongoing' }
    });

    res.status(201).json({ message: 'Responses saved', count: saved.length, saved });
  } catch (err) {
    res.status(500).json({ message: 'Error saving responses', error: err.message });
  }
};

// GET audit progress (how many items answered vs total)
const getAuditProgress = async (req, res) => {
  try {
    const auditId = parseInt(req.params.auditId);

    const audit = await prisma.audit.findUnique({
      where: { id: auditId },
      include: {
        template: {
          include: {
            sections: {
              include: { items: true }
            }
          }
        },
        auditResponses: true
      }
    });

    if (!audit) return res.status(404).json({ message: 'Audit not found' });

    const totalItems = audit.template.sections.reduce(
      (sum, section) => sum + section.items.length, 0
    );
    const answeredItems = audit.auditResponses.length;
    const progressPercent = totalItems > 0
      ? Math.round((answeredItems / totalItems) * 100)
      : 0;

    res.json({
      auditId,
      totalItems,
      answeredItems,
      progressPercent,
      isComplete: answeredItems >= totalItems
    });
  } catch (err) {
    res.status(500).json({ message: 'Error fetching progress', error: err.message });
  }
};

module.exports = {
  getResponsesByAudit,
  saveResponse,
  saveResponsesBulk,
  getAuditProgress
};