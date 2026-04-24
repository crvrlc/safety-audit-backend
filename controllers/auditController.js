const prisma = require('../config/db');
const {
  notifyInspectionSubmitted,
  notifyInspectionStatusChange,
  notifyComplianceAlert
} = require('../services/emailService')

const getSemester = () => {
  const month = new Date().getMonth() + 1
  return month <= 6 ? 1 : 2
}

const generateInspectionCode = async () => {
  const now = new Date()
  const year = now.getFullYear()
  const semester = getSemester()

  const gte = semester === 1
    ? new Date(`${year}-01-01`)
    : new Date(`${year}-07-01`)

  const lt = semester === 1
    ? new Date(`${year}-07-01`)
    : new Date(`${year + 1}-01-01`)

  // Find the latest inspection code instead of counting
  const latest = await prisma.audit.findFirst({
    where: {
      createdAt: { gte, lt },
      inspectionCode: { startsWith: `INS-${year}-${semester}-` }
    },
    orderBy: { inspectionCode: 'desc' }
  })

  let next = 1
  if (latest) {
    const parts = latest.inspectionCode.split('-')
    const lastNum = parseInt(parts[parts.length - 1], 10)
    next = lastNum + 1
  }

  const padded = String(next).padStart(3, '0')
  return `INS-${year}-${semester}-${padded}`
}
// GET all audits
const getAudits = async (req, res) => {
  try {
    const audits = await prisma.audit.findMany({
      include: {
        office: {
          include: { facility: true }
        },
        inspector: { select: { id: true, name: true, email: true } },
        template: {
          include: {                          // ← changed from select to include
            sections: {
              orderBy: { order: 'asc' },
              include: {
                items: { orderBy: { order: 'asc' } }
              }
            }
          }
        },
        auditResponses: true,                // ← ADD THIS
        auditReport: true
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(audits);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching audits', error: err.message });
  }
};

// GET audits by inspector (for safety officer dashboard)
const getMyAudits = async (req, res) => {
  try {
    const audits = await prisma.audit.findMany({
      where: { inspectorId: req.user.id },
      include: {
         inspector: {
            select: { id: true, name: true, email: true }
          }, 
        office: {
          include: { facility: true }
        },
        template: {
          include: {                          // ← changed from select to include
            sections: {
              orderBy: { order: 'asc' },
              include: {
                items: { orderBy: { order: 'asc' } }
              }
            }
          }
        },
        auditResponses: true,                // ← ADD THIS
        auditReport: true
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(audits);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching audits', error: err.message });
  }
};

// GET single audit with full details
const getAuditById = async (req, res) => {
  try {
    const audit = await prisma.audit.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        office: {
          include: {
            facility: true,
            // unit: true
          }
        },
        inspector: { select: { id: true, name: true, email: true } },
        template: {
          include: {
            sections: {
              orderBy: { order: 'asc' },
              include: {
                items: { orderBy: { order: 'asc' } }
              }
            }
          }
        },
        auditResponses: {
          include: {
            checklistItem: true,
            evidence: true
          }
        },
        auditReport: true
      }
    });
    if (!audit) return res.status(404).json({ message: 'Audit not found' });
    res.json(audit);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching audit', error: err.message });
  }
};

// POST create/schedule audit
const createAudit = async (req, res) => {
  try {
    console.log('CREATE AUDIT BODY:', req.body)
    const {
      officeId,
      templateId,
      inspectionType, // routine / follow up
      notes,
      scheduledAt,
      status
    } = req.body;

    if (!templateId || isNaN(parseInt(templateId))) {
      return res.status(400).json({ message: 'A valid templateId is required' });
    }
    if (!officeId || isNaN(parseInt(officeId))) {
      return res.status(400).json({ message: 'A valid officeId is required' });
    }

    const inspectionCode = await generateInspectionCode();

    const audit = await prisma.audit.create({
      data: {
        inspectionCode,
        inspectionType,
        notes,
        status:      status || (scheduledAt ? 'scheduled' : 'draft'),
        scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
        officeId:    parseInt(officeId),
        inspectorId: req.user.id,
        templateId:  parseInt(templateId)
      },
      include: {
        office: {
          include: { facility: true }
        },
        template: { select: { id: true, name: true } }
      }
    });
    res.status(201).json(audit);
  } catch (err) {
    console.error('CREATE AUDIT ERROR:', err)  
    res.status(500).json({ message: 'Error creating audit', error: err.message });
  }
};

// PATCH start audit (scheduled → ongoing)
const startAudit = async (req, res) => {
  try {
    const audit = await prisma.audit.update({
      where: { id: parseInt(req.params.id) },
      data:  { status: 'ongoing' }
    });
    res.json(audit);
  } catch (err) {
    res.status(500).json({ message: 'Error starting audit', error: err.message });
  }
};

// PATCH submit audit (ongoing → submitted)
const submitAudit = async (req, res) => {
  try {
    const auditId = parseInt(req.params.id)
 
    const audit = await prisma.audit.findUnique({
      where: { id: auditId },
      include: {
        office: { include: { facility: true } },
        inspector: { select: { id: true, name: true, email: true } }
      }
    })
    if (!audit) return res.status(404).json({ message: 'Audit not found' })
 
    const responses = await prisma.auditResponse.findMany({ where: { auditId } })
    const yes = responses.filter(r => r.answer === 'yes').length
    const no  = responses.filter(r => r.answer === 'no').length
    const applicable = yes + no
    const complianceRate = applicable > 0 ? Math.round((yes / applicable) * 100) : 0
    const findingsCount  = responses.filter(
      r => r.answer === 'no' && (r.finding?.trim() || r.correctiveAction?.trim())
    ).length
 
    const [updated] = await Promise.all([
      prisma.audit.update({
        where: { id: auditId },
        data: { status: 'submitted', submittedAt: new Date() }
      }),
      prisma.auditReport.upsert({
        where:  { auditId },
        create: { auditId, complianceRate, findingsCount },
        update: { complianceRate, findingsCount }
      })
    ])
 
    // ── Email: notify officer their submission went through ──
    const prefs = await prisma.notificationPreference.findUnique({
      where: { userId: audit.inspectorId }
    })
    if (prefs?.inspectionUpdates) {
      notifyInspectionSubmitted(audit.inspector, { ...updated, office: audit.office })
        .catch(err => console.error('[Email] submitAudit:', err.message))
    }
 
    // ── Email: compliance alert if rate < 70% ──
    if (prefs?.complianceAlerts && complianceRate < 70) {
      notifyComplianceAlert(audit.inspector, { ...updated, office: audit.office }, complianceRate)
        .catch(err => console.error('[Email] complianceAlert:', err.message))
    }
 
    res.json(updated)
  } catch (err) {
    res.status(500).json({ message: 'Error submitting audit', error: err.message })
  }
}
// PATCH update audit details (for draft/scheduled)
const updateAudit = async (req, res) => {
  try {
    const {  notes, scheduledAt, inspectionType, status } = req.body;
    const audit = await prisma.audit.update({
      where: { id: parseInt(req.params.id) },
      data: {
        notes,
        inspectionType,
        scheduledAt: scheduledAt ? new Date(scheduledAt) : undefined,
        status
      }
    });
    res.json(audit);
  } catch (err) {
    res.status(500).json({ message: 'Error updating audit', error: err.message });
  }
};

// DELETE audit (only draft or scheduled)
const deleteAudit = async (req, res) => {
  try {
    const id = parseInt(req.params.id)

    const audit = await prisma.audit.findUnique({ where: { id } })
    if (!audit) return res.status(404).json({ message: 'Audit not found' })

    await prisma.$transaction(async (tx) => {
      const responses = await tx.auditResponse.findMany({ where: { auditId: id } })
      const responseIds = responses.map(r => r.id)

      if (responseIds.length > 0) {
        await tx.evidence.deleteMany({ where: { auditResponseId: { in: responseIds } } })
        await tx.maintenanceTask.deleteMany({ where: { auditResponseId: { in: responseIds } } })
      }

      await tx.auditResponse.deleteMany({ where: { auditId: id } })
      await tx.auditReport.deleteMany({ where: { auditId: id } })
      await tx.audit.delete({ where: { id } })
    })

    res.json({ message: 'Audit deleted successfully' })

  } catch (err) {
    console.error('DELETE AUDIT ERROR:', err)
    res.status(500).json({ message: 'Error deleting audit', error: err.message })
  }
}

const signOffAudit = async (req, res) => {
  try {
    const auditId = parseInt(req.params.id)
    const { comment } = req.body
 
    const audit = await prisma.audit.findUnique({
      where: { id: auditId },
      include: {
        inspector: { select: { id: true, name: true, email: true } },
        office: { include: { facility: true } }
      }
    })
 
    if (!audit) return res.status(404).json({ message: 'Audit not found' })
    if (audit.status !== 'pending_review')
      return res.status(400).json({ message: 'Audit is not awaiting sign-off' })
 
    const updated = await prisma.audit.update({
      where: { id: auditId },
      data: {
        status:      'completed',
        completedAt: new Date(),
        ...(comment ? { notes: comment } : {})
      }
    })
 
    // ── Email: notify officer inspection is fully completed ──
    const prefs = await prisma.notificationPreference.findUnique({
      where: { userId: audit.inspectorId }
    })
    if (prefs?.statusChanges) {
      notifyInspectionStatusChange(audit.inspector, { ...updated, office: audit.office }, 'completed')
        .catch(err => console.error('[Email] signOffAudit:', err.message))
    }
 
    res.json(updated)
  } catch (err) {
    res.status(500).json({ message: 'Error signing off audit', error: err.message })
  }
}

module.exports = {
  getAudits,
  getMyAudits,
  getAuditById,
  createAudit,
  startAudit,
  submitAudit,
  updateAudit,
  deleteAudit,
  signOffAudit
};