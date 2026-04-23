const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  const sectionId = 3

  // 1. Find all items in the section
  const items = await prisma.checklistItem.findMany({
    where: { sectionId }
  })
  const itemIds = items.map(i => i.id)
  console.log('Items found:', itemIds)

  // 2. Delete audit responses referencing those items
  const deletedResponses = await prisma.auditResponse.deleteMany({
    where: { checklistItemId: { in: itemIds } }
  })
  console.log('Audit responses deleted:', deletedResponses.count)

  // 3. Delete the items
  const deletedItems = await prisma.checklistItem.deleteMany({
    where: { sectionId }
  })
  console.log('Items deleted:', deletedItems.count)

  // 4. Delete the section
  await prisma.checklistSection.delete({
    where: { id: sectionId }
  })
  console.log('Section deleted!')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())