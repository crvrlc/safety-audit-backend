const prisma = require('../config/db');
const {
  notifyInspectionStatusChange
} = require('../services/emailService')
const { notifyCorrectiveActionAssigned } = require('../services/emailService')

// ─────────────────────────────────────────────────────────────────
// SCOPE HELPERS
// ─────────────────────────────────────────────────────────────────

// Scope for auditResponse queries
const responseScope = (req) => ({
  answer: 'no',
  OR: [
    { finding:          { not: '' } },
    { correctiveAction: { not: '' } }
  ],
  audit: { office: { facilityId: { in: req.managedFacilityIds } } }
})

const auditScope = (req) => ({
  office: { facilityId: { in: req.managedFacilityIds } }
})

// MaintenanceTask scope now goes through auditResponse
const maintenanceScope = (req) => ({
  auditResponse: { audit: { office: { facilityId: { in: req.managedFacilityIds } } } }
})


// ─────────────────────────────────────────────────────────────────
// GET /api/manager/stats
// ─────────────────────────────────────────────────────────────────

const getStats = async (req, res) => {
  try {
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const scope = responseScope(req)

    const [
      openFindings,
      highSeverityIssues,
      resolvedThisMonth,
      totalIssues,
      pendingReports,
    ] = await Promise.all([
      prisma.auditResponse.count({
        where: { ...scope, resolutionStatus: { in: ['pending', 'assigned'] } }
      }),
      prisma.auditResponse.count({
        where: { ...scope, severity: 'high', resolutionStatus: { not: 'resolved' } }
      }),
      prisma.auditResponse.count({
        where: { ...scope, resolutionStatus: 'resolved', resolvedAt: { gte: startOfMonth } }
      }),
      prisma.auditResponse.count({ where: scope }),
      prisma.audit.count({
        where: { ...auditScope(req), status: 'submitted' }
      }),
    ])

    // Avg resolution days
    const resolvedResponses = await prisma.auditResponse.findMany({
      where: { ...scope, resolutionStatus: 'resolved', resolvedAt: { not: null } },
      include: { audit: { select: { createdAt: true } } }
    })

    let avgResolutionDays = 0
    if (resolvedResponses.length > 0) {
      const totalDays = resolvedResponses.reduce((sum, r) => {
        const diff = (new Date(r.resolvedAt) - new Date(r.audit.createdAt)) / (1000 * 60 * 60 * 24)
        return sum + Math.max(0, diff)
      }, 0)
      avgResolutionDays = parseFloat((totalDays / resolvedResponses.length).toFixed(1))
    }

    res.json({
      openFindings,
      pendingReports,
      highSeverityIssues,
      resolvedThisMonth,
      totalIssues,
      avgResolutionDays,
    })
  } catch (err) {
    console.error('getStats error:', err)
    res.status(500).json({ error: 'Failed to load stats.' })
  }
}


// ─────────────────────────────────────────────────────────────────
// GET /api/manager/trend
// ─────────────────────────────────────────────────────────────────

const getTrend = async (req, res) => {
  try {
    const now = new Date()
    const scope = responseScope(req)

    const months = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1)
      return {
        label: d.toLocaleString('default', { month: 'short' }),
        start: new Date(d.getFullYear(), d.getMonth(), 1),
        end:   new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59),
      }
    })

    const trend = await Promise.all(
      months.map(async ({ label, start, end }) => {
        const [resolved, opened] = await Promise.all([
          prisma.auditResponse.count({
            where: { ...scope, resolutionStatus: 'resolved', resolvedAt: { gte: start, lte: end } }
          }),
          prisma.auditResponse.count({
            where: { ...scope, audit: { ...scope.audit, createdAt: { gte: start, lte: end } } }
          }),
        ])
        return { month: label, resolved, opened }
      })
    )

    res.json(trend)
  } catch (err) {
    console.error('getTrend error:', err)
    res.status(500).json({ error: 'Failed to load trend data.' })
  }
}


// ─────────────────────────────────────────────────────────────────
// GET /api/manager/activity
// ─────────────────────────────────────────────────────────────────

