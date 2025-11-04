import express from "express";
import pool from "../config/db.js";

const router = express.Router();

// Fetch all comments for an event
router.get("/:eventId", async (req, res) => {
  const { eventId } = req.params;
  try {
    const [comments] = await pool.query(
      "SELECT * FROM comments WHERE event_id = ? ORDER BY created_at ASC",
      [eventId]
    );
    res.json(comments);
  } catch (err) {
    console.error("Fetch comments error:", err);
    res.status(500).json({ message: "Server error fetching comments." });
  }
});

// Add new comment or reply
router.post("/:eventId", async (req, res) => {
  const { eventId } = req.params;
  const { user_name, comment, parent_id } = req.body;

  try {
    await pool.query(
      "INSERT INTO comments (event_id, user_name, comment, parent_id) VALUES (?, ?, ?, ?)",
      [eventId, user_name, comment, parent_id || null]
    );
    res.json({ success: true });
  } catch (err) {
    console.error("Add comment error:", err);
    res.status(500).json({ message: "Server error adding comment." });
  }
});

export default router;
