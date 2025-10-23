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

// ===== Admin Logout =====
router.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/admin/login');
  });
});

export default router;
