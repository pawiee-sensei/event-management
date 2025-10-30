import express from 'express';
import pool from '../config/db.js';

const router = express.Router();

// ===== Public Event Feed with Search & Filter =====
router.get('/events', async (req, res) => {
  const { search = '', category = '' } = req.query;

  try {
    let query = `
      SELECT e.*, u.name AS organizer_name
      FROM events e
      LEFT JOIN users u ON e.created_by = u.id
      WHERE e.status = 'approved'
    `;
    const params = [];

    // Search by title, location, or organizer name
    if (search) {
      query += ` AND (e.title LIKE ? OR e.location LIKE ? OR u.name LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    // Filter by category
    if (category) {
      query += ` AND e.category = ?`;
      params.push(category);
    }

    query += ` ORDER BY e.created_at DESC`;

    // Get events
    const [events] = await pool.query(query, params);

    // Fetch comments for each event
    for (let event of events) {
      const [comments] = await pool.query(
        'SELECT * FROM comments WHERE event_id = ? ORDER BY created_at ASC',
        [event.id]
      );
      event.comments = comments;
    }

    res.render('public/events', { events, search, category });
  } catch (err) {
    console.error('Feed error:', err);
    res.send('Server error loading events.');
  }
});

// ===== Post Comment or Reply =====
router.post('/events/:id/comment', async (req, res) => {
  const { id } = req.params;
  const { user_name, comment, parent_id } = req.body;

  try {
    if (!user_name || !comment.trim()) {
      return res.status(400).json({ error: 'Invalid comment' });
    }

    const [result] = await pool.query(
      'INSERT INTO comments (event_id, user_name, comment, parent_id) VALUES (?, ?, ?, ?)',
      [id, user_name, comment.trim(), parent_id || null]
    );

    res.status(200).json({ success: true, id: result.insertId });
  } catch (err) {
    console.error('Comment error:', err);
    res.status(500).json({ error: 'Server error posting comment' });
  }
});





export default router;