const getActivity = async (req, res) => {
  try {
    // Recent audits in manager's scope as activity feed
    const recentAudits = await prisma.audit.findMany({
      where: {
        ...auditScope(req),
        status: { in: ['submitted', 'acknowledged', 'resolving', 'pending_review', 'completed'] }
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: {
        inspector: { select: { id: true, name: true, avatarUrl: true } },
        office:    { include: { facility: true } },
        auditResponses: {
          where: { answer: 'no' }
        }
      }
    })

    res.json(recentAudits)
  } catch (err) {
    console.error('getActivity error:', err)
    res.status(500).json({ error: 'Failed to load activity.' })
  }
}


// ─────────────────────────────────────────────────────────────────
// GET /api/manager/findings
// ─────────────────────────────────────────────────────────────────

const getFindings = async (req, res) => {
  try {
    const { status } = req.query
    const scope = responseScope(req)

    const findings = await prisma.auditResponse.findMany({
      where: {
        ...scope,
        ...(status ? { resolutionStatus: status } : {})
      },
      orderBy: { id: 'desc' },
      include: {
        checklistItem: { include: { section: true } },
        evidence: true,
        audit: {
          include: {
            inspector: { select: { id: true, name: true, avatarUrl: true } },
            office:    { include: { facility: true } }
          }
        }
      }
    })

    res.json(findings)
  } catch (err) {
    console.error('getFindings error:', err)
    res.status(500).json({ error: 'Failed to load findings.' })
  }
}


// ─────────────────────────────────────────────────────────────────
// PATCH /api/manager/findings/:id
// ─────────────────────────────────────────────────────────────────

const updateFinding = async (req, res) => {
  try {
    const id = parseInt(req.params.id)
    const { assignedTo, resolutionStatus, resolutionNote, resolutionEvidence, resolvedAt, dueDate } = req.body
 
    const existing = await prisma.auditResponse.findFirst({
      where: { id, audit: { office: { facilityId: { in: req.managedFacilityIds } } } }
    })
    if (!existing) return res.status(404).json({ error: 'Finding not found.' })
 
    const updated = await prisma.auditResponse.update({
      where: { id },
      data: {
        ...(assignedTo         !== undefined && { assignedTo }),
        ...(dueDate            !== undefined && { dueDate: dueDate ? new Date(dueDate) : null }),
        ...(resolutionStatus                 && { resolutionStatus }),
        ...(resolutionNote     !== undefined && { resolutionNote }),
        ...(resolutionEvidence !== undefined && { resolutionEvidence }),
        ...(resolvedAt         !== undefined && { resolvedAt: resolvedAt ? new Date(resolvedAt) : null }),
      },
      include: {
        checklistItem: { include: { section: true } },
        audit: {
          include: {
            office: { include: { facility: true } },
            inspector: { select: { id: true, name: true, email: true } }  // ← needed for email
          }
        }
      }
    })

    // ── Email: notify assignee if assignedTo is an email ──
    if (assignedTo && assignedTo.includes('@')) {
      notifyCorrectiveActionAssigned(
        assignedTo,
        updated.audit,
        updated,
        dueDate
      ).catch(err => console.error('[Email] notifyCorrectiveActionAssigned:', err.message))
    }
 
    // ── Auto-set audit to 'resolving' when first CA is assigned ──
    if (assignedTo && existing.resolutionStatus === 'pending') {
      const auditUpdated = await prisma.audit.updateMany({
        where: { id: updated.auditId, status: 'acknowledged' },
        data:  { status: 'resolving' }
      })
 
      // ── Email: notify officer audit is now resolving ──
      if (auditUpdated.count > 0) {
        const inspector = updated.audit.inspector
        const prefs = await prisma.notificationPreference.findUnique({
          where: { userId: inspector.id }
        })
        if (prefs?.statusChanges) {
          notifyInspectionStatusChange(
            inspector,
            updated.audit,
            'resolving'
          ).catch(err => console.error('[Email] updateFinding resolving:', err.message))
        }
      }
    }
 
    // ── Auto-set audit to 'pending_review' if all findings resolved ──
    if (resolutionStatus === 'resolved') {
      const allNoResponses = await prisma.auditResponse.findMany({
        where: {
          auditId: updated.auditId,
          answer: 'no',
          OR: [{ finding: { not: '' } }, { correctiveAction: { not: '' } }]
        }
      })
 
      const allResolved = allNoResponses.every(r =>
        r.id === id ? true : r.resolutionStatus === 'resolved'
      )
 
      if (allResolved) {
        await prisma.audit.update({
          where: { id: updated.auditId },
          data:  { status: 'pending_review' }
        })
 
        // ── Email: notify officer their inspection is awaiting review ──
        const inspector = updated.audit.inspector
        const prefs = await prisma.notificationPreference.findUnique({
          where: { userId: inspector.id }
        })
        if (prefs?.statusChanges) {
          notifyInspectionStatusChange(
            inspector,
            updated.audit,
            'pending_review'
          ).catch(err => console.error('[Email] updateFinding pending_review:', err.message))
        }
      }
    }
 
    res.json(updated)
  } catch (err) {
    console.error('updateFinding error:', err)
    res.status(500).json({ error: 'Failed to update finding.' })
  }
}
 

// ─────────────────────────────────────────────────────────────────
// GET /api/manager/audits
// ─────────────────────────────────────────────────────────────────

const getAudits = async (req, res) => {
  try {
    const { status } = req.query
    const audits = await prisma.audit.findMany({
      where: {
        ...auditScope(req),
        ...(status ? { status } : {})
      },
      orderBy: { createdAt: 'desc' },
      include: {
        inspector:   { select: { id: true, name: true, avatarUrl: true } },
        office:      { include: { facility: true } },
        auditReport: true,
        auditResponses: {
          include: {
            checklistItem: { include: { section: true } },
            evidence: true
          }
        },
        template: {
          include: {
            sections: {
              include: {
                items: true
              },
              orderBy: { order: 'asc' }
            }
          }
        }
      }
    })
    res.json(audits)
  } catch (err) {
    console.error('getAudits error:', err)
    res.status(500).json({ error: 'Failed to load audits.' })
  }
}


// ─────────────────────────────────────────────────────────────────
// PATCH /api/manager/audits/:id/acknowledge
// ─────────────────────────────────────────────────────────────────

const acknowledgeAudit = async (req, res) => {
  try {
    const auditId = parseInt(req.params.id)
 
    const audit = await prisma.audit.findFirst({
      where: { id: auditId, ...auditScope(req) },
      include: { office: { include: { facility: true } } }
    })
    if (!audit) return res.status(404).json({ error: 'Audit not found.' })
    if (audit.status !== 'submitted') {
      return res.status(400).json({ error: 'Audit is not awaiting acknowledgment.' })
    }
 
    // Check if there are any findings (no-answer responses with finding/CA content)
    const findingsCount = await prisma.auditResponse.count({
      where: {
        auditId,
        answer: 'no',
        OR: [
          { finding:          { not: '' } },
          { correctiveAction: { not: '' } }
        ]
      }
    })
 
    // If 0 findings, skip straight to completed — no corrective actions needed
    const newStatus     = findingsCount === 0 ? 'completed' : 'acknowledged'
    const now           = new Date()
 
    const [updated] = await Promise.all([
      prisma.audit.update({
        where: { id: auditId },
        data: {
          status:         newStatus,
          acknowledgedAt: now,
          ...(newStatus === 'completed' && { completedAt: now })
        }
      }),
      prisma.auditReport.upsert({
        where:  { auditId },
        create: { auditId, acknowledgedAt: now },
        update: { acknowledgedAt: now }
      })
    ])

    // ── Email: notify officer of status change ──
    const inspector = await prisma.user.findUnique({
      where: { id: audit.inspectorId },
      select: { id: true, name: true, email: true }
    })
    const prefs = await prisma.notificationPreference.findUnique({
      where: { userId: audit.inspectorId }
    })
    if (prefs?.statusChanges) {
      notifyInspectionStatusChange(inspector, { ...updated, office: audit.office }, newStatus)
        .catch(err => console.error('[Email] acknowledgeAudit:', err.message))
    }
 
    res.json(updated)
  } catch (err) {
    console.error('acknowledgeAudit error:', err)
    res.status(500).json({ error: 'Failed to acknowledge audit.' })
  }
}
 
 
// ─────────────────────────────────────────────────────────────────
// PATCH /api/manager/audits/:id/complete
// ─────────────────────────────────────────────────────────────────
 
const completeAudit = async (req, res) => {
  try {
    const auditId = parseInt(req.params.id)
 
    const audit = await prisma.audit.findFirst({
      where: { id: auditId, ...auditScope(req) },
      include: { office: { include: { facility: true } } } 
    })
    if (!audit) return res.status(404).json({ error: 'Audit not found.' })
    if (audit.status !== 'pending_review') {
      return res.status(400).json({ error: 'Audit is not ready for completion.' })
    }
 
    const updated = await prisma.audit.update({
      where: { id: auditId },
      data:  { status: 'completed', completedAt: new Date() }
    })

    const inspector = await prisma.user.findUnique({
      where: { id: audit.inspectorId },
      select: { id: true, name: true, email: true }
    })
    const prefs = await prisma.notificationPreference.findUnique({
      where: { userId: audit.inspectorId }
    })
    if (prefs?.statusChanges) {
      notifyInspectionStatusChange(inspector, { ...updated, office: audit.office }, 'completed')
        .catch(err => console.error('[Email] completeAudit:', err.message))
    }
 
    res.json(updated)
  } catch (err) {
    console.error('completeAudit error:', err)
    res.status(500).json({ error: 'Failed to complete audit.' })
  }
}


// ─────────────────────────────────────────────────────────────────
// GET /api/manager/maintenance  (kept but simplified)
// ─────────────────────────────────────────────────────────────────

const getMaintenance = async (req, res) => {
  try {
    const tasks = await prisma.maintenanceTask.findMany({
      where: maintenanceScope(req),
      orderBy: { id: 'desc' },
      include: {
        assignedUser:  { select: { id: true, name: true, avatarUrl: true } },
        auditResponse: {
          include: {
            audit: { include: { office: { include: { facility: true } } } },
            checklistItem: { include: { section: true } }
          }
        }
      }
    })
    res.json(tasks)
  } catch (err) {
    console.error('getMaintenance error:', err)
    res.status(500).json({ error: 'Failed to load maintenance tasks.' })
  }
}


// ─────────────────────────────────────────────────────────────────
// POST /api/manager/maintenance
// ─────────────────────────────────────────────────────────────────

const createMaintenance = async (req, res) => {
  try {
    const { auditResponseId, assignedTo, dueDate, description } = req.body
    if (!auditResponseId) return res.status(400).json({ error: 'auditResponseId is required.' })

    const response = await prisma.auditResponse.findFirst({
      where: {
        id: auditResponseId,
        audit: { office: { facilityId: { in: req.managedFacilityIds } } }
      }
    })
    if (!response) return res.status(404).json({ error: 'Audit response not found.' })

    const task = await prisma.maintenanceTask.create({
      data: {
        auditResponseId,
        assignedTo:  assignedTo  || null,
        dueDate:     dueDate     ? new Date(dueDate) : null,
        description: description || null,
      },
      include: {
        assignedUser:  { select: { id: true, name: true } },
        auditResponse: {
          include: { audit: { include: { office: { include: { facility: true } } } } }
        }
      }
    })

    res.status(201).json(task)
  } catch (err) {
    console.error('createMaintenance error:', err)
    res.status(500).json({ error: 'Failed to create maintenance task.' })
  }
}


// ─────────────────────────────────────────────────────────────────
// PATCH /api/manager/maintenance/:id
// ─────────────────────────────────────────────────────────────────

const updateMaintenance = async (req, res) => {
  try {
    const id = parseInt(req.params.id)
    const { status, dueDate, completedAt } = req.body

    const task = await prisma.maintenanceTask.findFirst({
      where: { id, ...maintenanceScope(req) }
    })
    if (!task) return res.status(404).json({ error: 'Maintenance task not found.' })

    const updated = await prisma.maintenanceTask.update({
      where: { id },
      data: {
        ...(status      && { status }),
        ...(dueDate     !== undefined && { dueDate:     dueDate     ? new Date(dueDate)     : null }),
        ...(completedAt !== undefined && { completedAt: completedAt ? new Date(completedAt) : null }),
      }
    })

    res.json(updated)
  } catch (err) {
    console.error('updateMaintenance error:', err)
    res.status(500).json({ error: 'Failed to update maintenance task.' })
  }
}


// ─────────────────────────────────────────────────────────────────
// GET /api/manager/compliance
// ─────────────────────────────────────────────────────────────────

const getCompliance = async (req, res) => {
  try {
    const now = new Date()
    const scope = responseScope(req)

    // Per-office compliance based on auditResponses
    const offices = await prisma.office.findMany({
      where: { facilityId: { in: req.managedFacilityIds } },
      include: {
        facility: true,
        audits: {
          include: {
            auditResponses: { where: { answer: 'no' } }
          }
        }
      }
    })

    const officeCompliance = offices.map(office => {
      const totalAudits   = office.audits.length
      const allResponses  = office.audits.flatMap(a => a.auditResponses)
      const resolved      = allResponses.filter(r => r.resolutionStatus === 'resolved').length
      const open          = allResponses.filter(r => r.resolutionStatus !== 'resolved').length
      const complianceRate = allResponses.length > 0
        ? parseFloat(((resolved / allResponses.length) * 100).toFixed(1))
        : 100

      return {
        officeName:     office.name,
        facilityName:   office.facility.name,
        complianceRate,
        openFindings:   open,
        totalAudits
      }
    })

    // Trend data
    const months = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1)
      return {
        label: d.toLocaleString('default', { month: 'short' }),
        start: new Date(d.getFullYear(), d.getMonth(), 1),
        end:   new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59),
      }
    })

    const trendData = await Promise.all(
      months.map(async ({ label, start, end }) => {
        const [opened, resolved] = await Promise.all([
          prisma.auditResponse.count({
            where: { ...scope, audit: { ...scope.audit, createdAt: { gte: start, lte: end } } }
          }),
          prisma.auditResponse.count({
            where: { ...scope, resolutionStatus: 'resolved', resolvedAt: { gte: start, lte: end } }
          }),
        ])
        return { month: label, opened, resolved }
      })
    )

    // Aggregate metrics
   const allResponses = await prisma.auditResponse.findMany({
      where: scope,
      include: {
        audit: { select: { createdAt: true } },
        checklistItem: { include: { section: true } }  // ← ADD THIS
      }
    })

    const resolvedAll = allResponses.filter(r => r.resolutionStatus === 'resolved')

    let avgResolutionDays = 0
    if (resolvedAll.length > 0) {
      const total = resolvedAll.reduce((sum, r) => {
        return sum + Math.max(0,
          (new Date(r.resolvedAt) - new Date(r.audit.createdAt)) / (1000 * 60 * 60 * 24)
        )
      }, 0)
      avgResolutionDays = parseFloat((total / resolvedAll.length).toFixed(1))
    }

    const closureRate = allResponses.length > 0
      ? parseFloat(((resolvedAll.length / allResponses.length) * 100).toFixed(1))
      : 0

    const performanceData = [
      { label: 'Resolved', value: resolvedAll.length },
      { label: 'Open',     value: allResponses.filter(r => r.resolutionStatus === 'pending').length },
      { label: 'Assigned', value: allResponses.filter(r => r.resolutionStatus === 'assigned').length },
    ]

    // Recurring issues by finding text
   const issueMap = {}
    for (const r of allResponses) {
      // Use checklistItem.statement as the canonical issue key,
      // fall back to finding text if somehow item is missing
      const key     = r.checklistItem?.statement ?? r.finding ?? null
      const section = r.checklistItem?.section?.name ?? '—'
      if (!key || key.trim() === '') continue
      if (!issueMap[key]) issueMap[key] = { count: 0, section }
      issueMap[key].count++
    }

    const recurringIssues = Object.entries(issueMap)
      .map(([issue, { count, section }]) => ({ issue, count, section }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)

    
    // ── Facility compliance ranking (ALL facilities) ──
    const allFacilities = await prisma.facility.findMany({
      include: {
        offices: {
          include: {
            audits: {
              include: {
                auditReport: true
              }
            }
          }
        }
      }
    })

    const facilityMap = {}
    for (const facility of allFacilities) {
      const facilityName = facility.name
      if (!facilityMap[facilityName]) facilityMap[facilityName] = { rates: [], totalAudits: 0 }

      for (const office of facility.offices) {
        facilityMap[facilityName].totalAudits += office.audits.length
        for (const audit of office.audits) {
          if (audit.auditReport?.complianceRate != null) {
            facilityMap[facilityName].rates.push(audit.auditReport.complianceRate)
          }
        }
      }
    }

    const facilityCompliance = Object.entries(facilityMap)
      .map(([name, { rates, totalAudits }]) => {
        const avg = rates.length > 0
          ? Math.round(rates.reduce((s, r) => s + r, 0) / rates.length)
          : 0
        return {
          name,
          rate: avg,
          auditsCount: totalAudits,
          status: avg >= 90 ? 'Compliant' : avg >= 70 ? 'Needs Monitoring' : 'Critical'
        }
      })
      .sort((a, b) => b.rate - a.rate)

    res.json({
      officeCompliance,
      trendData,
      performanceData,
      recurringIssues,
      avgResolutionDays,
      closureRate,
      facilityCompliance,
    })
  } catch (err) {
    console.error('getCompliance error:', err)
    res.status(500).json({ error: 'Failed to load compliance data.' })
  }
}


