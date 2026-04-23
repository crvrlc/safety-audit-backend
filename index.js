require('dotenv').config();

const express = require('express');
const cors = require('cors');
const session = require('express-session');
const passport = require('./config/passport');
const {PrismaClient} = require('@prisma/client');
const prisma = new PrismaClient();

const authRoutes = require('./routes/authRoutes');
const facilityRoutes = require('./routes/facilityRoutes');
const unitRoutes = require('./routes/unitRoutes');
const officeRoutes = require('./routes/officeRoutes');
const facilityUnitRoutes = require('./routes/facilityUnitRoutes');
const userRoutes = require('./routes/userRoutes');
const checklistRoutes = require('./routes/checklistRoutes');
const auditRoutes = require('./routes/auditRoutes');
const findingActionRoutes = require('./routes/findingActionRoutes');
const maintenanceRoutes = require('./routes/maintenanceRoutes');
const evidenceRoutes = require('./routes/evidenceRoutes');
const adminRoutes = require('./routes/adminRoutes');
const managerRoutes = require('./routes/managerRoutes');

const app = express();

app.use(cors({
  origin: process.env.FRONTEND_URL,
  credentials: true
}));
app.use(express.json());
app.use(session({
  secret: process.env.JWT_SECRET,
  resave: false,
  saveUninitialized: false
}));

passport.serializeUser((user, done) => {
  done(null, user.id); // Store only the user ID in the session
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await prisma.user.findUnique({ where: { id } });
    done(null, user);
  } catch (err) {
    done(err, null);
  }
});

app.use(passport.initialize());
app.use(passport.session());


app.use('/auth', authRoutes);
app.use('/api/facilities', facilityRoutes);
app.use('/api/units', unitRoutes);
app.use('/api/offices', officeRoutes);
app.use('/api/facility-units', facilityUnitRoutes);
app.use('/api/users', userRoutes);
app.use('/api/checklists', checklistRoutes);
app.use('/api/audits', auditRoutes);
app.use('/api/findings', findingActionRoutes);
app.use('/api/maintenance', maintenanceRoutes);
app.use('/api/compliance', require('./routes/complianceRoutes'));
app.use('/api/evidence', evidenceRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/manager', managerRoutes);
app.use('/api/notifications', require('./routes/notificationRoutes'))


app.get('/', (req, res) => res.send('Server is running'));

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

// Add this temporarily to app.js
app.get('/debug-env', (req, res) => {
  res.json({
    clientID: process.env.GOOGLE_CLIENT_ID ? 'SET' : 'MISSING',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET ? 'SET' : 'MISSING',
    jwtSecret: process.env.JWT_SECRET ? 'SET' : 'MISSING',
  });
});