// app.js
import express from 'express';
import path from 'path';
import morgan from 'morgan';
import session from 'express-session';
import MySQLStoreInit from 'connect-mysql2';
import pool from './config/db.js';

const MySQLStore = MySQLStoreInit(session);

const app = express();
const __dirname = path.resolve();

// ===== Basic app settings =====
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views')); // we'll create /views later

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(morgan('dev'));
app.use(express.static(path.join(__dirname, 'public'))); // /public later

// ===== Sessions (stored in MySQL) =====
const sessionStore = new MySQLStore({ pool });
app.use(
  session({
    secret: 'change-this-secret', // replace with a long random string
    resave: false,
    saveUninitialized: false,
    store: sessionStore,
    cookie: {
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 8 // 8 hours
    }
  })
);

// ===== Simple home route (temporary) =====
app.get('/', (req, res) => {
  res.send('<h1>Event Management — Super Admin Setup</h1><p>Server running.</p>');
});

// ===== 404 handler =====
app.use((req, res) => {
  res.status(404).send('Not found');
});

// ===== Start server =====
const PORT = 3000;
app.listen(PORT, () => {
  console.log('Server running on http://localhost:' + PORT);
});