// ─────────────────────────────────────────────────────────────────
// GET /api/manager/assignable-users
// ─────────────────────────────────────────────────────────────────

const getAssignableUsers = async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      where: { role: { in: ['safety_officer', 'facility_manager'] }, isActive: true },
      select: { id: true, name: true, email: true, avatarUrl: true, role: true },
      orderBy: { name: 'asc' }
    })
    res.json(users)
  } catch (err) {
    console.error('getAssignableUsers error:', err)
    res.status(500).json({ error: 'Failed to load assignable users.' })
  }
}


// ─────────────────────────────────────────────────────────────────
// PATCH /api/manager/profile
// ─────────────────────────────────────────────────────────────────

const updateProfile = async (req, res) => {
  try {
    const { name, mobileNum, department } = req.body
    const updated = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        ...(name       && { name }),
        ...(mobileNum  && { mobileNum }),
        ...(department && { department }),
      },
      select: { id: true, name: true, email: true, avatarUrl: true, role: true }
    })
    res.json(updated)
  } catch (err) {
    console.error('updateProfile error:', err)
    res.status(500).json({ error: 'Failed to update profile.' })
  }
}


// ─────────────────────────────────────────────────────────────────
// PATCH /api/manager/notifications
// ─────────────────────────────────────────────────────────────────

const updateNotifications = async (req, res) => {
  try {
    const { notifs } = req.body
    res.json({ message: 'Notification preferences saved.', notifs })
  } catch (err) {
    console.error('updateNotifications error:', err)
    res.status(500).json({ error: 'Failed to save notification preferences.' })
  }
}


module.exports = {
  getStats,
  getTrend,
  getActivity,
  getFindings,
  updateFinding,
  getAudits,
  acknowledgeAudit,
  completeAudit,
  getMaintenance,
  createMaintenance,
  updateMaintenance,
  getAssignableUsers,
  getCompliance,
  updateProfile,
  updateNotifications,
}