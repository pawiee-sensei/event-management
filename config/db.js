// config/db.js
import mysql from 'mysql2/promise';

// Edit these to match your XAMPP MySQL setup
const pool = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: '',          // XAMPP default is empty
  database: 'event_mgmt',// we'll create this DB soon
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

export default pool;
