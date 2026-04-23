const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

// ─── GET /api/admin/stats ─────────────────────────────
// Returns high-level counts for the dashboard overview cards
const getAdminStats = async (req, res) => {
  try {
    const [totalUsers, totalAudits, issuesIdentified, completedAudits] = await Promise.all([
      prisma.user.count(),
      prisma.audit.count(),
      // issuesIdentified = no-answers with finding or CA text
      prisma.auditResponse.count({
        where: {
          answer: 'no',
          OR: [
            { finding:          { not: '' } },
            { correctiveAction: { not: '' } }
          ]
        }
      }),
      prisma.audit.count({ where: { status: { in: ['submitted', 'completed'] } } }),
    ])

    const completionRate = totalAudits > 0
      ? Math.round((completedAudits / totalAudits) * 100)
      : 0

    res.json({ totalUsers, totalAudits, issuesIdentified, completionRate })
  } catch (err) {
    console.error('getAdminStats error:', err)
    res.status(500).json({ message: 'Failed to fetch stats' })
  }
}


// ─── GET /api/admin/metrics ───────────────────────────
// Returns the important metrics panel data
const getAdminMetrics = async (req, res) => {
  try {
    const [activeUsers, inactiveUsers] = await Promise.all([
      prisma.user.count({ where: { isActive: true } }),
      prisma.user.count({ where: { isActive: false } }),
    ])

    // Most audited area
    const auditsByOffice = await prisma.audit.groupBy({
      by: ['officeId'],
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 1,
    })
    let mostAuditedArea = '—'
    if (auditsByOffice.length > 0) {
      const office = await prisma.office.findUnique({
        where: { id: auditsByOffice[0].officeId }
      })
      mostAuditedArea = office?.name ?? '—'
    }

    // Most active role
    const auditsByInspector = await prisma.audit.groupBy({
      by: ['inspectorId'],
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 5,
    })
    let mostActiveRole = '—'
    if (auditsByInspector.length > 0) {
      const roleCounts = {}
      for (const row of auditsByInspector) {
        const u = await prisma.user.findUnique({
          where: { id: row.inspectorId },
          select: { role: true }
        })
        if (u) roleCounts[u.role] = (roleCounts[u.role] || 0) + row._count.id
      }
      const topRole = Object.entries(roleCounts).sort((a, b) => b[1] - a[1])[0]
      if (topRole) mostActiveRole = topRole[0].replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
    }

    // Most common issue — most frequent finding text (first 40 chars) across all responses
    const topFinding = await prisma.auditResponse.findFirst({
      where: {
        answer: 'no',
        finding: { not: '' }
      },
      orderBy: { id: 'desc' }
    })
    const mostCommonIssue = topFinding?.finding?.slice(0, 40) ?? '—'

    // Compliance by office — based on auditResponses resolutionStatus
    const audits = await prisma.audit.findMany({
      include: {
        office: true,
        auditResponses: {
          where: { answer: 'no' }
        }
      }
    })

    const officeCompliance = {}
    for (const audit of audits) {
      const name = audit.office?.name
      if (!name) continue
      if (!officeCompliance[name]) officeCompliance[name] = { resolved: 0, total: 0 }
      for (const r of audit.auditResponses) {
        officeCompliance[name].total++
        if (r.resolutionStatus === 'resolved') officeCompliance[name].resolved++
      }
    }

    const complianceRates = Object.entries(officeCompliance)
      .filter(([, v]) => v.total > 0)
      .map(([name, v]) => ({ name, rate: v.resolved / v.total }))
      .sort((a, b) => b.rate - a.rate)

    const mostCompliantArea  = complianceRates[0]?.name ?? '—'
    const leastCompliantArea = complianceRates[complianceRates.length - 1]?.name ?? '—'

    // Most overdue area — office with most unresolved no-answers
    const overdueByOffice = {}
    for (const audit of audits) {
      const name = audit.office?.name
      if (!name) continue
      const unresolved = audit.auditResponses.filter(
        r => r.resolutionStatus !== 'resolved'
      ).length
      overdueByOffice[name] = (overdueByOffice[name] || 0) + unresolved
    }
    const mostOverdueArea = Object.entries(overdueByOffice)
      .sort((a, b) => b[1] - a[1])[0]?.[0] ?? '—'

    res.json({
      activeUsers,
      inactiveUsers,
      mostAuditedArea,
      mostActiveRole,
      mostCommonIssue,
      mostCompliantArea,
      leastCompliantArea,
      mostOverdueArea,
    })
  } catch (err) {
    console.error('getAdminMetrics error:', err)
    res.status(500).json({ message: 'Failed to fetch metrics' })
  }
}

