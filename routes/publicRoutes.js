import express from "express";
import pool from "../config/db.js";

const router = express.Router();

/* ===========================================
   🧭 1. PUBLIC EVENT FEED (SEARCH & FILTER)
   =========================================== */
router.get("/events", async (req, res) => {
  const { search = "", category = "" } = req.query;

  try {
    let query = `
      SELECT e.*, u.name AS organizer_name
      FROM events e
      LEFT JOIN users u ON e.created_by = u.id
      WHERE e.status = 'approved'
    `;
    const params = [];

    if (search) {
      query += ` AND (e.title LIKE ? OR e.location LIKE ? OR u.name LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    if (category) {
      query += ` AND e.category = ?`;
      params.push(category);
    }

    query += ` ORDER BY e.created_at DESC`;

    const [events] = await pool.query(query, params);

    // Count comments for each event
    for (let event of events) {
      const [comments] = await pool.query(
        "SELECT COUNT(*) AS total FROM comments WHERE event_id = ?",
        [event.id]
      );
      event.commentCount = comments[0].total;
    }

    res.render("public/events", { events, search, category });
  } catch (err) {
    console.error("Feed error:", err);
    res.status(500).send("Server error loading events.");
  }
});

/* ===========================================
   💬 2. POST COMMENT OR REPLY
   =========================================== */
router.post("/events/:id/comment", async (req, res) => {
  const { id } = req.params;
  const { user_name, comment, parent_id } = req.body;

  try {
    if (!user_name || !comment.trim()) {
      return res.status(400).json({ error: "Invalid comment" });
    }

    const [result] = await pool.query(
      "INSERT INTO comments (event_id, user_name, comment, parent_id) VALUES (?, ?, ?, ?)",
      [id, user_name, comment.trim(), parent_id || null]
    );

    res.status(200).json({ success: true, id: result.insertId });
  } catch (err) {
    console.error("Comment error:", err);
    res.status(500).json({ error: "Server error posting comment" });
  }
});

/* ===========================================
   🧾 3. EVENT DETAILS PAGE (/events/:id)
   =========================================== */
router.get("/events/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const [eventRows] = await pool.query(
      `
      SELECT e.*, u.name AS organizer_name
      FROM events e
      LEFT JOIN users u ON e.created_by = u.id
      WHERE e.id = ? AND e.status = 'approved'
      `,
      [id]
    );

    if (eventRows.length === 0) {
      return res.status(404).send("Event not found.");
    }

    const event = eventRows[0];

    // Fetch comments and replies
    const [comments] = await pool.query(
      "SELECT * FROM comments WHERE event_id = ? ORDER BY created_at ASC",
      [id]
    );

    // Nest replies
    const commentMap = {};
    comments.forEach((c) => (commentMap[c.id] = { ...c, replies: [] }));
    const rootComments = [];

    comments.forEach((c) => {
      if (c.parent_id) {
        commentMap[c.parent_id]?.replies.push(commentMap[c.id]);
      } else {
        rootComments.push(commentMap[c.id]);
      }
    });

    event.comments = rootComments;

    res.render("public/eventDetails", { event });
  } catch (err) {
    console.error("Event details error:", err);
    res.status(500).send("Error loading event details.");
  }
});

export default router;
