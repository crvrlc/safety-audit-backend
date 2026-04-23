const jwt = require('jsonwebtoken');
const prisma = require('../config/db');

const googleCallback = async (req, res) => {
  try {
    console.log("REQ.USER:", req.user)

     if (!req.user) {
      return res.status(401).json({ message: "No user returned from Google" })
    }
    // For testing: use intended role from cookie/header
    // In production: role always comes from DB
    const user = req.user;

    const token = jwt.sign(
      {
        id:        user.id,
        email:     user.email,
        role:      user.role,
        name:      user.name,
        avatarUrl: user.avatarUrl
      },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    const roleRoutes = {
      safety_officer:   'officer',
      facility_manager: 'manager',
      admin:            'admin'
    };

    const dashboard = roleRoutes[user.role];
    res.redirect(`http://localhost:5173/auth/callback?token=${token}&role=${user.role}&dashboard=${dashboard}`);
  } catch (err) {
    res.status(500).json({ message: 'Auth error', error: err.message });
  }
};

const getMe = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id }
    });
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching user' });
  }
};

module.exports = { googleCallback, getMe };