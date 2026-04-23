const prisma = require('../config/db');

// GET all users
const getUsers = async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        avatarUrl: true,
        createdAt: true
      }
    });
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching users', error: err.message });
  }
};

// GET single user
const getUserById = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: parseInt(req.params.id) },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        avatarUrl: true,
        createdAt: true
      }
    });
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching user', error: err.message });
  }
};

// POST create user (admin pre-registers a user)
const createUser = async (req, res) => {
  try {
    const { name, email, role } = req.body;

    // Check if email already exists
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(400).json({ message: 'Email already registered' });
    }

    const user = await prisma.user.create({
      data: {
        name,
        email,
        role,
        googleId: `pending_${email}`, // placeholder until they log in
        isActive: true
      }
    });
    res.status(201).json(user);
  } catch (err) {
    res.status(500).json({ message: 'Error creating user', error: err.message });
  }
};

// PUT update user role or status
const updateUser = async (req, res) => {
  try {
    const { name, role, isActive } = req.body;
    const user = await prisma.user.update({
      where: { id: parseInt(req.params.id) },
      data: {
        name,
        role,
        isActive
      }
    });
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: 'Error updating user', error: err.message });
  }
};

// DELETE user (soft delete — just deactivate)
const deactivateUser = async (req, res) => {
  try {
    const user = await prisma.user.update({
      where: { id: parseInt(req.params.id) },
      data: { isActive: false }
    });
    res.json({ message: 'User deactivated', user });
  } catch (err) {
    res.status(500).json({ message: 'Error deactivating user', error: err.message });
  }
};

module.exports = { getUsers, getUserById, createUser, updateUser, deactivateUser };