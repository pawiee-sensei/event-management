// routes/organizerRoutes.js
import express from 'express';
import pool from '../config/db.js';
import bcrypt from 'bcryptjs';
import { ensureAuthenticated, redirectIfAuthenticated } from '../middlewares/auth.js';
import multer from 'multer';
import path from 'path';

// ===== Multer Storage Config =====
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (file.fieldname === 'banner') cb(null, 'uploads/banners');
    else if (file.fieldname === 'proof') cb(null, 'uploads/proofs');
  },
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, unique + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB max
});


const router = express.Router();

// ===== Organizer Signup (GET) =====
router.get('/signup', (req, res) => {
  res.render('organizer/signup', { error: null, success: null });
});

// ===== Organizer Signup (POST) =====
router.post('/signup', async (req, res) => {
  const { name, email, password } = req.body;

  try {
    const [existing] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
    if (existing.length > 0) {
      return res.render('organizer/signup', { error: 'Email already registered.', success: null });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    await pool.query(
      'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, "organizer")',
      [name, email, hashedPassword]
    );

    res.render('organizer/signup', { error: null, success: 'Signup successful! You can now log in.' });
  } catch (err) {
    console.error('Signup error:', err);
    res.render('organizer/signup', { error: 'Server error. Try again later.', success: null });
  }
});


// ===== Organizer Login (GET) =====
router.get('/login', redirectIfAuthenticated, (req, res) => {
  res.render('organizer/login', { error: null });
});

// ===== Organizer Login (POST) =====
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const [rows] = await pool.query('SELECT * FROM users WHERE email = ? AND role = "organizer"', [email]);
    if (rows.length === 0) {
      return res.render('organizer/login', { error: 'Invalid email or password.' });
    }

    const organizer = rows[0];
    const isMatch = await bcrypt.compare(password, organizer.password);

    if (!isMatch) {
      return res.render('organizer/login', { error: 'Invalid email or password.' });
    }

    // Save organizer session
    req.session.user = {
      id: organizer.id,
      name: organizer.name,
      role: organizer.role
    };

    res.redirect('/organizer/dashboard');
  } catch (err) {
    console.error('Login error:', err);
    res.send('Server error.');
  }
});

// ===== Organizer Dashboard =====
router.get('/dashboard', ensureAuthenticated, (req, res) => {
  if (req.session.user.role !== 'organizer') {
    return res.status(403).send('Access denied.');
  }
  res.render('organizer/dashboard', { organizer: req.session.user });
});

// ===== Organizer Logout =====
router.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/organizer/login');
  });
});


// ===== Organizer View Their Events =====
router.get('/events', ensureAuthenticated, async (req, res) => {
  if (req.session.user.role !== 'organizer') return res.status(403).send('Access denied.');
  try {
    const [events] = await pool.query(
      'SELECT * FROM events WHERE created_by = ? ORDER BY created_at DESC',
      [req.session.user.id]
    );
    res.render('organizer/myEvents', { organizer: req.session.user, events });
  } catch (err) {
    console.error('Fetch events error:', err);
    res.send('Server error.');
  }
});

// ===== Organizer Create Event (GET form) =====
router.get('/events/new', ensureAuthenticated, (req, res) => {
  if (req.session.user.role !== 'organizer') return res.status(403).send('Access denied.');
  res.render('organizer/createEvent', { organizer: req.session.user, error: null, success: null });
});

// ===== Organizer Create Event (POST submit with files) =====
router.post(
  '/events/new',
  ensureAuthenticated,
  upload.fields([
    { name: 'banner', maxCount: 1 },
    { name: 'proof', maxCount: 1 }
  ]),
  async (req, res) => {
    if (req.session.user.role !== 'organizer') {
      return res.status(403).send('Access denied.');
    }

    const { title, description, category, date, time, location } = req.body;
    const bannerFile = req.files['banner'] ? req.files['banner'][0].filename : null;
    const proofFile = req.files['proof'] ? req.files['proof'][0].filename : null;

    try {
      await pool.query(
        `INSERT INTO events
          (title, description, category, date, time, location, created_by, image, proof, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
        [title, description, category, date, time, location, req.session.user.id, bannerFile, proofFile]
      );

      res.render('organizer/createEvent', {
        organizer: req.session.user,
        error: null,
        success: 'Event submitted for approval with uploaded files!'
      });
    } catch (err) {
      console.error('Create event error:', err);
      res.render('organizer/createEvent', {
        organizer: req.session.user,
        error: 'Server error. Please try again.',
        success: null
      });
    }
  }
);



export default router;
