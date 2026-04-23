// complianceController.js
// GET /compliance/officer-summary

const prisma = require('../config/db')

const getOfficerComplianceSummary = async (req, res) => {
  try {
    const inspectorId = req.user.id
    const now = new Date()

    // ── 1. All audits with a report (submitted → completed) by this officer ──
    // We use AuditReport.complianceRate as the source of truth for rates
    const audits = await prisma.audit.findMany({
      where: {
        inspectorId,
        status: { in: ['submitted', 'acknowledged', 'resolving', 'pending_review', 'completed'] },
        auditReport: { complianceRate: { not: null } }
      },
      include: {
        office: { include: { facility: true } },
        auditReport: true,
        auditResponses: {
          include: {
            checklistItem: {
              include: { section: true }
            },
            maintenanceTasks: true
          }
        }
      },
      orderBy: { submittedAt: 'desc' }
    })

    const totalAudits = audits.length

    // ── 2. Overall compliance rate (average of AuditReport.complianceRate) ──
    const overallRate = totalAudits > 0
      ? Math.round(
          audits.reduce((sum, a) => sum + (a.auditReport.complianceRate ?? 0), 0) / totalAudits
        )
      : 0

    // ── 3. Corrective action stats ──
    // Pending = all non-compliant responses not yet resolved
    const allFindings = audits.flatMap(a =>
      a.auditResponses.filter(r =>
        r.answer === 'no' && r.finding && r.finding.trim() !== ''
      )
    )

    const pendingActions = allFindings.filter(
      f => f.resolutionStatus === 'pending' || f.resolutionStatus === 'assigned'
    ).length

    const overdueActions = allFindings.filter(f =>
      f.resolutionStatus !== 'resolved' &&
      f.dueDate &&
      new Date(f.dueDate) < now
    ).length

    // ── 4. Facility compliance (avg AuditReport.complianceRate per facility) ──
    const facilityMap = {}
    for (const audit of audits) {
      const facilityName = audit.office?.facility?.name ?? 'Unknown'
      if (!facilityMap[facilityName]) facilityMap[facilityName] = { rates: [] }
      if (audit.auditReport?.complianceRate != null) {
        facilityMap[facilityName].rates.push(audit.auditReport.complianceRate)
      }
    }

    const facilityCompliance = Object.entries(facilityMap)
      .map(([name, { rates }]) => ({
        name,
        rate: rates.length > 0
          ? Math.round(rates.reduce((s, r) => s + r, 0) / rates.length)
          : 0,
        auditsCount: rates.length,
        // status label for facility ranking
        status: (() => {
          const avg = rates.length > 0
            ? Math.round(rates.reduce((s, r) => s + r, 0) / rates.length)
            : 0
          if (avg >= 90) return 'Compliant'
          if (avg >= 70) return 'Needs Monitoring'
          return 'Critical'
        })()
      }))
      .sort((a, b) => b.rate - a.rate)

    const facilitiesBelowThreshold = facilityCompliance.filter(f => f.rate < 70).length

    // ── 5. Compliance trend — last 6 months ──
    const trend = []
    for (let i = 5; i >= 0; i--) {
      const start = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const end   = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59)

      const monthAudits = audits.filter(a => {
        const d = new Date(a.submittedAt ?? a.createdAt)
        return d >= start && d <= end
      })

      const monthRates = monthAudits
        .map(a => a.auditReport?.complianceRate)
        .filter(r => r != null)

      trend.push({
        month: start.toLocaleDateString('en-PH', { month: 'short' }),
        rate: monthRates.length > 0
          ? Math.round(monthRates.reduce((s, r) => s + r, 0) / monthRates.length)
          : 0,
        audits: monthAudits.length
      })
    }

    // ── 6. Section compliance (yes/no responses, grouped by section.name) ──
    // AuditReport.complianceRate is audit-level only, so we compute
    // section-level from responses — this is the only accurate way
    const sectionMap = {}
    for (const audit of audits) {
      for (const r of audit.auditResponses) {
        if (r.isNASection) continue // skip N/A marked sections
        const sectionName = r.checklistItem?.section?.name ?? 'Uncategorized'
        if (!sectionMap[sectionName]) sectionMap[sectionName] = { yes: 0, total: 0 }
        if (r.answer === 'yes' || r.answer === 'no') {
          sectionMap[sectionName].total++
          if (r.answer === 'yes') sectionMap[sectionName].yes++
        }
      }
    }

    const sectionCompliance = Object.entries(sectionMap)
      .map(([name, { yes, total }]) => ({
        name,
        rate: total > 0 ? Math.round((yes / total) * 100) : 0,
        total
      }))
      .sort((a, b) => a.rate - b.rate) // worst first so it stands out in the bar chart

    // ── 7. Distribution (count of facilities per compliance tier) ──
    const distribution = [
      {
        label: 'High (≥85%)',
        value: facilityCompliance.filter(f => f.rate >= 85).length,
        color: '#166534'
      },
      {
        label: 'Moderate (70–84%)',
        value: facilityCompliance.filter(f => f.rate >= 70 && f.rate < 85).length,
        color: '#b45309'
      },
      {
        label: 'Low (<70%)',
        value: facilityCompliance.filter(f => f.rate < 70).length,
        color: '#b91c1c'
      }
    ]

    // ── 8. Top issues (most recurring non-compliant checklist items) ──
    const issueMap = {}
    for (const audit of audits) {
      for (const r of audit.auditResponses) {
        if (r.answer !== 'no') continue
        // Use the checklist item statement as the issue label
        const issueKey = r.checklistItem?.statement ?? r.finding ?? 'Unknown issue'
        const sectionName = r.checklistItem?.section?.name ?? '—'
        if (!issueMap[issueKey]) {
          issueMap[issueKey] = { count: 0, section: sectionName }
        }
        issueMap[issueKey].count++
      }
    }

    const topIssues = Object.entries(issueMap)
      .map(([issue, { count, section }]) => ({ issue, count, section }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)

    res.json({
      overallRate,
      totalAudits,
      pendingActions,
      overdueActions,
      facilitiesBelowThreshold,
      trend,
      sectionCompliance,
      facilityCompliance,
      distribution,
      topIssues
    })

  } catch (err) {
    console.error('[ComplianceController]', err)
    res.status(500).json({ message: 'Error fetching compliance summary', error: err.message })
  }
}

module.exports = { getOfficerComplianceSummary }