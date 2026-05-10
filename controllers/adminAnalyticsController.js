const prisma = require('../config/db')

// ─────────────────────────────────────────────────────────────────
// GET /api/admin/analytics
// Returns all data for the 3-tab analytics page
// ─────────────────────────────────────────────────────────────────

const getAdminAnalytics = async (req, res) => {
  try {
    const now = new Date()

    // ── Base audit query (only audits with a submitted+ status and a compliance rate) ──
    const completedStatuses = [
      'submitted', 'acknowledged', 'resolving', 'pending_review', 'completed'
    ]

    const audits = await prisma.audit.findMany({
      where: {
        status: { in: completedStatuses },
        auditReport: { complianceRate: { not: null } }
      },
      include: {
        office: { include: { facility: true } },
        inspector: { select: { id: true, name: true } },
        auditReport: true,
        auditResponses: {
          include: {
            checklistItem: { include: { section: true } },
            maintenanceTasks: true
          }
        }
      },
      orderBy: { submittedAt: 'desc' }
    })

    // ── All facilities (for coverage + ranking) ──
    const allFacilities = await prisma.facility.findMany({
      include: {
        offices: {
          include: {
            audits: {
              where: {
                status: { in: completedStatuses },
                auditReport: { complianceRate: { not: null } }
              },
              include: { auditReport: true }
            }
          }
        }
      }
    })

    // ── All findings (no-answers with content) ──
    const allFindings = await prisma.auditResponse.findMany({
      where: {
        answer: 'no',
        OR: [
          { finding: { not: '' } },
          { correctiveAction: { not: '' } }
        ]
      },
      include: {
        checklistItem: { include: { section: true } },
        audit: {
          include: {
            office: { include: { facility: true } }
          }
        }
      }
    })

    // ── All maintenance tasks ──
    const allMaintenance = await prisma.maintenanceTask.findMany()

    // ════════════════════════════════════════════════
    // TAB 1 — AUDIT SUMMARY
    // ════════════════════════════════════════════════

    // Total audits (all statuses)
    const totalAudits = await prisma.audit.count()

    // Overall compliance rate (avg of AuditReport.complianceRate)
    const overallComplianceRate = audits.length > 0
      ? Math.round(
          audits.reduce((sum, a) => sum + (a.auditReport.complianceRate ?? 0), 0) / audits.length
        )
      : 0

    // Audit coverage — facilities with at least 1 completed audit vs total
    const facilitiesWithAudits = allFacilities.filter(f =>
      f.offices.some(o => o.audits.length > 0)
    ).length
    const auditCoverage = {
      audited: facilitiesWithAudits,
      total: allFacilities.length,
      percentage: allFacilities.length > 0
        ? Math.round((facilitiesWithAudits / allFacilities.length) * 100)
        : 0
    }

    // Active officers
    const activeOfficers = await prisma.user.count({
      where: { role: 'safety_officer', isActive: true }
    })

    // Compliance trend — avg compliance rate per month (last 6 months)
    const complianceTrend = []
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

      complianceTrend.push({
        month: start.toLocaleDateString('en-PH', { month: 'short' }),
        rate: monthRates.length > 0
          ? Math.round(monthRates.reduce((s, r) => s + r, 0) / monthRates.length)
          : 0,
        audits: monthAudits.length
      })
    }

    // Compliance distribution — count of facilities per tier
    const facilityRates = allFacilities.map(f => {
      const rates = f.offices
        .flatMap(o => o.audits)
        .map(a => a.auditReport?.complianceRate)
        .filter(r => r != null)
      return rates.length > 0
        ? Math.round(rates.reduce((s, r) => s + r, 0) / rates.length)
        : null
    }).filter(r => r !== null)

    const complianceDistribution = [
      { label: 'High (≥85%)',     value: facilityRates.filter(r => r >= 85).length,              color: '#166534' },
      { label: 'Moderate (70–84%)', value: facilityRates.filter(r => r >= 70 && r < 85).length,  color: '#b45309' },
      { label: 'Low (<70%)',      value: facilityRates.filter(r => r < 70).length,                color: '#b91c1c' },
    ]

    // Section compliance — avg yes/no per checklist section
    const sectionMap = {}
    for (const audit of audits) {
      for (const r of audit.auditResponses) {
        if (r.isNASection) continue
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
      .sort((a, b) => a.rate - b.rate) // worst first

    // Audits by status
    const statusCounts = await prisma.audit.groupBy({
      by: ['status'],
      _count: { id: true }
    })
    const auditsByStatus = statusCounts.map(s => ({
      status: s.status,
      count: s._count.id
    }))

    // ════════════════════════════════════════════════
    // TAB 2 — FACILITY OVERVIEW
    // ════════════════════════════════════════════════

    // Facility compliance ranking (all facilities)
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

    // Facility safety overview (based on complianceRate tiers)
    const facilitySafetyOverview = [
      { label: 'Good (≥85%)',       value: facilityCompliance.filter(f => f.rate >= 85).length,             color: '#166534' },
      { label: 'Minor Issues (70–84%)', value: facilityCompliance.filter(f => f.rate >= 70 && f.rate < 85).length, color: '#b45309' },
      { label: 'Critical (<70%)',   value: facilityCompliance.filter(f => f.rate < 70).length,              color: '#b91c1c' },
    ]

    // Cards: good / minor / critical facility counts
    const facilitiesGood     = facilityCompliance.filter(f => f.auditsCount > 0 && f.rate >= 85).length
    const facilitiesMinor    = facilityCompliance.filter(f => f.auditsCount > 0 && f.rate >= 70 && f.rate < 85).length
    const facilitiesCritical = facilityCompliance.filter(f => f.auditsCount > 0 && f.rate < 70).length

    // Corrective action resolution trend (last 6 months)
    const correctionTrend = []
    for (let i = 5; i >= 0; i--) {
      const start = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const end   = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59)

      const [opened, resolved, overdue] = await Promise.all([
        prisma.auditResponse.count({
          where: {
            answer: 'no',
            OR: [{ finding: { not: '' } }, { correctiveAction: { not: '' } }],
            audit: { createdAt: { gte: start, lte: end } }
          }
        }),
        prisma.auditResponse.count({
          where: {
            answer: 'no',
            OR: [{ finding: { not: '' } }, { correctiveAction: { not: '' } }],
            resolutionStatus: 'resolved',
            resolvedAt: { gte: start, lte: end }
          }
        }),
        prisma.auditResponse.count({
          where: {
            answer: 'no',
            OR: [{ finding: { not: '' } }, { correctiveAction: { not: '' } }],
            resolutionStatus: { not: 'resolved' },
            dueDate: { lt: end }
          }
        })
      ])

      correctionTrend.push({
        month: start.toLocaleDateString('en-PH', { month: 'short' }),
        opened,
        resolved,
        overdue
      })
    }

    // Maintenance task status
    const maintenanceStatus = {
      completed: allMaintenance.filter(t => t.status === 'completed_repairs').length,
      waiting:   allMaintenance.filter(t => t.status === 'waiting_for_repairs').length,
      overdue:   allMaintenance.filter(t => t.status === 'overdue_repairs').length,
    }

    // ════════════════════════════════════════════════
    // TAB 3 — FINDINGS & CORRECTIVE ACTIONS
    // ════════════════════════════════════════════════

    const totalFindings    = allFindings.length
    const pendingFindings  = allFindings.filter(f =>
      f.resolutionStatus === 'pending' || f.resolutionStatus === 'assigned'
    ).length
    const overdueFindings  = allFindings.filter(f =>
      f.resolutionStatus !== 'resolved' &&
      f.dueDate &&
      new Date(f.dueDate) < now
    ).length
    const resolvedFindings = allFindings.filter(f => f.resolutionStatus === 'resolved').length

    // Avg resolution days
    const resolvedWithDates = allFindings.filter(f =>
      f.resolutionStatus === 'resolved' && f.resolvedAt && f.audit?.createdAt
    )
    let avgResolutionDays = 0
    if (resolvedWithDates.length > 0) {
      const total = resolvedWithDates.reduce((sum, f) => {
        return sum + Math.max(0,
          (new Date(f.resolvedAt) - new Date(f.audit.createdAt)) / (1000 * 60 * 60 * 24)
        )
      }, 0)
      avgResolutionDays = parseFloat((total / resolvedWithDates.length).toFixed(1))
    }

    // Closure rate
    const closureRate = totalFindings > 0
      ? parseFloat(((resolvedFindings / totalFindings) * 100).toFixed(1))
      : 0

    // On-time rate (resolved before dueDate)
    const resolvedWithDueDate = allFindings.filter(f =>
      f.resolutionStatus === 'resolved' && f.dueDate && f.resolvedAt
    )
    const resolvedOnTime = resolvedWithDueDate.filter(f =>
      new Date(f.resolvedAt) <= new Date(f.dueDate)
    ).length
    const onTimeRate = resolvedWithDueDate.length > 0
      ? parseFloat(((resolvedOnTime / resolvedWithDueDate.length) * 100).toFixed(1))
      : 0

    // Top recurring issues (by checklist item statement)
    const issueMap = {}
    for (const f of allFindings) {
      const key     = f.checklistItem?.statement ?? f.finding ?? null
      const section = f.checklistItem?.section?.name ?? '—'
      if (!key || key.trim() === '') continue
      if (!issueMap[key]) issueMap[key] = { count: 0, section }
      issueMap[key].count++
    }
    const topIssues = Object.entries(issueMap)
      .map(([issue, { count, section }]) => ({ issue, count, section }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)

    // Facilities with most unresolved findings
    const facilityFindingMap = {}
    for (const f of allFindings) {
      if (f.resolutionStatus === 'resolved') continue
      const name = f.audit?.office?.facility?.name ?? 'Unknown'
      facilityFindingMap[name] = (facilityFindingMap[name] || 0) + 1
    }
    const facilitiesWithMostIssues = Object.entries(facilityFindingMap)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)

    // Officer performance ranking
    const officerMap = {}
    for (const audit of audits) {
      const id   = audit.inspector?.id
      const name = audit.inspector?.name ?? 'Unknown'
      if (!id) continue
      if (!officerMap[id]) officerMap[id] = { name, audits: 0, rates: [] }
      officerMap[id].audits++
      if (audit.auditReport?.complianceRate != null) {
        officerMap[id].rates.push(audit.auditReport.complianceRate)
      }
    }
    const officerPerformance = Object.values(officerMap)
      .map(o => ({
        name: o.name,
        audits: o.audits,
        avgRate: o.rates.length > 0
          ? Math.round(o.rates.reduce((s, r) => s + r, 0) / o.rates.length)
          : 0
      }))
      .sort((a, b) => b.audits - a.audits)

    // ── Response ──
    res.json({
      // Tab 1 — Audit Summary
      totalAudits,
      overallComplianceRate,
      auditCoverage,
      activeOfficers,
      complianceTrend,
      complianceDistribution,
      sectionCompliance,
      auditsByStatus,

      // Tab 2 — Facility Overview
      facilitiesGood,
      facilitiesMinor,
      facilitiesCritical,
      facilityCompliance,
      facilitySafetyOverview,
      correctionTrend,
      maintenanceStatus,

      // Tab 3 — Findings & Corrective Actions
      totalFindings,
      pendingFindings,
      overdueFindings,
      resolvedFindings,
      avgResolutionDays,
      closureRate,
      onTimeRate,
      topIssues,
      facilitiesWithMostIssues,
      officerPerformance,
    })

  } catch (err) {
    console.error('[AdminAnalytics]', err)
    res.status(500).json({ message: 'Error fetching analytics', error: err.message })
  }
}

module.exports = { getAdminAnalytics }