// models/eventModel.js
import pool from '../config/db.js';

export async function getPendingEvents() {
  const [rows] = await pool.query(
    `SELECT e.*, u.name AS organizer_name, u.email AS organizer_email
     FROM events e
     LEFT JOIN users u ON e.created_by = u.id
     WHERE e.status = 'pending'
     ORDER BY e.created_at DESC`
  );
  return rows;
}

export async function updateEventStatus(eventId, newStatus) {
  await pool.query('UPDATE events SET status = ? WHERE id = ?', [newStatus, eventId]);
}

export async function getEventById(eventId) {
  const [rows] = await pool.query(
    `SELECT e.*, u.name AS organizer_name, u.email AS organizer_email
     FROM events e
     LEFT JOIN users u ON e.created_by = u.id
     WHERE e.id = ?`,
    [eventId]
  );
  return rows[0];
}
