const prisma = require('../config/db');

// GET all findings (no answers with finding/CA text) across all audits
const getAllFindings = async (req, res) => {
  try {
    const findings = await prisma.auditResponse.findMany({
      where: {
        answer: 'no',
        OR: [
          { finding:          { not: '' } },
          { correctiveAction: { not: '' } }
        ]
      },
      include: {
        audit: {
          include: {
            office: { include: { facility: true } },
            inspector: { select: { id: true, name: true } }
          }
        },
        checklistItem: {
          include: { section: true }
        },
        evidence: true
      },
      orderBy: { id: 'desc' }
    });
    res.json(findings);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching findings', error: err.message });
  }
};

// GET findings for a specific audit
const getFindingsByAudit = async (req, res) => {
  try {
    const findings = await prisma.auditResponse.findMany({
      where: {
        auditId: parseInt(req.params.auditId),
        answer:  'no',
        OR: [
          { finding:          { not: '' } },
          { correctiveAction: { not: '' } }
        ]
      },
      include: {
        checklistItem: { include: { section: true } },
        evidence: true
      },
      orderBy: { id: 'asc' }
    });
    res.json(findings);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching findings', error: err.message });
  }
};

// GET single finding by auditResponse id
const getFindingById = async (req, res) => {
  try {
    const finding = await prisma.auditResponse.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        checklistItem: { include: { section: true } },
        evidence: true,
        audit: {
          include: {
            office: { include: { facility: true } },
            inspector: { select: { id: true, name: true } }
          }
        }
      }
    });
    if (!finding) return res.status(404).json({ message: 'Finding not found' });
    res.json(finding);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching finding', error: err.message });
  }
};

// GET findings assigned to the current facility manager's audits
const getMyFindings = async (req, res) => {
  try {
    const findings = await prisma.auditResponse.findMany({
      where: {
        answer: 'no',
        OR: [
          { finding:          { not: '' } },
          { correctiveAction: { not: '' } }
        ],
        audit: {
          office: {
            facility: {
              facilityManagerEmail: req.user.email
            }
          }
        }
      },
      include: {
        audit: {
          include: {
            office: { include: { facility: true } },
            inspector: { select: { id: true, name: true } }
          }
        },
        checklistItem: { include: { section: true } },
        evidence: true
      },
      orderBy: { id: 'desc' }
    });
    res.json(findings);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching findings', error: err.message });
  }
};

// PATCH assign corrective action to a person (free text)
const assignFinding = async (req, res) => {
  try {
    const { assignedTo } = req.body;

    const updated = await prisma.auditResponse.update({
      where: { id: parseInt(req.params.id) },
      data: {
        assignedTo,
        dueDate: dueDate ? new Date(dueDate) : null,
        resolutionStatus: 'assigned'
      }
    });

    // Auto-set audit status to 'resolving' when first CA is assigned
    await prisma.audit.updateMany({
      where: {
        id:     updated.auditId,
        status: 'acknowledged'
      },
      data: { status: 'resolving' }
    });

    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: 'Error assigning finding', error: err.message });
  }
};

// PATCH mark a single finding as resolved
const resolveFinding = async (req, res) => {
  try {
    const { resolutionNote, resolutionEvidence } = req.body;

    const updated = await prisma.auditResponse.update({
      where: { id: parseInt(req.params.id) },
      data: {
        resolutionStatus:   'resolved',
        resolutionNote:     resolutionNote     || null,
        resolutionEvidence: resolutionEvidence || null,
        resolvedAt:         new Date()
      }
    });

    // Check if ALL no-answer responses for this audit are now resolved
    const allNoResponses = await prisma.auditResponse.findMany({
      where: {
        auditId: updated.auditId,
        answer:  'no',
        OR: [
          { finding:          { not: '' } },
          { correctiveAction: { not: '' } }
        ]
      }
    });

    const allResolved = allNoResponses.every(r => r.resolutionStatus === 'resolved');

    if (allResolved) {
      await prisma.audit.update({
        where: { id: updated.auditId },
        data:  { status: 'pending_review' }
      });
    }

    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: 'Error resolving finding', error: err.message });
  }
};

// PATCH mark ALL findings for an audit as resolved at once
const resolveAllFindings = async (req, res) => {
  try {
    const auditId = parseInt(req.params.auditId);
    const { resolutionNote } = req.body;

    await prisma.auditResponse.updateMany({
      where: {
        auditId,
        answer: 'no',
        resolutionStatus: { not: 'resolved' }
      },
      data: {
        resolutionStatus: 'resolved',
        resolutionNote:   resolutionNote || null,
        resolvedAt:       new Date()
      }
    });

    await prisma.audit.update({
      where: { id: auditId },
      data:  { status: 'pending_review' }
    });

    res.json({ message: 'All findings resolved' });
  } catch (err) {
    res.status(500).json({ message: 'Error resolving all findings', error: err.message });
  }
};

module.exports = {
  getAllFindings,
  getFindingsByAudit,
  getFindingById,
  getMyFindings,
  assignFinding,
  resolveFinding,
  resolveAllFindings
};