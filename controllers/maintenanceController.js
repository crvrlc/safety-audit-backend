const prisma = require('../config/db');

// GET all maintenance tasks for a finding
const getTasksByFinding = async (req, res) => {
  try {
    const tasks = await prisma.maintenanceTask.findMany({
      where: { findingId: parseInt(req.params.findingId) },
      include: {
        assignedUser: { select: { id: true, name: true, email: true } },
        finding: true
      }
    });
    res.json(tasks);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching tasks', error: err.message });
  }
};

// GET all maintenance tasks assigned to current user
const getMyTasks = async (req, res) => {
  try {
    const tasks = await prisma.maintenanceTask.findMany({
      where: { assignedTo: req.user.id },
      include: {
        finding: {
          include: {
            audit: {
              include: {
                office: {
                  include: { facility: true, unit: true }
                }
              }
            }
          }
        }
      },
      orderBy: { dueDate: 'asc' }
    });
    res.json(tasks);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching tasks', error: err.message });
  }
};

// GET all maintenance tasks (admin/manager view)
const getAllTasks = async (req, res) => {
  try {
    const tasks = await prisma.maintenanceTask.findMany({
      include: {
        assignedUser: { select: { id: true, name: true, email: true } },
        finding: {
          include: {
            audit: {
              include: {
                office: {
                  include: { facility: true, unit: true }
                }
              }
            }
          }
        }
      },
      orderBy: { dueDate: 'asc' }
    });
    res.json(tasks);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching tasks', error: err.message });
  }
};

// POST create maintenance task for a finding
const createTask = async (req, res) => {
  try {
    const { description, assignedTo, dueDate } = req.body;
    const findingId = parseInt(req.params.findingId);

    const task = await prisma.maintenanceTask.create({
      data: {
        description,
        findingId,
        assignedTo:  assignedTo ? parseInt(assignedTo) : null,
        dueDate:     dueDate ? new Date(dueDate) : null,
        status:      'waiting_for_repairs'
      },
      include: {
        assignedUser: { select: { id: true, name: true, email: true } }
      }
    });

    // Update finding status to ongoing
    await prisma.finding.update({
      where: { id: findingId },
      data:  { resolutionStatus: 'ongoing' }
    });

    res.status(201).json(task);
  } catch (err) {
    res.status(500).json({ message: 'Error creating task', error: err.message });
  }
};

// PATCH update task status
const updateTaskStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const taskId = parseInt(req.params.id);

    const task = await prisma.maintenanceTask.update({
      where: { id: taskId },
      data: {
        status,
        completedAt: status === 'completed_repairs' ? new Date() : null
      }
    });

    // If completed, check if all tasks for this finding are done
    if (status === 'completed_repairs') {
      const pendingTasks = await prisma.maintenanceTask.findMany({
        where: {
          findingId: task.findingId,
          status: { not: 'completed_repairs' }
        }
      });

      // If no pending tasks, mark finding as resolved
      if (pendingTasks.length === 0) {
        await prisma.finding.update({
          where: { id: task.findingId },
          data: {
            resolutionStatus: 'resolved',
            resolvedAt:       new Date()
          }
        });
      }
    }

    // Check if overdue
    if (task.dueDate && task.dueDate < new Date() && status !== 'completed_repairs') {
      await prisma.maintenanceTask.update({
        where: { id: taskId },
        data:  { status: 'overdue_repairs' }
      });
    }

    res.json(task);
  } catch (err) {
    res.status(500).json({ message: 'Error updating task', error: err.message });
  }
};

// PATCH update task details
const updateTask = async (req, res) => {
  try {
    const { description, assignedTo, dueDate } = req.body;
    const task = await prisma.maintenanceTask.update({
      where: { id: parseInt(req.params.id) },
      data: {
        description,
        assignedTo: assignedTo ? parseInt(assignedTo) : null,
        dueDate:    dueDate ? new Date(dueDate) : null
      }
    });
    res.json(task);
  } catch (err) {
    res.status(500).json({ message: 'Error updating task', error: err.message });
  }
};

// DELETE task
const deleteTask = async (req, res) => {
  try {
    await prisma.maintenanceTask.delete({
      where: { id: parseInt(req.params.id) }
    });
    res.json({ message: 'Task deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Error deleting task', error: err.message });
  }
};

module.exports = {
  getTasksByFinding,
  getMyTasks,
  getAllTasks,
  createTask,
  updateTaskStatus,
  updateTask,
  deleteTask
};