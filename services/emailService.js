// services/emailService.js
// Uses Nodemailer with Gmail OAuth2 or App Password
// Make sure to set these env vars:
//   EMAIL_USER=your-gmail@gmail.com
//   EMAIL_PASS=your-app-password   (Gmail > Security > App Passwords)

const nodemailer = require('nodemailer')

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
})

// ─── Generic send ──────────────────────────────────────
const sendEmail = async ({ to, subject, html }) => {
  try {
    await transporter.sendMail({
      from: `"Safety Audit Assessment System" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html
    })
  } catch (err) {
    console.error('[EmailService] Failed to send email:', err.message)
  }
}

// ─── Templates ─────────────────────────────────────────

const baseTemplate = (title, body) => `
  <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
    <div style="background: #8B0000; padding: 20px 24px;">
      <h2 style="color: #fff; margin: 0; font-size: 18px;">Safety Audit Assessment System</h2>
    </div>
    <div style="padding: 24px; border: 1px solid #eee; border-top: none;">
      <h3 style="margin-top: 0;">${title}</h3>
      ${body}
    </div>
    <div style="padding: 12px 24px; background: #fafafa; border: 1px solid #eee; border-top: none; font-size: 12px; color: #aaa;">
      This is an automated notification from Safety Audit Assessment System. Do not reply to this email.
    </div>
  </div>
`

// ─── Notification Senders ──────────────────────────────

/**
 * Notify officer when manager changes audit status
 * Triggered on: acknowledged, resolving, pending_review, completed
 */
const notifyInspectionStatusChange = async (officer, audit, newStatus) => {
  if (!officer?.email) return

  const statusLabels = {
    acknowledged:   'Acknowledged by Manager',
    resolving:      'Corrective Actions Assigned',
    pending_review: 'Awaiting Your Review',
    completed:      'Inspection Completed',
    submitted:      'Submitted to Manager'
  }

  const label = statusLabels[newStatus] || newStatus

  await sendEmail({
    to: officer.email,
    subject: `Inspection ${audit.inspectionCode} — ${label}`,
    html: baseTemplate(
      `Inspection Status Updated`,
      `
        <p>The status of your inspection has been updated.</p>
        <table style="width:100%; border-collapse:collapse; margin: 16px 0;">
          <tr><td style="padding:8px; color:#666; width:40%;">Inspection Code</td><td style="padding:8px; font-weight:600;">${audit.inspectionCode}</td></tr>
          <tr style="background:#fafafa;"><td style="padding:8px; color:#666;">Office</td><td style="padding:8px;">${audit.office?.name || '—'}</td></tr>
          <tr><td style="padding:8px; color:#666;">New Status</td><td style="padding:8px;"><span style="background:#fde8e8; color:#8B0000; padding:2px 10px; border-radius:999px; font-size:13px;">${label}</span></td></tr>
        </table>
        <a href="${process.env.FRONTEND_URL}/officer/inspections/${audit.id}/start"
           style="display:inline-block; background:#8B0000; color:#fff; padding:10px 20px; border-radius:6px; text-decoration:none; margin-top:8px;">
          View Inspection
        </a>
      `
    )
  })
}

/**
 * Notify officer when inspection is submitted successfully
 * Triggered on: submitAudit
 */
const notifyInspectionSubmitted = async (officer, audit) => {
  if (!officer?.email) return

  await sendEmail({
    to: officer.email,
    subject: `Inspection ${audit.inspectionCode} — Submitted`,
    html: baseTemplate(
      'Inspection Submitted Successfully',
      `
        <p>Your inspection report has been submitted to the facility manager for review.</p>
        <table style="width:100%; border-collapse:collapse; margin: 16px 0;">
          <tr><td style="padding:8px; color:#666; width:40%;">Inspection Code</td><td style="padding:8px; font-weight:600;">${audit.inspectionCode}</td></tr>
          <tr style="background:#fafafa;"><td style="padding:8px; color:#666;">Office</td><td style="padding:8px;">${audit.office?.name || '—'}</td></tr>
          <tr><td style="padding:8px; color:#666;">Submitted At</td><td style="padding:8px;">${new Date().toLocaleString('en-PH')}</td></tr>
        </table>
        <p style="color:#666; font-size:14px;">You will be notified when the manager reviews your report.</p>
      `
    )
  })
}

/**
 * Notify officer when corrective action is overdue
 * Triggered by: scheduled job or on findings fetch
 */
const notifyOverdueCorrectiveAction = async (officer, audit, finding) => {
  if (!officer?.email) return

  await sendEmail({
    to: officer.email,
    subject: `Overdue Corrective Action — ${audit.inspectionCode}`,
    html: baseTemplate(
      'Corrective Action Overdue',
      `
        <p>A corrective action for one of your inspections is past its due date.</p>
        <table style="width:100%; border-collapse:collapse; margin: 16px 0;">
          <tr><td style="padding:8px; color:#666; width:40%;">Inspection Code</td><td style="padding:8px; font-weight:600;">${audit.inspectionCode}</td></tr>
          <tr style="background:#fafafa;"><td style="padding:8px; color:#666;">Finding</td><td style="padding:8px;">${finding.finding || '—'}</td></tr>
          <tr><td style="padding:8px; color:#666;">Due Date</td><td style="padding:8px; color:#b91c1c;">${new Date(finding.dueDate).toLocaleDateString('en-PH')}</td></tr>
          <tr style="background:#fafafa;"><td style="padding:8px; color:#666;">Assigned To</td><td style="padding:8px;">${finding.assignedTo || '—'}</td></tr>
        </table>
        <a href="${process.env.FRONTEND_URL}/officer/findings"
           style="display:inline-block; background:#8B0000; color:#fff; padding:10px 20px; border-radius:6px; text-decoration:none; margin-top:8px;">
          View Findings
        </a>
      `
    )
  })
}

/**
 * Notify officer of compliance alert
 * Triggered when: compliance rate drops below 70%
 */
const notifyComplianceAlert = async (officer, audit, rate) => {
  if (!officer?.email) return

  await sendEmail({
    to: officer.email,
    subject: `Compliance Alert — ${audit.office?.name || 'Facility'} below threshold`,
    html: baseTemplate(
      '⚠️ Compliance Below Threshold',
      `
        <p>A recent inspection has flagged a compliance concern.</p>
        <table style="width:100%; border-collapse:collapse; margin: 16px 0;">
          <tr><td style="padding:8px; color:#666; width:40%;">Inspection Code</td><td style="padding:8px; font-weight:600;">${audit.inspectionCode}</td></tr>
          <tr style="background:#fafafa;"><td style="padding:8px; color:#666;">Office / Facility</td><td style="padding:8px;">${audit.office?.name || '—'}</td></tr>
          <tr><td style="padding:8px; color:#666;">Compliance Rate</td><td style="padding:8px; color:#b91c1c; font-weight:700;">${rate}%</td></tr>
        </table>
        <p style="color:#666; font-size:14px;">Please review the findings and ensure corrective actions are taken promptly.</p>
      `
    )
  })
}

/**
 * Notify assignee when a corrective action is assigned to them
 * Triggered on: AssignModal submit
 */
const notifyCorrectiveActionAssigned = async (assigneeEmail, audit, finding, dueDate) => {
  if (!assigneeEmail) return

  await sendEmail({
    to: assigneeEmail,
    subject: `Corrective Action Assigned — ${audit.inspectionCode}`,
    html: baseTemplate(
      'You Have Been Assigned a Corrective Action',
      `
        <p>A corrective action from a safety inspection has been assigned to you.</p>
        <table style="width:100%; border-collapse:collapse; margin: 16px 0;">
          <tr><td style="padding:8px; color:#666; width:40%;">Inspection Code</td><td style="padding:8px; font-weight:600;">${audit.inspectionCode}</td></tr>
          <tr style="background:#fafafa;"><td style="padding:8px; color:#666;">Office</td><td style="padding:8px;">${audit.office?.name || '—'}</td></tr>
          <tr><td style="padding:8px; color:#666;">Finding</td><td style="padding:8px;">${finding.finding || '—'}</td></tr>
          <tr style="background:#fafafa;"><td style="padding:8px; color:#666;">Recommended Action</td><td style="padding:8px;">${finding.correctiveAction || '—'}</td></tr>
          <tr><td style="padding:8px; color:#666;">Severity</td><td style="padding:8px;">${finding.severity || '—'}</td></tr>
          <tr style="background:#fafafa;"><td style="padding:8px; color:#666;">Due Date</td><td style="padding:8px; color:#b91c1c; font-weight:600;">${dueDate ? new Date(dueDate).toLocaleDateString('en-PH') : 'Not specified'}</td></tr>
        </table>
        <p style="color:#666; font-size:14px;">Please take the necessary corrective action before the due date.</p>
      `
    )
  })
}


module.exports = {
  sendEmail,
  notifyInspectionSubmitted,
  notifyInspectionStatusChange,
  notifyOverdueCorrectiveAction,
  notifyComplianceAlert,
  notifyCorrectiveActionAssigned
}