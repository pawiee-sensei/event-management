import express from 'express';
import pool from '../config/db.js';

const router = express.Router();

// ===== Public Events Page =====
router.get('/events', async (req, res) => {
  const { search = '', category = '' } = req.query;

  try {
    let sql = `
      SELECT e.*, u.name AS organizer_name
      FROM events e
      LEFT JOIN users u ON e.created_by = u.id
      WHERE e.status = 'approved'
    `;
    const params = [];

    if (search) {
      sql += ` AND (e.title LIKE ? OR e.location LIKE ? OR u.name LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    if (category) {
      sql += ` AND e.category = ?`;
      params.push(category);
    }

    sql += ` ORDER BY e.date DESC`;

    const [events] = await pool.query(sql, params);
    res.render('public/events', { events, search, category });
  } catch (err) {
    console.error('Error loading events:', err);
    res.send('Server error while loading events.');
  }
});

export default router;
