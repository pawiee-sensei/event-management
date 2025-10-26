// app.js
import express from 'express';
import path from 'path';
import morgan from 'morgan';
import session from 'express-session';
import expressMySQLSession from 'express-mysql-session';
import pool from './config/db.js';
import adminRoutes from './routes/adminRoutes.js';
import organizerRoutes from './routes/organizerRoutes.js';
import publicRoutes from './routes/publicRoutes.js'; // ✅ NEW: Public events page

const MySQLStore = expressMySQLSession(session);
const app = express();
const __dirname = path.resolve();

console.log('🟢 Starting Event Management App...');

// ===== Serve static assets =====


// serve uploaded images publicly

app.use('/uploads', express.static(path.join(__dirname, 'uploads'))); // for banner/proof files
app.use(express.static(path.join(__dirname, 'public'))); // CSS/JS/images

// ===== View engine (EJS) =====
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// ===== Middleware =====
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(morgan('dev'));

// ===== Sessions (stored in MySQL) =====
const sessionStore = new MySQLStore({
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'event_mgmt',
});

app.use(
  session({
    secret: 'change-this-secret', // replace with a long random string
    resave: false,
    saveUninitialized: false,
    store: sessionStore,
    cookie: {
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 8, // 8 hours
    },
  })
);

// ===== Routes =====
app.get('/', (req, res) => {
  res.send('<h1>Event Management System</h1><p>Server running successfully.</p><p><a href="/events">View Public Events</a></p>');
});

app.use('/admin', adminRoutes);
app.use('/organizer', organizerRoutes);
app.use('/', publicRoutes); // ✅ NEW: public-facing routes

// ===== 404 handler =====
app.use((req, res) => {
  res.status(404).send('404 - Page Not Found');
});

// ===== Start Server =====
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`✅ Server running at: http://localhost:${PORT}`);
});
