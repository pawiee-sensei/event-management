// routes/adminRoutes.js
import express from 'express';
import pool from '../config/db.js';
import { ensureAuthenticated, isAdmin, redirectIfAuthenticated } from '../middlewares/auth.js';

const router = express.Router();

// ===== Admin Login (GET) =====
router.get('/login', redirectIfAuthenticated, (req, res) => {
  res.render('admin/login', { error: null });
});

// ===== Admin Login (POST) =====
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const [rows] = await pool.query('SELECT * FROM users WHERE email = ? AND role = ?', [email, 'admin']);

    if (rows.length === 0) {
      return res.render('admin/login', { error: 'Invalid email or password.' });
    }

    const admin = rows[0];

    // Simple password check for now (plain text)
    if (password !== admin.password) {
      return res.render('admin/login', { error: 'Invalid email or password.' });
    }

    req.session.user = {
      id: admin.id,
      name: admin.name,
      role: admin.role
    };

    res.redirect('/admin/dashboard');
  } catch (err) {
    console.error('❌ Login Error:', err);
    res.send('Server error.');
  }
});

// ===== Admin Dashboard =====
router.get('/dashboard', ensureAuthenticated, isAdmin, (req, res) => {
  res.render('admin/dashboard', { admin: req.session.user });
});


import { getPendingEvents, updateEventStatus, getEventById } from '../models/eventModel.js';

// ===== View Pending Events =====
router.get('/events/pending', ensureAuthenticated, isAdmin, async (req, res) => {
  try {
    const pendingEvents = await getPendingEvents();
    res.render('admin/eventRequests', { admin: req.session.user, events: pendingEvents });
  } catch (err) {
    console.error('Error fetching events:', err);
    res.send('Server error.');
  }
});

// ===== Approve Event =====
router.post('/events/:id/approve', ensureAuthenticated, isAdmin, async (req, res) => {
  try {
    await updateEventStatus(req.params.id, 'approved');
    res.redirect('/admin/events/pending');
  } catch (err) {
    console.error('Approve error:', err);
    res.send('Server error.');
  }
});

// ===== Reject Event =====
router.post('/events/:id/reject', ensureAuthenticated, isAdmin, async (req, res) => {
  try {
    await updateEventStatus(req.params.id, 'rejected');
    res.redirect('/admin/events/pending');
  } catch (err) {
    console.error('Reject error:', err);
    res.send('Server error.');
  }
});

// ===== View Event Details =====
router.get('/events/:id', ensureAuthenticated, isAdmin, async (req, res) => {
  try {
    const event = await getEventById(req.params.id);
    if (!event) return res.status(404).send('Event not found');
    res.render('admin/eventDetails', { admin: req.session.user, event });
  } catch (err) {
    console.error('View event error:', err);
    res.send('Server error.');
  }
});


// ===== Admin Logout =====
router.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/admin/login');
  });
});

export default router;
