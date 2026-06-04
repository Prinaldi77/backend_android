const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const authRoutes = require('./routes/authRoutes');
const kegiatanRoutes = require('./routes/kegiatanRoutes');
const attendanceRoutes = require('./routes/attendanceRoutes');
const profileRoutes = require('./routes/profileRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const usersRoutes = require('./routes/usersRoutes');
const kasRoutes = require('./routes/kasRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const reportsRoutes = require('./routes/reportsRoutes');

const app = express();
const port = process.env.PORT || 3000;

// Middleware dasar
app.use(cors());
app.use(express.json()); // Mem-parsing body request berbasis JSON
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Routes
app.use('/api/auth', authRoutes);           // ← PUBLIC: Login & Register
app.use('/api/kegiatan', kegiatanRoutes);
app.use('/api/activities', kegiatanRoutes); // ← ALIAS for activities endpoints
app.use('/api/attendance', attendanceRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/anggota', usersRoutes);       // ← ALIAS for member/anggota endpoints
app.use('/api/kas', kasRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/reports', reportsRoutes);

// Health check endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Scoutify Backend is Running!',
    version: '1.0.0',
    endpoints: [
      '--- AUTH (Public) ---',
      'POST /api/auth/register',
      'POST /api/auth/login',
      'POST /api/auth/logout',
      '--- KEGIATAN ---',
      'GET  /api/kegiatan',
      'POST /api/kegiatan (PEMBINA only)',
      '--- ATTENDANCE ---',
      'POST /api/attendance/checkin',
      'GET  /api/attendance/me',
      'GET  /api/attendance/kegiatan/:id (PEMBINA only)',
      '--- PROFILE ---',
      'GET  /api/profile/me',
      'PUT  /api/profile/me',
      '--- NOTIFICATIONS ---',
      'GET  /api/notifications',
      'PUT  /api/notifications/:id/read',
      'POST /api/notifications/send (PEMBINA only)',
      '--- USERS ---',
      'GET  /api/users',
      'GET  /api/users/:id',
      'POST /api/users (PEMBINA only)',
      'PUT  /api/users/:id/role (PEMBINA only)',
      '--- KAS ---',
      'GET  /api/kas',
      'GET  /api/kas/summary',
      'POST /api/kas (BENDAHARA/PEMBINA only)'
    ]
  });
});

// Menjalankan server
app.listen(port, () => {
  console.log(`✅ Scoutify Server is running on http://localhost:${port}`);
});
