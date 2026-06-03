require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const path = require('path');
const db = require('./config/database');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Session
app.use(session({
  secret: process.env.SESSION_SECRET || 'ticketbooking-secret-key',
  resave: false,
  saveUninitialized: true,
  cookie: { maxAge: 1000 * 60 * 60 * 24 }
}));

// Home
app.get('/', (req, res) => {
  res.render('role-selection');
});

// Routes
app.use('/', require('./routes/auth'));
app.use('/', require('./routes/dashboard'));
app.use('/api/customers', require('./routes/api/customers'));
app.use('/api/tickets', require('./routes/api/tickets'));
app.use('/api/trains', require('./routes/api/trains'));
app.use('/api/stats', require('./routes/api/stats'));
app.use('/api/stations', require('./routes/api/stations'));
app.use('/api/employees', require('./routes/api/employees'));
app.use('/api/branches', require('./routes/api/branches'));

// Demo: concurrency
app.get('/demo/concurrency', (req, res) => {
  res.render('demo-concurrency');
});

// Debug endpoints
app.get('/api/test-db', async (req, res) => {
  try {
    const result = await db.executeQuery(`SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE='BASE TABLE'`);
    res.json({ status: 'success', tables: result });
  } catch (error) {
    res.json({ status: 'error', message: error.message });
  }
});

// DEBUG: return Employee table columns (local debugging only)
app.get('/debug/employee-columns', async (req, res) => {
  try {
    const cols = await db.executeQuery("SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Employee'");
    res.json({ status: 'success', columns: cols });
  } catch (error) {
    res.json({ status: 'error', message: error.message });
  }
});

// Auto-cancel pending tickets older than 10 minutes
setInterval(async () => {
  try {
    // Release seats first
    await db.executeQuery(`
      UPDATE trs SET status = 'AVAILABLE'
      FROM TrainRideSeat trs
      INNER JOIN Ticket t ON trs.id = t.idTrainRideSeat
      WHERE t.status = 'pending' AND (t.createdAt IS NULL OR DATEDIFF(MINUTE, t.createdAt, GETDATE()) >= 10)
    `);
    // Then cancel tickets
    await db.executeQuery(`
      UPDATE Ticket SET status = 'cancelled'
      WHERE status = 'pending' AND (createdAt IS NULL OR DATEDIFF(MINUTE, createdAt, GETDATE()) >= 10)
    `);
  } catch (error) {
    console.error('✗ Auto-cancel error:', error.message);
  }
}, 30000);

app.listen(PORT, () => {
  console.log(`✓ Server đang chạy tại http://localhost:${PORT}`);
});
