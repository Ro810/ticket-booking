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

// Legacy passenger APIs (keep for backward compat)
app.post('/api/customer/:customerId', async (req, res) => {
  try {
    const customerId = req.params.customerId;
    const { name, phoneNumber, address } = req.body;
    await db.executeQuery(
      'UPDATE Customer SET Name = @name, phoneNumber = @phoneNumber, Address = @address WHERE id = @id',
      { id: customerId, name, phoneNumber, address }
    );
    res.json({ status: 'success', message: 'Cập nhật thành công' });
  } catch (error) {
    res.json({ status: 'error', message: error.message });
  }
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

app.get('/api/table-schema/:tableName', async (req, res) => {
  try {
    const result = await db.executeQuery(
      `SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = @tableName`,
      { tableName: req.params.tableName }
    );
    res.json({ status: 'success', schema: result });
  } catch (error) {
    res.json({ status: 'error', message: error.message });
  }
});

// Auto-cancel pending tickets older than 15 minutes
setInterval(async () => {
  try {
    // Release seats first
    await db.executeQuery(`
      UPDATE trs SET status = 'AVAILABLE'
      FROM TrainRideSeat trs
      INNER JOIN Ticket t ON trs.idTrainRide = t.idTrainRide AND trs.idSeat = t.idSeat
      WHERE t.status = 'pending' AND (t.createdAt IS NULL OR DATEDIFF(MINUTE, t.createdAt, GETDATE()) >= 15)
    `);
    // Then cancel tickets
    await db.executeQuery(`
      UPDATE Ticket SET status = 'cancelled'
      WHERE status = 'pending' AND (createdAt IS NULL OR DATEDIFF(MINUTE, createdAt, GETDATE()) >= 15)
    `);
  } catch (error) {
    console.error('✗ Auto-cancel error:', error.message);
  }
}, 60000);

app.listen(PORT, () => {
  console.log(`✓ Server đang chạy tại http://localhost:${PORT}`);
});