// ─── GET /api/admin/activity ──────────────────────────
// Returns recent activity log (last 20 audit-related events)
// Since there is no dedicated ActivityLog table, we derive from recent audits
const getAdminActivity = async (req, res) => {
  try {
    const recentAudits = await prisma.audit.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: {
        inspector: { select: { name: true } },
        office: { select: { name: true } },
      },
    })

    const activity = recentAudits.map(a => ({
      userName: a.inspector?.name ?? '—',
      action: `${a.status === 'submitted' || a.status === 'completed'
        ? 'Submitted' : a.status === 'ongoing'
        ? 'Started' : 'Created'} audit ${a.inspectionCode} — ${a.office?.name ?? ''}`,
      createdAt: a.submittedAt ?? a.createdAt,
    }))

    res.json(activity)
  } catch (err) {
    console.error('getAdminActivity error:', err)
    res.status(500).json({ message: 'Failed to fetch activity' })
  }
}

// ─── GET /api/admin/users ─────────────────────────────
const getUsers = async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, name: true, email: true, role: true,
        isActive: true, avatarUrl: true, createdAt: true,
      },
    })
    res.json(users)
  } catch (err) {
    console.error('getUsers error:', err)
    res.status(500).json({ message: 'Failed to fetch users' })
  }
}

// ─── GET /api/admin/users/:id ─────────────────────────
const getUserById = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: parseInt(req.params.id) },
      select: {
        id: true, name: true, email: true, role: true,
        isActive: true, avatarUrl: true, createdAt: true,
      },
    })
    if (!user) return res.status(404).json({ message: 'User not found' })
    res.json(user)
  } catch (err) {
    console.error('getUserById error:', err)
    res.status(500).json({ message: 'Failed to fetch user' })
  }
}

// ─── POST /api/admin/users ────────────────────────────
// Pre-registers a user (they will complete their profile via Google SSO on first login)
const createUser = async (req, res) => {
  const { name, email, role, isActive } = req.body
  if (!name || !email || !role) {
    return res.status(400).json({ message: 'name, email, and role are required' })
  }
  try {
    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) return res.status(409).json({ message: 'A user with this email already exists' })

    const user = await prisma.user.create({
      data: {
        name,
        email,
        role,
        isActive: isActive ?? true,
        googleId: `pending-${Date.now()}`, // placeholder until first Google login
      },
    })
    res.status(201).json(user)
  } catch (err) {
    console.error('createUser error:', err)
    res.status(500).json({ message: 'Failed to create user' })
  }
}

// ─── PUT /api/admin/users/:id ─────────────────────────
const updateUser = async (req, res) => {
  const { name, email, role, isActive } = req.body
  try {
    const user = await prisma.user.update({
      where: { id: parseInt(req.params.id) },
      data: {
        ...(name     !== undefined && { name }),
        ...(email    !== undefined && { email }),
        ...(role     !== undefined && { role }),
        ...(isActive !== undefined && { isActive }),
      },
    })
    res.json(user)
  } catch (err) {
    console.error('updateUser error:', err)
    if (err.code === 'P2025') return res.status(404).json({ message: 'User not found' })
    res.status(500).json({ message: 'Failed to update user' })
  }
}

// ─── DELETE /api/admin/users/:id (soft deactivate) ────
const deactivateUser = async (req, res) => {
  try {
    await prisma.user.update({
      where: { id: parseInt(req.params.id) },
      data: { isActive: false },
    })
    res.json({ message: 'User deactivated' })
  } catch (err) {
    console.error('deactivateUser error:', err)
    if (err.code === 'P2025') return res.status(404).json({ message: 'User not found' })
    res.status(500).json({ message: 'Failed to deactivate user' })
  }
}

module.exports = {
  getAdminStats,
  getAdminMetrics,
  getAdminActivity,
  getUsers,
  getUserById,
  createUser,
  updateUser,
  deactivateUser,
}