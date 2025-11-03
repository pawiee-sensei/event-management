// routes/organizerRoutes.js
import express from "express";
import pool from "../config/db.js";
import bcrypt from "bcryptjs";
import {
  ensureAuthenticated,
  redirectIfAuthenticated,
} from "../middlewares/auth.js";
import multer from "multer";
import path from "path";

const router = express.Router();

// ===== Multer Config =====
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (file.fieldname === "banner") cb(null, "uploads/banners");
    else if (file.fieldname === "proof") cb(null, "uploads/proofs");
  },
  filename: (req, file, cb) => {
    const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname));
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
});

// ===========================================================
// AUTH: Signup / Login / Logout
// ===========================================================
router.get("/signup", (req, res) => {
  res.render("organizer/signup", { error: null, success: null });
});

router.post("/signup", async (req, res) => {
  const { name, email, password } = req.body;

  try {
    const [existing] = await pool.query("SELECT * FROM users WHERE email = ?", [
      email,
    ]);
    if (existing.length > 0) {
      return res.render("organizer/signup", {
        error: "Email already registered.",
        success: null,
      });
    }

    const hashed = await bcrypt.hash(password, 10);
    await pool.query(
      'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, "organizer")',
      [name, email, hashed]
    );

    res.render("organizer/signup", {
      error: null,
      success: "Signup successful! You can now log in.",
    });
  } catch (err) {
    console.error("Signup error:", err);
    res.render("organizer/signup", {
      error: "Server error. Try again later.",
      success: null,
    });
  }
});

router.get("/login", redirectIfAuthenticated, (req, res) => {
  res.render("organizer/login", { error: null });
});

router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    const [rows] = await pool.query(
      'SELECT * FROM users WHERE email = ? AND role = "organizer"',
      [email]
    );
    if (rows.length === 0)
      return res.render("organizer/login", {
        error: "Invalid email or password.",
      });

    const organizer = rows[0];
    const match = await bcrypt.compare(password, organizer.password);
    if (!match)
      return res.render("organizer/login", {
        error: "Invalid email or password.",
      });

    req.session.user = {
      id: organizer.id,
      name: organizer.name,
      role: organizer.role,
    };

    res.redirect("/organizer/dashboard");
  } catch (err) {
    console.error("Login error:", err);
    res.send("Server error.");
  }
});

router.get("/logout", (req, res) => {
  req.session.destroy(() => res.redirect("/organizer/login"));
});

// ===== Organizer Dashboard =====
router.get('/dashboard', ensureAuthenticated, async (req, res) => {
  if (req.session.user.role !== 'organizer') {
    return res.status(403).send('Access denied.');
  }

  const organizerId = req.session.user.id;

  try {
    // Count events by status
    const [[stats]] = await pool.query(`
      SELECT
        SUM(status = 'approved') AS approved,
        SUM(status = 'pending') AS pending,
        SUM(status = 'rejected') AS rejected
      FROM events
      WHERE created_by = ?
    `, [organizerId]);

    // Count total engagement (comments)
    const [[engagement]] = await pool.query(`
      SELECT COUNT(c.id) AS total_comments
      FROM comments c
      INNER JOIN events e ON e.id = c.event_id
      WHERE e.created_by = ? AND e.status = 'approved'
    `, [organizerId]);

    // Engagement per event
    const [eventEngagement] = await pool.query(`
      SELECT e.title, COUNT(c.id) AS comment_count
      FROM events e
      LEFT JOIN comments c ON e.id = c.event_id
      WHERE e.created_by = ? AND e.status = 'approved'
      GROUP BY e.id
      ORDER BY comment_count DESC
    `, [organizerId]);

    // Events created per month (for optional activity chart)
    const [monthly] = await pool.query(`
      SELECT 
        MONTH(created_at) AS month,
        COUNT(*) AS total
      FROM events
      WHERE created_by = ?
      GROUP BY MONTH(created_at)
      ORDER BY month
    `, [organizerId]);

    res.render('organizer/dashboard', {
      organizer: req.session.user,
      stats,
      engagement: engagement.total_comments || 0,
      monthly,
      eventEngagement, // ← NEW DATA
    });
  } catch (err) {
    console.error('Dashboard error:', err);
    res.status(500).send('Error loading dashboard.');
  }
});


