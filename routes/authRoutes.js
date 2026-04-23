const express = require('express');
const passport = require('passport');
const { googleCallback, getMe } = require('../controllers/authController');
const authenticate = require('../middleware/authMiddleware');

const router = express.Router();

// Step 1: Frontend sends role, we save it to session then redirect to Google
router.get('/google', (req, res, next) => {
  const role = req.query.role || 'safety_officer';
  req.session.role = role;   // ← save role in session
  passport.authenticate('google', {
    scope: ['profile', 'email']
  })(req, res, next);
});

// Step 2: Google redirects back here
router.get('/google/callback',
  passport.authenticate('google', {
    failureRedirect: 'http://localhost:5173/login',
    // session: false
  }),
  googleCallback
);

router.get('/me', authenticate, getMe);

module.exports = router;