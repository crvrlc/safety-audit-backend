const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const prisma = require('./db');

passport.use(new GoogleStrategy({
  clientID:     process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL:  'http://localhost:5001/auth/google/callback',
  passReqToCallback: true   // ← allows us to read req in callback
},
async (req, accessToken, refreshToken, profile, done) => {
  try {
    const email = profile.emails[0].value;
    const role = req.session?.role || 'safety_officer';  // ← get role from session

    let user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      // First time login — create with chosen role
      user = await prisma.user.create({
        data: {
          name:      profile.displayName,
          email:     email,
          googleId:  profile.id,
          avatarUrl: profile.photos[0]?.value,
          role:      role,
          isActive:  true
        }
      });
    } else {
      // Already exists — update google info but KEEP their existing role
      user = await prisma.user.update({
        where: { email },
        data: {
          googleId:  profile.id,
          avatarUrl: profile.photos[0]?.value,
          name:      profile.displayName
        }
      });
    }

    if (!user.isActive) {
      return done(null, false, { message: 'Account deactivated.' });
    }

    return done(null, user);
  } catch (err) {
    return done(err, null);
  }
}));

module.exports = passport;