// ===========================================================
// MY EVENTS (View + Nested Comments)
// ===========================================================
router.get("/events", ensureAuthenticated, async (req, res) => {
  if (req.session.user.role !== "organizer")
    return res.status(403).send("Access denied.");
  const organizerId = req.session.user.id;

  try {
    const [events] = await pool.query(
      `
      SELECT e.*, 
             (SELECT COUNT(*) FROM comments c WHERE c.event_id = e.id) AS comment_count
      FROM events e
      WHERE e.created_by = ?
      ORDER BY e.created_at DESC
    `,
      [organizerId]
    );

    for (let ev of events) {
      if (ev.status === "approved") {
        const [comments] = await pool.query(
          "SELECT * FROM comments WHERE event_id = ? ORDER BY created_at ASC",
          [ev.id]
        );
        const map = {};
        comments.forEach((c) => (map[c.id] = { ...c, replies: [] }));
        const root = [];
        comments.forEach((c) => {
          if (c.parent_id) map[c.parent_id]?.replies.push(map[c.id]);
          else root.push(map[c.id]);
        });
        ev.comments = root;
      } else ev.comments = [];
    }

    res.render("organizer/myEvents", {
      organizer: req.session.user,
      events,
    });
  } catch (err) {
    console.error("MyEvents error:", err);
    res.status(500).send("Error loading events.");
  }
});

// ===========================================================
// CREATE EVENT
// ===========================================================
router.get("/events/new", ensureAuthenticated, (req, res) => {
  if (req.session.user.role !== "organizer")
    return res.status(403).send("Access denied.");
  res.render("organizer/createEvent", {
    organizer: req.session.user,
    error: null,
    success: null,
  });
});

router.post(
  "/events/new",
  ensureAuthenticated,
  upload.fields([{ name: "banner" }, { name: "proof" }]),
  async (req, res) => {
    const { title, description, category, date, time, location } = req.body;
    const banner = req.files["banner"] ? req.files["banner"][0].filename : null;
    const proof = req.files["proof"] ? req.files["proof"][0].filename : null;

    try {
      await pool.query(
        `
        INSERT INTO events
        (title, description, category, date, time, location, created_by, image, proof, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
      `,
        [
          title,
          description,
          category,
          date,
          time,
          location,
          req.session.user.id,
          banner,
          proof,
        ]
      );

      res.render("organizer/createEvent", {
        organizer: req.session.user,
        success: "Event submitted for approval!",
        error: null,
      });
    } catch (err) {
      console.error("Create event error:", err);
      res.render("organizer/createEvent", {
        organizer: req.session.user,
        error: "Server error. Please try again.",
        success: null,
      });
    }
  }
);

// ===========================================================
// EDIT EVENT
// ===========================================================
router.get("/events/:id/edit", ensureAuthenticated, async (req, res) => {
  const { id } = req.params;
  const userId = req.session.user.id;

  try {
    const [rows] = await pool.query(
      "SELECT * FROM events WHERE id = ? AND created_by = ?",
      [id, userId]
    );
    if (rows.length === 0) return res.status(404).send("Event not found.");

    res.render("organizer/editEvent", {
      organizer: req.session.user,
      event: rows[0],
      error: null,
      success: null,
    });
  } catch (err) {
    console.error("Edit event error:", err);
    res.status(500).send("Error loading event.");
  }
});

router.post(
  "/events/:id/edit",
  ensureAuthenticated,
  upload.fields([{ name: "banner" }, { name: "proof" }]),
  async (req, res) => {
    const { id } = req.params;
    const userId = req.session.user.id;
    const { title, description, category, date, time, location } = req.body;
    const banner = req.files["banner"] ? req.files["banner"][0].filename : null;
    const proof = req.files["proof"] ? req.files["proof"][0].filename : null;

    try {
      await pool.query(
        `
        UPDATE events
        SET title=?, description=?, category=?, date=?, time=?, location=?,
            image=COALESCE(?, image),
            proof=COALESCE(?, proof),
            status='pending'
        WHERE id=? AND created_by=?
      `,
        [title, description, category, date, time, location, banner, proof, id, userId]
      );
      res.redirect("/organizer/events");
    } catch (err) {
      console.error("Update event error:", err);
      res.status(500).send("Error updating event.");
    }
  }
);

// ===========================================================
// DELETE EVENT
// ===========================================================
router.post("/events/:id/delete", ensureAuthenticated, async (req, res) => {
  const { id } = req.params;
  const userId = req.session.user.id;

  try {
    await pool.query("DELETE FROM events WHERE id = ? AND created_by = ?", [
      id,
      userId,
    ]);
    res.redirect("/organizer/events");
  } catch (err) {
    console.error("Delete event error:", err);
    res.status(500).send("Error deleting event.");
  }
});

// ===========================================================
// DELETE COMMENT (Organizer Moderation)
// ===========================================================
router.post("/comments/:id/delete", ensureAuthenticated, async (req, res) => {
  if (req.session.user.role !== "organizer")
    return res.status(403).send("Access denied.");
  const { id } = req.params;

  try {
    await pool.query("DELETE FROM comments WHERE id = ? OR parent_id = ?", [
      id,
      id,
    ]);
    res.redirect("/organizer/events");
  } catch (err) {
    console.error("Delete comment error:", err);
    res.status(500).send("Error deleting comment.");
  }
});

export default router;
