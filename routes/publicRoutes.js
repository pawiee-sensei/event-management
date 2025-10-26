// routes/publicRoutes.js
import express from 'express';
import pool from '../config/db.js';

const router = express.Router();

// ===== Public Events Page =====
router.get('/events', async (req, res) => {
  try {
    const [events] = await pool.query(
      `SELECT e.*, u.name AS organizer_name 
       FROM events e
       LEFT JOIN users u ON e.created_by = u.id
       WHERE e.status = 'approved'
       ORDER BY e.date DESC`
    );

    res.render('public/events', { events });
  } catch (err) {
    console.error('Error loading events:', err);
    res.send('Server error while loading events.');
  }
});

export default router;
