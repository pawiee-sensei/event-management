// app.js
import express from 'express';
import path from 'path';
import morgan from 'morgan';
import session from 'express-session';
import expressMySQLSession from 'express-mysql-session';
import pool from './config/db.js';
import adminRoutes from './routes/adminRoutes.js';
import organizerRoutes from './routes/organizerRoutes.js';

const MySQLStore = expressMySQLSession(session);
const app = express();
const __dirname = path.resolve();

console.log('🟢 Starting Event Management App...');

// ===== Basic app settings =====
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(morgan('dev'));
app.use(express.static(path.join(__dirname, 'public')));

// ===== Sessions (stored in MySQL) =====
const sessionStore = new MySQLStore({
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'event_mgmt',
});

app.use(
  session({
    secret: 'change-this-secret',
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

// Default home
app.get('/', (req, res) => {
  res.send('<h1>Event Management System</h1><p>Server running.</p>');
});

// Admin routes
app.use('/admin', adminRoutes);

// Organizer routes
app.use('/organizer', organizerRoutes);

// ===== 404 handler =====
app.use((req, res) => {
  res.status(404).send('Not Found');
});

// ===== Start server =====
const PORT = 3000;
app.listen(PORT, () => {
  console.log('✅ Server running at: http://localhost:' + PORT);
});
