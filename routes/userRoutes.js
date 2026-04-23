const express = require('express');
const router = express.Router();
const authenticate = require('../middleware/authMiddleware');
const authorize = require('../middleware/roleMiddleware');
const {
  getUsers,
  getUserById,
  createUser,
  updateUser,
  deactivateUser
} = require('../controllers/userController');

// GET all users — allow safety_officer to read
router.get('/', authenticate, getUsers);  
router.get('/:id', authenticate, getUserById);  

// Only admin can create/update/delete
router.post('/',      authenticate, authorize('admin'), createUser);
router.put('/:id',    authenticate, authorize('admin'), updateUser);
router.delete('/:id', authenticate, authorize('admin'), deactivateUser);

module.exports = router;