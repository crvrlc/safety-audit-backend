// prisma/seed.js
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  // Find or create a default admin user
  let admin = await prisma.user.findFirst({ where: { role: 'admin' } })
  if (!admin) {
    admin = await prisma.user.create({
      data: {
        name:     'System Admin',
        email:    'admin@system.local',
        googleId: `seed-admin-${Date.now()}`,
        role:     'admin',
      }
    })
    console.log('Created seed admin user')
  }

  // Create default template if none exists
  const existing = await prisma.checklistTemplate.findFirst({ where: { isActive: true } })
  if (!existing) {
    await prisma.checklistTemplate.create({
      data: {
        name:      'General Safety Inspection Checklist',
        isActive:  true,
        createdBy: admin.id
      }
    })
    console.log('Created default checklist template')
  } else {
    console.log('Template already exists, skipping')
  }
}

main()
  .catch(err => { console.error(err); process.exit(1) })
  .finally(() => prisma.$disconnect())